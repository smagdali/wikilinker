#!/usr/bin/env bash
#
# Publish Wikilinker extension to Chrome Web Store and Firefox AMO.
# Usage: bash scripts/publish.sh [chrome|firefox|all]
#
# Requires credentials in environment or .env.publish (gitignored).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load credentials from .env.publish if present
ENV_FILE="$ROOT_DIR/.env.publish"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

TARGET="${1:-all}"
VERSION=$(node -p "require('$ROOT_DIR/package.json').version")
ZIP_FILE="$ROOT_DIR/extension/wikilinker-${VERSION}.zip"

# Build extension
echo "Building extension..."
node "$ROOT_DIR/extension/build.js"

# Create zip (excluding source/build files)
echo "Creating ZIP: $ZIP_FILE"
cd "$ROOT_DIR/extension"
zip -r "$ZIP_FILE" \
  manifest.json popup.html popup.js styles.css \
  dist/ icons/ _locales/ \
  -x "dist/.gitkeep" 2>/dev/null || true
cd "$ROOT_DIR"

echo "Packaged v${VERSION} -> $ZIP_FILE"

publish_chrome() {
  echo ""
  echo "=== Chrome Web Store ==="
  : "${CHROME_EXTENSION_ID:?Set CHROME_EXTENSION_ID}"
  : "${CHROME_CLIENT_ID:?Set CHROME_CLIENT_ID}"
  : "${CHROME_CLIENT_SECRET:?Set CHROME_CLIENT_SECRET}"
  : "${CHROME_REFRESH_TOKEN:?Set CHROME_REFRESH_TOKEN}"

  npx chrome-webstore-upload upload \
    --source "$ZIP_FILE" \
    --extension-id "$CHROME_EXTENSION_ID" \
    --client-id "$CHROME_CLIENT_ID" \
    --client-secret "$CHROME_CLIENT_SECRET" \
    --refresh-token "$CHROME_REFRESH_TOKEN"

  npx chrome-webstore-upload publish \
    --extension-id "$CHROME_EXTENSION_ID" \
    --client-id "$CHROME_CLIENT_ID" \
    --client-secret "$CHROME_CLIENT_SECRET" \
    --refresh-token "$CHROME_REFRESH_TOKEN"

  echo "Chrome: uploaded and published v${VERSION}"
}

publish_firefox() {
  echo ""
  echo "=== Firefox AMO ==="
  : "${WEB_EXT_API_KEY:?Set WEB_EXT_API_KEY}"
  : "${WEB_EXT_API_SECRET:?Set WEB_EXT_API_SECRET}"

  npx web-ext sign \
    --source-dir "$ROOT_DIR/extension" \
    --artifacts-dir "$ROOT_DIR/extension/web-ext-artifacts" \
    --channel listed \
    --api-key "$WEB_EXT_API_KEY" \
    --api-secret "$WEB_EXT_API_SECRET"

  echo "Firefox: submitted v${VERSION}"
}

case "$TARGET" in
  chrome)  publish_chrome ;;
  firefox) publish_firefox ;;
  all)     publish_chrome; publish_firefox ;;
  *)       echo "Usage: bash scripts/publish.sh [chrome|firefox|all]"; exit 1 ;;
esac

echo ""
echo "Done."
