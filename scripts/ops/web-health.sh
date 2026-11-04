#!/usr/bin/env bash
set -euo pipefail
site_origin=${WEB_HEALTH_ORIGIN:-http://127.0.0.1:4000}
backend_origin=${WEB_BACKEND_HEALTH_ORIGIN:-http://127.0.0.1:3000}
for url in "$backend_origin/web/health" "$site_origin/api/health"; do
  status=$(curl --silent --show-error --max-time 10 --output /dev/null --write-out '%{http_code}' "$url")
  if [[ "$status" != '200' ]]; then printf 'Web readiness failed: HTTP %s\n' "$status" >&2; exit 1; fi
done
printf 'Web frontend and database readiness passed.\n'
