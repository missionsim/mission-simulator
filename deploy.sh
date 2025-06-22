#!/usr/bin/env bash

# Abort on error, unset variable usage, or pipeline failure.
set -euo pipefail

# Google Cloud Storage bucket to deploy to
BUCKET_NAME="missionsimulator.com"

# Absolute path to the repository root (directory of this script)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Whether to skip building the frontend (useful for CI workflows that build elsewhere)
if [[ "${1:-}" == "--no-build" ]]; then
  SKIP_BUILD=1
else
  SKIP_BUILD=0
fi

# Build the React frontend unless instructed otherwise
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "🏗️  Building frontend …"
  pushd "$ROOT_DIR/frontend" >/dev/null
  if command -v pnpm &>/dev/null; then
    pnpm install --frozen-lockfile
    pnpm run build
  else
    npm install --legacy-peer-deps
    npm run build
  fi
  popd >/dev/null
else
  echo "⚠️  Skipping build step (\"--no-build\" flag provided)"
fi

BUILD_DIR="$ROOT_DIR/frontend/build"

if [[ ! -d "$BUILD_DIR" ]]; then
  echo "❌ Build directory not found at $BUILD_DIR. Exiting." >&2
  exit 1
fi

# After verifying BUILD_DIR exists, remove unwanted macOS metadata files
find "$BUILD_DIR" -name '.DS_Store' -delete

# Prefer an older Python runtime for gcloud/gsutil if Python 3.12 is the system default
if command -v python3.11 &>/dev/null; then
  export CLOUDSDK_PYTHON="python3.11"
fi

# Sync all static assets to the bucket (deletes files that no longer exist locally)
#   -m  : perform a parallel (multi-threaded) transfer
#   rsync flags:
#     -c : compute checksums to detect changes (safer than mod-time alone)
#     -d : delete extra files in destination bucket
#     -r : recurse into directories
echo "🚀 Syncing $BUILD_DIR → gs://$BUCKET_NAME …"
gsutil -m rsync -c -d -r "$BUILD_DIR" "gs://$BUCKET_NAME"

# Re-upload index.html with no-cache headers so browsers always fetch the latest file.
# (Other files in the build output are fingerprinted and can be safely cached for a long time.)
echo "🔧 Setting no-cache headers on index.html …"
gsutil -h "Cache-Control:no-cache, max-age=0" cp "$BUILD_DIR/index.html" "gs://$BUCKET_NAME/index.html"

echo "✅ Deployment complete!" 