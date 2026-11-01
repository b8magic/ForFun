#!/usr/bin/env bash
# Publish site/ to Cloudflare as a static-assets Worker (Cloudflare Pages is now part of Workers).
#
#   tools/deploy-cloudflare.sh [worker-name]        # default: solex-tours-preview
#
# Auth: either `npx wrangler@4 login --device` once (open the printed link on any device and
# approve), or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in the environment.
# Current preview: https://solex-tours-preview.ferrettob.workers.dev (noindex until launch).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="${1:-solex-tours-preview}"
test -f site/index.html || { echo "site/ is missing: run npm run build first" >&2; exit 1; }
npx --yes wrangler@4 deploy --assets ./site --name "$NAME" --compatibility-date 2026-10-23
