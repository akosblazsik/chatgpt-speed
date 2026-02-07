#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$ROOT_DIR/target"
KEY_DIR="$ROOT_DIR/keys"
PRIVATE_KEY="$KEY_DIR/privatekey.pem"

VERSION="$(perl -ne 'if(/"version"\s*:\s*"([^"]+)"/){print $1; exit}' "$ROOT_DIR/manifest.json")"
if [[ -z "${VERSION}" ]]; then
  echo "Error: could not read version from manifest.json" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
mkdir -p "$KEY_DIR"

if [[ ! -f "$PRIVATE_KEY" ]]; then
  echo "Generating 2048-bit RSA private key at: $PRIVATE_KEY"
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$PRIVATE_KEY"
fi

OUT="$TARGET_DIR/chatgpt-speed-v${VERSION}.zip"

FILES=(
  manifest.json
  src
  assets/icons
  assets/Screenshot-light.png
  assets/Screenshot-dark.png
  LICENSE
  THIRD_PARTY_LICENSES.md
  privacy-policy.md
  README.md
  RELEASE_NOTES.md
  docs
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
  zip -r "$OUT" "${INCLUDE[@]}" -x "*.DS_Store" "assets/source-icons/*" "*.xcf" "*.zip"
)

echo "Created: $OUT"
