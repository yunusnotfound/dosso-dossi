#!/usr/bin/env bash
# Consistent DB + uploads backup. Only this Compose project's API/admin pause.
set -Eeuo pipefail
source "$(dirname -- "$0")/common.sh"
[[ ${1:-} == --already-stopped || $# == 0 ]] || die 'Usage: backup.sh [--already-stopped]'
restart_services=false
backup_dir="$DD_ROOT/backups/$(date -u +%Y%m%dT%H%M%SZ)-$RANDOM"
completed=false
cleanup() {
  local status=$?
  if "$restart_services"; then compose up -d --no-deps --no-build api admin || status=1; fi
  if ! "$completed"; then printf 'Incomplete backup retained for inspection: %s\n' "$backup_dir" >&2; fi
  exit "$status"
}
trap cleanup EXIT
if [[ ${1:-} != --already-stopped ]]; then
  lock_deployment
fi
require_reconciled_release
backup_storage_preflight
if [[ ${1:-} != --already-stopped ]]; then
  if [[ -n $(compose ps --status running -q api) ]]; then restart_services=true; fi
  compose stop admin api
fi
mkdir -p "$backup_dir"
compose exec -T db sh -c 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner --no-acl' > "$backup_dir/database.dump"
# Read the actual stopped API container's volume. This never mounts another project.
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  --memory 128m --cpus 0.25 --entrypoint tar -v "$DD_BACKUP_UPLOADS_VOLUME:/data:ro" "$DD_BACKUP_API_IMAGE" -C /data -czf - . > "$backup_dir/uploads.tar.gz"
cp "$DD_ENV_FILE" "$backup_dir/.env.production"
[[ ! -f "$DD_RELEASE_FILE" ]] || cp "$DD_RELEASE_FILE" "$backup_dir/release.env"
cp "$DD_COMPOSE_FILE" "$backup_dir/compose.production.yml"
[[ ! -f "$DD_INGRESS_FILE" ]] || cp "$DD_INGRESS_FILE" "$backup_dir/compose.ingress.yml"
(cd "$backup_dir" && sha256sum database.dump uploads.tar.gz .env.production compose.production.yml > SHA256SUMS
  if [[ -f release.env ]]; then sha256sum release.env >> SHA256SUMS; fi
  if [[ -f compose.ingress.yml ]]; then sha256sum compose.ingress.yml >> SHA256SUMS; fi)
touch "$backup_dir/COMPLETE"
completed=true
printf 'Backup complete (contains secrets; keep private): %s\n' "$backup_dir"
