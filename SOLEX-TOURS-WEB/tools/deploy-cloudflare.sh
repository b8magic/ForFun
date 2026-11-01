#!/usr/bin/env bash
# Publish site/ to Cloudflare Pages as a private-ish preview (the page is noindex until launch).
#
#   tools/deploy-cloudflare.sh [project-name]        # default: solex-tours-preview
#
# Needs two environment variables (set them in the environment, never in the repo):
#   CLOUDFLARE_API_TOKEN   token with  Account › Cloudflare Pages › Edit  on one account
#   CLOUDFLARE_ACCOUNT_ID  that account's ID
# Result: https://<project-name>.pages.dev (Cloudflare may add a suffix if the name is taken).
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is not set}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is not set}"
PROJECT="${1:-solex-tours-preview}"
WR=(npx --yes wrangler@4)
test -f site/index.html || { echo "site/ is missing: run npm run build first" >&2; exit 1; }
if ! "${WR[@]}" pages project list 2>/dev/null | grep -qw "$PROJECT"; then
  "${WR[@]}" pages project create "$PROJECT" --production-branch main
fi
"${WR[@]}" pages deploy site --project-name "$PROJECT" --branch main --commit-dirty=true
