#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${1:-/srv/lamb-pilot}"
BUNDLE_DIR="${2:-$(pwd)}"
RELEASE_NAME="$(basename "$BUNDLE_DIR")"
RELEASES_DIR="$APP_ROOT/releases"
SHARED_DIR="$APP_ROOT/shared"
TARGET_DIR="$RELEASES_DIR/$RELEASE_NAME"

if [[ ! -d "$BUNDLE_DIR/dist" ]]; then
  echo "Bundle directory must contain a built dist folder."
  exit 1
fi

mkdir -p "$RELEASES_DIR" "$SHARED_DIR" "$SHARED_DIR/data" "$SHARED_DIR/backups"
rm -rf "$TARGET_DIR"
cp -R "$BUNDLE_DIR" "$TARGET_DIR"

if [[ ! -f "$SHARED_DIR/.env" ]]; then
  cp "$TARGET_DIR/.env.example" "$SHARED_DIR/.env"
  echo "Created $SHARED_DIR/.env from .env.example. Update it before exposing the app publicly."
fi

rm -rf "$TARGET_DIR/data" "$TARGET_DIR/backups"
ln -sfn "$SHARED_DIR/.env" "$TARGET_DIR/.env"
ln -sfn "$SHARED_DIR/data" "$TARGET_DIR/data"
ln -sfn "$SHARED_DIR/backups" "$TARGET_DIR/backups"

cd "$TARGET_DIR"
npm ci --omit=dev

if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 is required on the server. Install it with: npm install -g pm2"
  exit 1
fi

pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save || true

ln -sfn "$TARGET_DIR" "$APP_ROOT/current"

echo "Deployment completed."
echo "Current release: $TARGET_DIR"
