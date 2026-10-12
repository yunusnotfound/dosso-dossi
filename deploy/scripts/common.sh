#!/usr/bin/env bash
# Sourced by deployment utilities. Never source the application secret file.
set -Eeuo pipefail
umask 077
DD_ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
DD_ENV_FILE=${DOSSO_ENV_FILE:-"$DD_ROOT/shared/.env.production"}
DD_RELEASE_FILE=${DOSSO_RELEASE_FILE:-"$DD_ROOT/shared/release.env"}
DD_COMPOSE_FILE="$DD_ROOT/deploy/compose.production.yml"
DD_INGRESS_FILE="$DD_ROOT/deploy/compose.ingress.yml"
DD_PENDING_FILE="$DD_ROOT/shared/pending-migration.env"
DD_DISK_RESERVE_BYTES=10737418240 # Keep 10 GiB available to this host's other projects.
die() { printf '%s\n' "$*" >&2; exit 1; }
[[ -f "$DD_ENV_FILE" ]] || die "Missing environment file: $DD_ENV_FILE"
env_value() { sed -n "s/^${1}=//p" "$DD_ENV_FILE" | tail -1; }
DD_PROJECT=$(env_value COMPOSE_PROJECT_NAME)
DD_PROJECT=${DD_PROJECT:-dosso-dossi}
[[ "$DD_PROJECT" =~ ^[a-z0-9][a-z0-9_-]+$ ]] || die 'Invalid Compose project name'
compose() {
  local args=(--project-name "$DD_PROJECT" --env-file "$DD_ENV_FILE")
  if [[ -f "$DD_RELEASE_FILE" ]]; then args+=(--env-file "$DD_RELEASE_FILE"); fi
  args+=(-f "$DD_COMPOSE_FILE")
  if [[ -f "$DD_INGRESS_FILE" ]]; then args+=(-f "$DD_INGRESS_FILE"); fi
  docker compose "${args[@]}" "$@"
}
lock_deployment() {
  mkdir -p "$DD_ROOT/shared"
  exec 9>"$DD_ROOT/shared/deploy.lock"
  flock -n 9 || die 'Another deployment, backup or restore is running'
}
require_reconciled_release() {
  [[ ! -e "$DD_PENDING_FILE" ]] || die "Unreconciled migration: $DD_PENDING_FILE. Review database/release state before deploying or backing up."
}
require_free_space() {
  local directory=$1 needed=$2 label=$3 available required
  available=$(df -PB1 -- "$directory" | awk 'NR == 2 {print $4}')
  [[ "$available" =~ ^[0-9]+$ && "$needed" =~ ^[0-9]+$ ]] || die "Cannot determine free space for $label"
  required=$((DD_DISK_RESERVE_BYTES + needed))
  (( available >= required )) || die "$label has $((available / 1048576)) MiB free; $((required / 1048576)) MiB required including the 10 GiB host reserve. No data was deleted."
}
storage_preflight() {
  local backup_bytes=${1:-0} docker_root
  mkdir -p "$DD_ROOT/backups"
  docker_root=$(docker info --format '{{.DockerRootDir}}')
  [[ -d "$docker_root" ]] || die 'Cannot inspect the local Docker data filesystem'
  require_free_space "$docker_root" 0 'Docker filesystem'
  require_free_space "$DD_ROOT/backups" "$backup_bytes" 'Backup filesystem'
}
backup_storage_preflight() {
  local database_bytes uploads_bytes
  DD_BACKUP_API_ID=$(compose ps --all -q api)
  [[ -n "$DD_BACKUP_API_ID" ]] || die 'No API container exists; bootstrap before backing up uploads'
  DD_BACKUP_UPLOADS_VOLUME=$(docker inspect "$DD_BACKUP_API_ID" --format '{{range .Mounts}}{{if eq .Destination "/app/uploads"}}{{.Name}}{{end}}{{end}}')
  [[ "$DD_BACKUP_UPLOADS_VOLUME" == "${DD_PROJECT}_uploads" ]] || die 'Unexpected uploads volume; refusing backup'
  DD_BACKUP_API_IMAGE=$(docker inspect "$DD_BACKUP_API_ID" --format '{{.Image}}')
  database_bytes=$(compose exec -T db sh -c 'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -v ON_ERROR_STOP=1 -c "SELECT pg_database_size(current_database());"')
  uploads_bytes=$(docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
    --memory 128m --cpus 0.25 --entrypoint du -v "$DD_BACKUP_UPLOADS_VOLUME:/data:ro" "$DD_BACKUP_API_IMAGE" -sb /data | awk '{print $1}')
  [[ "$database_bytes" =~ ^[0-9]+$ && "$uploads_bytes" =~ ^[0-9]+$ ]] || die 'Cannot estimate database/media backup size'
  # Both sources remain live during this check; allow twice their current size.
  storage_preflight "$((2 * (database_bytes + uploads_bytes)))"
}
