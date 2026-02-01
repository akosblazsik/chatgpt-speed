#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$ROOT_DIR/target"

VERSION="$(perl -ne 'if(/"version"\s*:\s*"([^"]+)"/){print $1; exit}' "$ROOT_DIR/manifest.json")"
if [[ -z "${VERSION}" ]]; then
  echo "Error: could not read version from manifest.json" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
OUT="$TARGET_DIR/chatgpt-speed-v${VERSION}.zip"

FILES=(
  manifest.json
  src
  icons
  LICENSE
  THIRD_PARTY_LICENSES.md
  privacy-policy.md
  README.md
)

INCLUDE=()
for f in "${FILES[@]}"; do
  if [[ -e "$ROOT_DIR/$f" ]]; then
    INCLUDE+=("$f")
  fi
done

if [[ "${#INCLUDE[@]}" -eq 0 ]]; then
  echo "Error: no files to package" >&2
  exit 1
fi

(
  cd "$ROOT_DIR"
  zip -r "$OUT" "${INCLUDE[@]}" -x "*.DS_Store"
)

echo "Created: $OUT"
