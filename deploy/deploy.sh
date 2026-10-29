#!/usr/bin/env bash
# Run by deploy/webhook.mjs after a push to main. The built site (public/) is
# committed, so the server only fast-forwards and reloads. The film
# (public/xelle/video_xelle.mp4) is not in git and stays as uploaded.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only origin main
pm2 reload xelle-site
