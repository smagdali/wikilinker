#!/usr/bin/env bash
#
# Publish Wikilinker to the Safari App Store (macOS + iOS).
# Archives both targets and uploads to App Store Connect for review.
#
# Usage: bash scripts/publish-safari.sh
#
# Requires in .env.publish:
#   APP_STORE_CONNECT_API_KEY_ID
#   APP_STORE_CONNECT_API_ISSUER_ID
#   APP_STORE_CONNECT_API_KEY_PATH

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
XCODE_PROJECT="$ROOT_DIR/safari/Wikilinker/Wikilinker.xcodeproj"
BUILD_DIR="$ROOT_DIR/build/safari"

# Load credentials
ENV_FILE="$ROOT_DIR/.env.publish"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${APP_STORE_CONNECT_API_KEY_ID:?Set APP_STORE_CONNECT_API_KEY_ID}"
: "${APP_STORE_CONNECT_API_ISSUER_ID:?Set APP_STORE_CONNECT_API_ISSUER_ID}"
: "${APP_STORE_CONNECT_API_KEY_PATH:?Set APP_STORE_CONNECT_API_KEY_PATH}"

# Expand tilde in key path
KEY_PATH="${APP_STORE_CONNECT_API_KEY_PATH/#\~/$HOME}"
if [[ ! -f "$KEY_PATH" ]]; then
  echo "ERROR: API key file not found at $KEY_PATH" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"

archive_and_upload() {
  local platform="$1"       # macos | ios
  local scheme="$2"         # "Wikilinker (macOS)" | "Wikilinker (iOS)"
  local destination="$3"    # generic/platform=macOS | generic/platform=iOS
  local export_plist="$4"
  local archive_path="$BUILD_DIR/wikilinker-$platform.xcarchive"
  local export_path="$BUILD_DIR/wikilinker-$platform-export"

  echo ""
  echo "=== Safari $platform: archive ==="
  rm -rf "$archive_path" "$export_path"

  xcodebuild \
    -project "$XCODE_PROJECT" \
    -scheme "$scheme" \
    -configuration Release \
    -destination "$destination" \
    -archivePath "$archive_path" \
    archive

  echo ""
  echo "=== Safari $platform: export ==="
  xcodebuild -exportArchive \
    -archivePath "$archive_path" \
    -exportPath "$export_path" \
    -exportOptionsPlist "$export_plist" \
    -allowProvisioningUpdates \
    -authenticationKeyID "$APP_STORE_CONNECT_API_KEY_ID" \
    -authenticationKeyIssuerID "$APP_STORE_CONNECT_API_ISSUER_ID" \
    -authenticationKeyPath "$KEY_PATH"

  # Find the exported artifact (macOS: .pkg, iOS: .ipa)
  local artifact
  artifact=$(find "$export_path" -maxdepth 1 \( -name "*.pkg" -o -name "*.ipa" \) | head -n 1)
  if [[ -z "$artifact" ]]; then
    echo "ERROR: no .pkg or .ipa found in $export_path" >&2
    exit 1
  fi

  echo ""
  echo "=== Safari $platform: upload $artifact ==="
  xcrun altool --upload-app \
    --type "$platform" \
    --file "$artifact" \
    --apiKey "$APP_STORE_CONNECT_API_KEY_ID" \
    --apiIssuer "$APP_STORE_CONNECT_API_ISSUER_ID"

  echo "Safari $platform uploaded: $artifact"
}

archive_and_upload \
  "macos" \
  "Wikilinker (macOS)" \
  "generic/platform=macOS" \
  "$SCRIPT_DIR/export-options-macos.plist"

archive_and_upload \
  "ios" \
  "Wikilinker (iOS)" \
  "generic/platform=iOS" \
  "$SCRIPT_DIR/export-options-ios.plist"

echo ""
echo "Safari: both macOS and iOS builds uploaded to App Store Connect."
echo "Check App Store Connect to submit for review."
