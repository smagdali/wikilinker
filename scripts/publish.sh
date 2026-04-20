#!/usr/bin/env bash
#
# Publish Wikilinker to the Chrome Web Store and Firefox AMO.
#
# Usage:
#   bash scripts/publish.sh                                 # English, both stores
#   bash scripts/publish.sh chrome                          # English, Chrome only
#   bash scripts/publish.sh firefox                         # English, Firefox only
#   bash scripts/publish.sh --lang fr                       # French, both stores
#   bash scripts/publish.sh --lang fr chrome                # French, Chrome only
#   bash scripts/publish.sh --lang all                      # every language, both stores
#
# Requires credentials in environment or .env.publish (gitignored).
# Per-language extension IDs are looked up as CHROME_EXTENSION_ID_<UPPER_LANG>
# (e.g. CHROME_EXTENSION_ID_FR). English uses the legacy CHROME_EXTENSION_ID.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Load credentials
ENV_FILE="$ROOT_DIR/.env.publish"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ── Parse args ─────────────────────────────────────────────────────────────

LANG_ARG="en"
TARGET="all"

while [[ $# -gt 0 ]]; do
  case $1 in
    --lang) LANG_ARG="$2"; shift 2 ;;
    chrome|firefox|all) TARGET="$1"; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

VERSION=$(node -p "require('$ROOT_DIR/package.json').version")

# ── Expand language list ──────────────────────────────────────────────────

if [[ "$LANG_ARG" == "all" ]]; then
  LANGS=($(node -p "require('$ROOT_DIR/i18n/languages.json').languages.map(l => l.code).join(' ')"))
else
  LANGS=("$LANG_ARG")
fi

# ── Per-language build + ZIP + publish ────────────────────────────────────

publish_chrome_for_lang() {
  local lang="$1"
  local zip_file="$2"
  local upper
  upper=$(echo "$lang" | tr '[:lower:]' '[:upper:]')

  local id_var="CHROME_EXTENSION_ID_$upper"
  local chrome_id
  if [[ "$lang" == "en" && -n "${CHROME_EXTENSION_ID:-}" ]]; then
    chrome_id="$CHROME_EXTENSION_ID"
  else
    chrome_id="${!id_var:-}"
  fi

  if [[ -z "$chrome_id" ]]; then
    echo "  [skip] Chrome for $lang — no $id_var (or CHROME_EXTENSION_ID for en)"
    return 0
  fi

  : "${CHROME_CLIENT_ID:?Set CHROME_CLIENT_ID}"
  : "${CHROME_CLIENT_SECRET:?Set CHROME_CLIENT_SECRET}"
  : "${CHROME_REFRESH_TOKEN:?Set CHROME_REFRESH_TOKEN}"

  echo "  Chrome: $lang → $chrome_id"
  npx chrome-webstore-upload upload \
    --source "$zip_file" \
    --extension-id "$chrome_id" \
    --client-id "$CHROME_CLIENT_ID" \
    --client-secret "$CHROME_CLIENT_SECRET" \
    --refresh-token "$CHROME_REFRESH_TOKEN"

  npx chrome-webstore-upload publish \
    --extension-id "$chrome_id" \
    --client-id "$CHROME_CLIENT_ID" \
    --client-secret "$CHROME_CLIENT_SECRET" \
    --refresh-token "$CHROME_REFRESH_TOKEN"

  echo "  Chrome: uploaded + published v${VERSION} ($lang)"
}

publish_firefox_for_lang() {
  local lang="$1"
  local source_dir="$2"

  : "${WEB_EXT_API_KEY:?Set WEB_EXT_API_KEY}"
  : "${WEB_EXT_API_SECRET:?Set WEB_EXT_API_SECRET}"

  echo "  Firefox: $lang"
  npx web-ext sign \
    --source-dir "$source_dir" \
    --artifacts-dir "$ROOT_DIR/build/web-ext-artifacts/$lang" \
    --channel listed \
    --api-key "$WEB_EXT_API_KEY" \
    --api-secret "$WEB_EXT_API_SECRET"

  echo "  Firefox: submitted v${VERSION} ($lang)"
}

# ── Main loop ─────────────────────────────────────────────────────────────

for lang in "${LANGS[@]}"; do
  echo ""
  echo "=== lang: $lang ==="

  if [[ "$lang" == "en" ]]; then
    # English: build default extension into extension/dist/, zip extension/ tree
    node "$ROOT_DIR/extension/build.js"
    source_dir="$ROOT_DIR/extension"
    zip_file="$ROOT_DIR/build/wikilinker-en-${VERSION}.zip"
  else
    # Per-language: build into build/wikilinker-<lang>/, zip its tree
    node "$ROOT_DIR/extension/build.js" --lang "$lang"
    source_dir="$ROOT_DIR/build/wikilinker-$lang"
    zip_file="$ROOT_DIR/build/wikilinker-$lang-${VERSION}.zip"
  fi

  mkdir -p "$(dirname "$zip_file")"
  rm -f "$zip_file"
  echo "  Packaging: $zip_file"
  (cd "$source_dir" && zip -qr "$zip_file" \
    manifest.json popup.html popup.js styles.css \
    dist/ icons/ _locales/ \
    -x "dist/.gitkeep")

  case "$TARGET" in
    chrome)  publish_chrome_for_lang "$lang" "$zip_file" ;;
    firefox) publish_firefox_for_lang "$lang" "$source_dir" ;;
    all)
      publish_chrome_for_lang "$lang" "$zip_file"
      publish_firefox_for_lang "$lang" "$source_dir"
      ;;
  esac
done

echo ""
echo "Done."
