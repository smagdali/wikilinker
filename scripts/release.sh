#!/usr/bin/env bash
#
# One-command release pipeline for Wikilinker.
#
# Usage: bash scripts/release.sh <version> [--skip-safari] [--skip-publish]
#
# Steps:
#   1. Validate: clean tree, on main, version format looks like x.y.z
#   2. Bump version across package.json, both manifests, Xcode pbxproj
#   3. Run tests and build extension
#   4. Sync Safari resources
#   5. Commit, tag, push
#   6. Publish Chrome + Firefox
#   7. Publish Safari (macOS + iOS) unless --skip-safari
#   8. Create GitHub release with attached artefacts
#
# Flags:
#   --skip-safari   Skip Safari archive and upload
#   --skip-publish  Skip all store publishing; still commits, tags, pushes, releases
#   --dry-run       Print what would happen; make no changes

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

VERSION="${1:-}"
SKIP_SAFARI=false
SKIP_PUBLISH=false
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --skip-safari) SKIP_SAFARI=true ;;
    --skip-publish) SKIP_PUBLISH=true ;;
    --dry-run) DRY_RUN=true ;;
  esac
done

if [[ -z "$VERSION" ]] || [[ "$VERSION" == --* ]]; then
  echo "Usage: bash scripts/release.sh <version> [--skip-safari] [--skip-publish] [--dry-run]" >&2
  exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "ERROR: version must be x.y.z (got: $VERSION)" >&2
  exit 1
fi

cd "$ROOT_DIR"

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

section() {
  echo ""
  echo "=== $* ==="
}

# ---------------------------------------------------------------------------
section "Step 1: Validate"

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "ERROR: not on main branch (on $CURRENT_BRANCH)" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: working tree is not clean. Commit or stash first." >&2
  git status --short
  exit 1
fi

if git rev-parse "v$VERSION" >/dev/null 2>&1; then
  echo "ERROR: tag v$VERSION already exists" >&2
  exit 1
fi

CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "Bumping $CURRENT_VERSION -> $VERSION"

# ---------------------------------------------------------------------------
section "Step 2: Bump version"

bump_file() {
  local file="$1"
  local pattern="$2"
  local replacement="$3"
  if $DRY_RUN; then
    echo "[dry-run] sed -i '' 's#$pattern#$replacement#g' '$file'"
  else
    sed -i '' "s#$pattern#$replacement#g" "$file"
  fi
}

bump_file "package.json" "\"version\": \"$CURRENT_VERSION\"" "\"version\": \"$VERSION\""
bump_file "extension/manifest.json" "\"version\": \"$CURRENT_VERSION\"" "\"version\": \"$VERSION\""
bump_file "safari/Wikilinker/Shared (Extension)/Resources/manifest.json" "\"version\": \"$CURRENT_VERSION\"" "\"version\": \"$VERSION\""
bump_file "safari/Wikilinker/Wikilinker.xcodeproj/project.pbxproj" "MARKETING_VERSION = $CURRENT_VERSION;" "MARKETING_VERSION = $VERSION;"

# ---------------------------------------------------------------------------
section "Step 3: Test and build"

run npm test
run node extension/build.js

# ---------------------------------------------------------------------------
section "Step 4: Sync Safari resources"

run bash "$SCRIPT_DIR/sync-safari.sh"

# ---------------------------------------------------------------------------
section "Step 5: Commit, tag, push"

run git add \
  package.json \
  extension/manifest.json \
  extension/dist \
  "safari/Wikilinker/Shared (Extension)/Resources" \
  "safari/Wikilinker/Wikilinker.xcodeproj/project.pbxproj"

run git commit -m "v$VERSION" -m "Release v$VERSION"
run git tag "v$VERSION"
run git push
run git push --tags

# ---------------------------------------------------------------------------
if ! $SKIP_PUBLISH; then
  section "Step 6: Publish Chrome + Firefox"
  run bash "$SCRIPT_DIR/publish.sh"
fi

# ---------------------------------------------------------------------------
if ! $SKIP_PUBLISH && ! $SKIP_SAFARI; then
  section "Step 7: Publish Safari (macOS + iOS)"
  run bash "$SCRIPT_DIR/publish-safari.sh"
fi

# ---------------------------------------------------------------------------
section "Step 8: Create GitHub release"

ZIP_FILE="$ROOT_DIR/extension/wikilinker-${VERSION}.zip"
XPI_FILE="$ROOT_DIR/extension/web-ext-artifacts/wikilinker-${VERSION}.xpi"

ASSETS=()
[[ -f "$ZIP_FILE" ]] && ASSETS+=("$ZIP_FILE")
[[ -f "$XPI_FILE" ]] && ASSETS+=("$XPI_FILE")

PREV_TAG=$(git describe --tags --abbrev=0 "v$VERSION^" 2>/dev/null || echo "")
if [[ -n "$PREV_TAG" ]]; then
  NOTES=$(git log --pretty=format:"- %s" "$PREV_TAG..v$VERSION")
else
  NOTES="Initial release"
fi

if [[ ${#ASSETS[@]} -gt 0 ]]; then
  run gh release create "v$VERSION" --title "v$VERSION" --notes "$NOTES" "${ASSETS[@]}"
else
  run gh release create "v$VERSION" --title "v$VERSION" --notes "$NOTES"
fi

echo ""
echo "Release v$VERSION complete."
