#!/usr/bin/env bash
# Run by deploy/webhook.mjs after a push to main. The built site (public/) is
# committed, so the server only fast-forwards and reloads. The film
# (public/xelle/video_xelle.mp4) is not in git and stays as uploaded.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only origin main
pm2 reload xelle-site

# Cloudflare keeps the static files for a day (deploy/CLOUDFLARE.md): drop them
# so visitors get this deploy. The purge-only token lives on the server, never in git.
token_file=/etc/xelle/cloudflare-purge-token
if [ -r "$token_file" ]; then
  curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID:-eed3f74e160bb156061d7064ae7cff6d}/purge_cache" \
    -H "Authorization: Bearer $(cat "$token_file")" -H "Content-Type: application/json" \
    --data '{"purge_everything":true}' > /dev/null && echo "Cloudflare cache purged" || echo "Cloudflare cache purge failed"
else
  echo "No $token_file: Cloudflare cache not purged"
fi
