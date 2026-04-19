#!/usr/bin/env bash
#
# Sync extension runtime files to Safari resources directory.
# Strips ko-fi link from popup.html (Apple rejects donation links).
#
# Usage: bash scripts/sync-safari.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SAFARI_RES="$ROOT_DIR/safari/Wikilinker/Shared (Extension)/Resources"

echo "Syncing extension files to Safari resources..."

# Runtime files (not src/, scripts/, screenshots/, build files)
cp "$ROOT_DIR/extension/manifest.json" "$SAFARI_RES/"
cp "$ROOT_DIR/extension/popup.html" "$SAFARI_RES/"
cp "$ROOT_DIR/extension/popup.js" "$SAFARI_RES/"
cp "$ROOT_DIR/extension/styles.css" "$SAFARI_RES/"
cp "$ROOT_DIR/extension/dist/background.js" "$SAFARI_RES/dist/"
cp "$ROOT_DIR/extension/dist/content.js" "$SAFARI_RES/dist/"

# Copy _locales (chrome.i18n messages)
rm -rf "$SAFARI_RES/_locales"
cp -R "$ROOT_DIR/extension/_locales" "$SAFARI_RES/"

# Strip ko-fi link and its trailing separator (Apple rejects donation links)
# Matches the full line with ko-fi plus the following middot line
sed -i '' '/ko-fi/,/&middot;/{d;}' "$SAFARI_RES/popup.html"

# Verify no ko-fi references remain
if grep -q "ko-fi" "$SAFARI_RES/popup.html"; then
    echo "ERROR: ko-fi link still present in Safari popup.html"
    exit 1
fi

echo "Done. Safari resources updated."
