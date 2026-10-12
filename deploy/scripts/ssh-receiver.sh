#!/usr/bin/env bash
# Install root-owned mode 0755 at /usr/local/sbin/dosso-dossi-ssh.
# authorized_keys uses restrict,command="/usr/local/sbin/dosso-dossi-ssh".
set -Eeuo pipefail
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
if [[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy\ ([a-f0-9]{40})$ ]]; then
  exec sudo -n /opt/dosso-dossi/deploy/scripts/release.sh "${BASH_REMATCH[1]}"
fi
printf 'Only deploy <full commit SHA> is allowed.\n' >&2
exit 64
