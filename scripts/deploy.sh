#!/bin/bash
set -e

REMOTE="pi@whitelabel.org"
DEPLOY_ROOT="/opt/wikilinker"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

echo "Deploying wikilinker server..."

# Deploy server/ contents flat to /opt/wikilinker/
# (shared/ is inside server/ so it goes with it)
rsync -avz --delete \
  --exclude='node_modules' \
  --exclude='cache' \
  --exclude='.env' \
  --exclude='test-suite' \
  "$REPO_DIR/server/" "$REMOTE:$DEPLOY_ROOT/"

echo "Installing dependencies and restarting wikilinker..."
ssh "$REMOTE" "cd $DEPLOY_ROOT && npm install --omit=dev"
ssh "$REMOTE" "sudo /usr/bin/systemctl restart wikilinker"

echo "Done! Server deployed to $DEPLOY_ROOT"
