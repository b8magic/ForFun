#!/bin/bash
# Build the web verification bundle (Skia via CanvasKit, sql.js persistence).
#   tools/build-web.sh         → dist-web     (real providers; calendars unavailable on web)
#   tools/build-web.sh --e2e   → dist-web-e2e (adds the in-memory test calendars, src/calendar/memory.ts)
set -e
cd "$(dirname "$0")/.."
OUT=dist-web
LOG=/tmp/claude-0/-home-user-ForFun/95d9cc13-7e3c-5b9b-9777-89259157d415/scratchpad/export.log
mkdir -p "$(dirname "$LOG")"
if [ "$1" = "--e2e" ]; then
  OUT=dist-web-e2e
  export EXPO_PUBLIC_SERIE_E2E_CALENDAR=1
fi
rm -rf "$OUT"
npx expo export --platform web --output-dir "$OUT" --clear >"$LOG" 2>&1 || { tail -40 "$LOG"; exit 1; }
node tools/copy-wasm.mjs && cp public/*.wasm "$OUT"/
echo "web build ok → $OUT"
