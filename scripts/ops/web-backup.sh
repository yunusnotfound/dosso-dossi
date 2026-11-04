#!/usr/bin/env bash
# Uses libpq PGSERVICE/PGPASSFILE, never places database passwords in CLI arguments.
set -euo pipefail
umask 077
: "${PGSERVICE:?Set the web-only PostgreSQL service from ~/.pg_service.conf}"
: "${WEB_MEDIA_ROOT:?Set the persistent uploads/web-catalog directory}"
: "${WEB_BACKUP_DIR:?Set a private backup directory outside uploads}"
command -v pg_dump >/dev/null
test -d "$WEB_MEDIA_ROOT"
mkdir -p "$WEB_BACKUP_DIR"
media_root=$(cd "$WEB_MEDIA_ROOT" && pwd -P)
backup_root=$(cd "$WEB_BACKUP_DIR" && pwd -P)
case "$backup_root/" in "$media_root/"*) echo 'Backup directory must be outside media.' >&2; exit 1;; esac
archive_dir=$(mktemp -d "$backup_root/web-$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX")
trap 'echo "Backup incomplete; keep for diagnosis: $archive_dir" >&2' ERR
pg_dump --format=custom --no-owner --no-privileges --file="$archive_dir/database.dump"
tar -czf "$archive_dir/media.tar.gz" -C "$media_root" .
printf 'format=dosso-web-backup-v1\ncreated_utc=%s\n' "$(date -u +%FT%TZ)" > "$archive_dir/metadata.txt"
(
  cd "$archive_dir"
  if command -v sha256sum >/dev/null; then sha256sum database.dump media.tar.gz metadata.txt > SHA256SUMS
  else shasum -a 256 database.dump media.tar.gz metadata.txt > SHA256SUMS; fi
)
touch "$archive_dir/COMPLETE"
printf 'Web database and media backup created: %s\n' "$archive_dir"
printf 'Copy this private directory to encrypted off-host storage and verify a restore.\n'
