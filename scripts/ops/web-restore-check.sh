#!/usr/bin/env bash
# Default verifies only. Explicit restore targets a pre-created EMPTY *_restore_test DB.
set -euo pipefail
umask 077
if [[ $# -lt 1 || $# -gt 2 ]]; then echo 'Usage: web-restore-check.sh BACKUP_DIRECTORY [--restore-test]' >&2; exit 1; fi
backup_dir=$(cd "$1" && pwd -P)
mode=${2:---verify}
if [[ "$mode" != '--verify' && "$mode" != '--restore-test' ]]; then echo 'Unknown mode.' >&2; exit 1; fi
test -f "$backup_dir/COMPLETE"
(
  cd "$backup_dir"
  if command -v sha256sum >/dev/null; then sha256sum --check SHA256SUMS
  else shasum -a 256 --check SHA256SUMS; fi
)
pg_restore --list "$backup_dir/database.dump" >/dev/null
tar -tzf "$backup_dir/media.tar.gz" >/dev/null
printf 'Backup checksums and archive formats verified.\n'
if [[ "$mode" == '--verify' ]]; then exit 0; fi
: "${PGSERVICE:?Use a dedicated restore-test PostgreSQL service}"
: "${PGDATABASE:?Set an explicitly pre-created empty *_restore_test database}"
: "${RESTORE_MEDIA_DIR:?Set a new temporary media directory}"
if [[ ! "$PGDATABASE" =~ ^[a-zA-Z0-9_]+_restore_test$ ]]; then echo 'Refusing a non-test restore target.' >&2; exit 1; fi
if [[ -e "$RESTORE_MEDIA_DIR" ]]; then echo 'RESTORE_MEDIA_DIR must not already exist.' >&2; exit 1; fi
table_count=$(psql --dbname="$PGDATABASE" --no-psqlrc --tuples-only --no-align --command="SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');")
if [[ "$table_count" != '0' ]]; then echo 'Restore target is not empty; no changes made.' >&2; exit 1; fi
# Only restore trusted operator-created backups. Never run an untrusted SQL dump.
pg_restore --dbname="$PGDATABASE" --no-owner --no-privileges --exit-on-error --single-transaction "$backup_dir/database.dump"
mkdir -p "$RESTORE_MEDIA_DIR"
tar -xzf "$backup_dir/media.tar.gz" -C "$RESTORE_MEDIA_DIR"
printf 'Restored to isolated test DB and media directory. Validate record counts and image reads before any production cutover.\n'
