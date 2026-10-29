#!/usr/bin/env bash
# Run by deploy/webhook.mjs after a push to main. The built site (public/) is
# committed, so the server only fast-forwards, fetches the LFS files and reloads.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only origin main
git lfs pull
pm2 reload xelle-site
