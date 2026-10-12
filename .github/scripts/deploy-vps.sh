#!/usr/bin/env bash
# The server accepts only "deploy <sha>". Registry authentication travels over
# encrypted stdin, never a command argument or a persistent server credential.
set -euo pipefail

for variable in VPS_HOST VPS_USER VPS_SSH_PRIVATE_KEY VPS_SSH_KNOWN_HOSTS GHCR_TOKEN GITHUB_SHA; do
  if [[ -z "${!variable:-}" ]]; then
    printf 'Required deployment setting is missing: %s\n' "$variable" >&2
    exit 1
  fi
done

VPS_PORT="${VPS_PORT:-22}"
[[ "$VPS_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]] || { echo 'Invalid VPS_HOST.' >&2; exit 1; }
[[ "$VPS_USER" =~ ^[a-z_][a-z0-9_-]*$ && "$VPS_USER" != root ]] || { echo 'Use a dedicated non-root deployment user.' >&2; exit 1; }
[[ "$VPS_PORT" =~ ^[0-9]{1,5}$ ]] && (( 10#$VPS_PORT >= 1 && 10#$VPS_PORT <= 65535 )) || { echo 'Invalid VPS_PORT.' >&2; exit 1; }
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid release revision.' >&2; exit 1; }

umask 077
ssh_directory="$(mktemp -d)"
trap 'rm -rf -- "$ssh_directory"' EXIT
printf '%s\n' "$VPS_SSH_PRIVATE_KEY" > "$ssh_directory/key"
printf '%s\n' "$VPS_SSH_KNOWN_HOSTS" > "$ssh_directory/known_hosts"

# This must come from a separately verified host key, never ssh-keyscan at deploy time.
known_host="$VPS_HOST"
if (( 10#$VPS_PORT != 22 )); then known_host="[${VPS_HOST}]:${VPS_PORT}"; fi
ssh-keygen -F "$known_host" -f "$ssh_directory/known_hosts" > /dev/null || {
  echo 'The pinned known_hosts does not contain this VPS host and port.' >&2
  exit 1
}

printf '%s\n' "$GHCR_TOKEN" | ssh \
  -F /dev/null -T \
  -i "$ssh_directory/key" \
  -p "$VPS_PORT" \
  -o BatchMode=yes \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  -o "UserKnownHostsFile=$ssh_directory/known_hosts" \
  -o GlobalKnownHostsFile=/dev/null \
  -o ConnectTimeout=15 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=4 \
  "${VPS_USER}@${VPS_HOST}" "deploy ${GITHUB_SHA}"
