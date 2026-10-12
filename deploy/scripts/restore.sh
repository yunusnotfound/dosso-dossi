#!/usr/bin/env bash
# Restore only into a NEW project's empty database and empty uploads volume.
# Never starts the application and never overwrites a populated destination.
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
[[ $# == 1 && -d "$1" ]] || die 'Usage: restore.sh <complete-backup-directory>'
backup_dir=$(cd -- "$1" && pwd -P)
lock_deployment
command -v python3 >/dev/null || die 'python3 is required for backup validation'

# Do not let a checksum manifest read outside the backup directory. Archives
# contain regular files/directories only: no absolute paths, traversal or links.
python3 - "$backup_dir" <<'PY'
import hashlib
import pathlib
import re
import sys
import tarfile

root = pathlib.Path(sys.argv[1])
required = {'database.dump', 'uploads.tar.gz', '.env.production', 'compose.production.yml'}
for optional in ('release.env', 'compose.ingress.yml'):
    if (root / optional).exists():
        required.add(optional)
for name in required | {'SHA256SUMS', 'COMPLETE'}:
    path = root / name
    if path.is_symlink() or not path.is_file():
        sys.exit(f'Backup file missing or not a regular file: {name}')
seen = set()
for line in (root / 'SHA256SUMS').read_text().splitlines():
    match = re.fullmatch(r'([0-9a-f]{64})  ([A-Za-z0-9_.-]+)', line)
    if not match or match[2] not in required or match[2] in seen:
        sys.exit('Invalid checksum manifest')
    digest, name = match.groups()
    seen.add(name)
    with (root / name).open('rb') as source:
        actual = hashlib.file_digest(source, 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else None
        if actual is None:
            check = hashlib.sha256()
            for chunk in iter(lambda: source.read(1024 * 1024), b''):
                check.update(chunk)
            actual = check.hexdigest()
    if actual != digest:
        sys.exit(f'Checksum mismatch: {name}')
if seen != required:
    sys.exit('Checksum manifest does not cover every backup file')
with tarfile.open(root / 'uploads.tar.gz', 'r:gz') as archive:
    for item in archive:
        path = pathlib.PurePosixPath(item.name)
        if path.is_absolute() or '..' in path.parts or not (item.isfile() or item.isdir()):
            sys.exit(f'Unsafe media archive entry: {item.name!r}')
print('Backup checksums and media paths verified')
PY

[[ -z $(compose ps --status running -q api admin) ]] || die 'Stop this project API/admin before restore'
# Use the same API release as the backup; upgrade separately after recovery.
if [[ -f "$backup_dir/release.env" ]]; then
  [[ -f "$DD_RELEASE_FILE" ]] && cmp -s "$backup_dir/release.env" "$DD_RELEASE_FILE" \
    || die 'Install the verified backup release.env as shared/release.env before restore'
fi
compose config --quiet
api_image=$(compose config --format json | python3 -c 'import json,sys; print(json.load(sys.stdin)["services"]["api"]["image"])')
docker image inspect "$api_image" >/dev/null 2>&1 || die 'Pull the backup API image before restore'
compose up -d --no-build --wait --wait-timeout 120 db

objects=$(compose exec -T db sh -c 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1' <<'SQL'
SELECT
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%')
  + (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%')
  + (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%');
SQL
)
[[ "$objects" == 0 ]] || die 'Destination database is not empty; refusing to overwrite data'

uploads_volume="${DD_PROJECT}_uploads"
if ! docker volume inspect "$uploads_volume" >/dev/null 2>&1; then
  docker volume create --label "com.docker.compose.project=$DD_PROJECT" \
    --label com.docker.compose.volume=uploads "$uploads_volume" >/dev/null
fi
# A new Docker volume starts root-owned. Chown only its EMPTY root directory;
# all archive extraction below runs as the image's unprivileged node user.
docker run --rm --network none --read-only --user 0:0 --cap-drop ALL --cap-add CHOWN \
  --security-opt no-new-privileges --memory 128m --cpus 0.25 \
  --entrypoint sh -v "$uploads_volume:/data" "$api_image" -ec \
  'test -z "$(find /data -mindepth 1 -print -quit)" || { echo "Uploads volume is not empty; refusing restore" >&2; exit 1; }; chown 1000:1000 /data'

restore_started=true
completed=false
cleanup() {
  local status=$?
  if "$restore_started" && ! "$completed"; then
    printf 'Restore incomplete. API/admin remain stopped. Inspect the NEW destination before retrying; no existing data was automatically deleted.\n' >&2
  fi
  exit "$status"
}
trap cleanup EXIT
compose exec -T db sh -c 'exec pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --single-transaction --exit-on-error --no-owner --no-acl' < "$backup_dir/database.dump"
docker run --rm -i --network none --read-only --user 1000:1000 --cap-drop ALL --security-opt no-new-privileges \
  --memory 128m --cpus 0.25 --entrypoint tar -v "$uploads_volume:/data" "$api_image" \
  --no-same-owner --no-same-permissions -C /data -xzf - < "$backup_dir/uploads.tar.gz"
completed=true
printf 'Restore complete. API/admin remain stopped. Verify the database, then start the pinned backup release.\n'
