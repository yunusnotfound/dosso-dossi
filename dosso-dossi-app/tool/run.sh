#!/usr/bin/env bash
set -euo pipefail

app_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
defines_file="$app_dir/dart_defines.json"

if [[ ! -f "$defines_file" ]]; then
  printf '%s\n' \
    'dart_defines.json bulunamadı.' \
    'Uygulama klasöründe dart_defines.example.json dosyasını dart_defines.json olarak kopyalayıp MAPBOX_TOKEN ayarını doldurun.' >&2
  exit 1
fi

cd "$app_dir"
exec flutter run --dart-define-from-file="$defines_file" "$@"
