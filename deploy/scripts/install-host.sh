#!/usr/bin/env bash
# Run once as root from a reviewed release checkout. Does not restart Docker,
# change the firewall, touch existing projects, or edit the shared reverse proxy.
set -Eeuo pipefail
umask 077
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
[[ $EUID == 0 ]] || { echo 'Run as root.' >&2; exit 1; }
[[ $# == 2 ]] || { echo 'Usage: install-host.sh <https-origin> <CI-public-key-file>' >&2; exit 1; }
origin=$1
key_file=$2
[[ "$origin" =~ ^https://[a-zA-Z0-9][a-zA-Z0-9.-]*(:[0-9]{1,5})?$ ]] || { echo 'Invalid HTTPS origin.' >&2; exit 1; }
[[ -f "$key_file" ]] || { echo 'Public key file is missing.' >&2; exit 1; }
[[ $(wc -l < "$key_file") -le 1 ]] || { echo 'Expected exactly one public key.' >&2; exit 1; }
read -r key_type key_data _ < "$key_file"
[[ "$key_type" == ssh-ed25519 && "$key_data" =~ ^[A-Za-z0-9+/]+=*$ ]] || { echo 'Expected an Ed25519 public key.' >&2; exit 1; }
ssh-keygen -lf "$key_file" >/dev/null
docker info >/dev/null
docker compose version
source_dir=$(cd -- "$(dirname -- "$0")/.." && pwd)
target=/opt/dosso-dossi
ci_user=dosso-dossi-ci
if [[ -e "$target/deploy/compose.production.yml" ]]; then
  echo 'An installation already exists. Update infrastructure explicitly after reviewing its diff.' >&2
  exit 1
fi
if getent passwd "$ci_user" >/dev/null; then
  echo 'The CI account already exists; review it before installation.' >&2
  exit 1
fi
# A stopped project or an orphaned named volume may exist outside this directory.
# Never adopt its data simply because the default TCP ports are currently free.
if [[ -n $(docker ps -aq --filter label=com.docker.compose.project=dosso-dossi) ||
      -n $(docker volume ls -q --filter label=com.docker.compose.project=dosso-dossi) ||
      -n $(docker network ls -q --filter label=com.docker.compose.project=dosso-dossi) ]]; then
  echo 'The dosso-dossi Docker project namespace already exists; review it before installation.' >&2
  exit 1
fi
for volume in dosso-dossi_pgdata dosso-dossi_uploads; do
  if docker volume inspect "$volume" >/dev/null 2>&1; then
    echo "Existing volume $volume would be reused; refusing installation." >&2
    exit 1
  fi
done
if docker network ls --format '{{.Name}}' | awk '$0 == "dosso-dossi" || index($0, "dosso-dossi_") == 1 {found=1} END {exit !found}'; then
  echo 'A dosso-dossi network name already exists; refusing installation.' >&2
  exit 1
fi
# Refuse ports already owned by an existing service before creating anything.
if ss -H -ltn | awk '{print $4}' | grep -Eq ':(13100|13101)$'; then
  echo 'Default loopback ports 13100/13101 are occupied.' >&2
  exit 1
fi
install -d -m 755 "$target" "$target/deploy" "$target/deploy/scripts"
install -d -m 700 "$target/shared" "$target/backups"
install -m 644 "$source_dir/compose.production.yml" "$target/deploy/compose.production.yml"
install -m 644 "$source_dir/.env.example" "$target/deploy/.env.example"
install -m 644 "$source_dir/README.md" "$target/deploy/README.md"
if [[ -f "$source_dir/compose.ingress.yml.example" ]]; then
  install -m 644 "$source_dir/compose.ingress.yml.example" "$target/deploy/compose.ingress.yml.example"
fi
for script in "$source_dir"/scripts/*.sh; do install -m 755 "$script" "$target/deploy/scripts/"; done
{
  printf 'COMPOSE_PROJECT_NAME=dosso-dossi\nPOSTGRES_DB=dosso_dossi\nPOSTGRES_USER=dosso\n'
  for key in POSTGRES_PASSWORD JWT_SECRET ADMIN_JWT_SECRET POS_WEBHOOK_SECRET PAYMENT_WEBHOOK_SECRET; do
    printf '%s=%s\n' "$key" "$(openssl rand -hex 32)"
  done
  printf 'ADMIN_ORIGINS=%s\nAPI_PORT=13100\nADMIN_PORT=13101\n' "$origin"
  printf 'PAYMENT_PROVIDER=disabled\nSMS_PROVIDER=disabled\nPOS_PROVIDER=disabled\nLOG_LEVEL=info\n'
} > "$target/shared/.env.production"
chmod 600 "$target/shared/.env.production"
install -m 755 "$source_dir/scripts/ssh-receiver.sh" /usr/local/sbin/dosso-dossi-ssh
useradd --system --create-home --home-dir /var/lib/dosso-dossi-ci --shell /bin/bash "$ci_user"
chown root:root /var/lib/dosso-dossi-ci
chmod 755 /var/lib/dosso-dossi-ci
install -d -m 755 -o root -g root /var/lib/dosso-dossi-ci/.ssh
printf 'restrict,command="/usr/local/sbin/dosso-dossi-ssh" %s %s dosso-dossi-actions\n' "$key_type" "$key_data" > /var/lib/dosso-dossi-ci/.ssh/authorized_keys
chmod 644 /var/lib/dosso-dossi-ci/.ssh/authorized_keys
sudoers_tmp=$(mktemp)
trap 'rm -f "$sudoers_tmp"' EXIT
printf '%s ALL=(root) NOPASSWD: /opt/dosso-dossi/deploy/scripts/release.sh *\n' "$ci_user" > "$sudoers_tmp"
visudo -cf "$sudoers_tmp"
install -m 440 "$sudoers_tmp" /etc/sudoers.d/dosso-dossi-ci
printf 'Installed isolated deployment at %s. No application has started yet.\n' "$target"
printf 'CI identity: '
ssh-keygen -lf "$key_file"
