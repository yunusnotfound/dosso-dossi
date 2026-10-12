#!/usr/bin/env bash
# Root-owned receiver target; builds never run on the VPS.
set -Eeuo pipefail
set +x
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
# The restricted CI identity cannot redirect privileged Docker/Compose operations.
unset DOSSO_ENV_FILE DOSSO_RELEASE_FILE DOCKER_HOST DOCKER_CONTEXT DOCKER_CONFIG \
  DOCKER_TLS_VERIFY DOCKER_CERT_PATH DOCKER_API_VERSION
while IFS= read -r inherited; do unset "$inherited"; done < <(compgen -A variable COMPOSE_)
export DOCKER_HOST=unix:///var/run/docker.sock
source "$(dirname -- "$0")/common.sh"
[[ $# == 1 && "$1" =~ ^[a-f0-9]{40}$ ]] || die 'Usage: release.sh <full commit SHA>'
lock_deployment
require_reconciled_release
storage_preflight
sha=$1
registry_user=yunusnotfound
registry_repo=ghcr.io/yunusnotfound/dosso-dossi
work_dir=$(mktemp -d "$DD_ROOT/shared/release.XXXXXXXX")
previous_release=$DD_RELEASE_FILE
stopped=false
migration_started=false
cleanup() {
  local status=$?
  unset registry_token || true
  if (( status != 0 )); then
    if "$migration_started"; then
      # `up --wait` can leave newly started containers behind even on failure.
      # Stop this project before returning, including a failed first release.
      if DD_RELEASE_FILE=$pending compose stop admin api; then
        printf 'Deployment failed after migration started. Dosso Dossi API/admin were stopped. Inspect logs; do not restore a DB over newer transactions.\n' >&2
      else
        printf 'Deployment failed after migration started; stopping API/admin also failed. Check only this project immediately. No database rollback was performed.\n' >&2
      fi
    elif "$stopped" && [[ -f "$previous_release" ]]; then
      DD_RELEASE_FILE=$previous_release compose up -d --no-deps --no-build api admin || true
    fi
  fi
  rm -rf -- "$work_dir"
  exit "$status"
}
trap cleanup EXIT
export DOCKER_CONFIG="$work_dir/docker"
mkdir -m 700 "$DOCKER_CONFIG"
IFS= read -r registry_token || die 'A short-lived GHCR token must be supplied on stdin'
[[ -n "$registry_token" && ${#registry_token} -le 4096 ]] || die 'Invalid registry token'
printf '%s' "$registry_token" | docker login ghcr.io -u "$registry_user" --password-stdin >/dev/null
unset registry_token
pending="$work_dir/release.env"
printf 'API_IMAGE=%s-api:%s\nADMIN_IMAGE=%s-admin:%s\nRELEASE_SHA=%s\n' "$registry_repo" "$sha" "$registry_repo" "$sha" "$sha" > "$pending"
DD_RELEASE_FILE=$pending compose config --quiet
DD_RELEASE_FILE=$pending compose pull api admin
# Keep the pinned database container running; never force-recreate another service.
compose up -d --no-build --wait --wait-timeout 120 db
if [[ -n $(compose ps --all -q api) ]]; then
  # Refuse a backup that would exhaust shared storage BEFORE stopping services.
  backup_storage_preflight
  compose stop admin api
  stopped=true
  bash "$DD_ROOT/deploy/scripts/backup.sh" --already-stopped
fi
install -m 600 "$pending" "$DD_PENDING_FILE"
migration_started=true
DD_RELEASE_FILE=$pending compose run --rm --no-deps -T api node node_modules/prisma/build/index.js migrate deploy
DD_RELEASE_FILE=$pending compose up -d --no-build --no-deps --wait --wait-timeout 180 api admin
admin_port=$(env_value ADMIN_PORT)
curl --fail --silent --show-error --max-time 15 "http://127.0.0.1:${admin_port:-13101}/api/health"
if [[ -f "$previous_release" ]]; then cp "$previous_release" "$DD_ROOT/shared/previous-release.env"; fi
install -m 600 "$pending" "$previous_release"
rm -f -- "$DD_PENDING_FILE"
stopped=false
printf '\nDeployment healthy: %s\n' "$sha"
