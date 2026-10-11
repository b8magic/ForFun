#!/bin/bash
# Live loop on a Mac: changes pushed to this branch show up in the iOS Simulator within seconds.
#   cd serie && tools/live.sh             # iOS Simulator
#   cd serie && tools/live.sh --device    # iPhone on the cable (Xcode → Settings → Accounts: your Apple ID)
# What it does:
#   1. builds and installs the development app "Serie Dev" (bundle id app.serie.ios.dev, next to an
#      installed release) the first time, and again whenever native inputs changed: dependencies,
#      app.json / app.config.ts, fonts, icon, splash;
#   2. starts the Metro bundler: on every code change the app updates by itself (Fast Refresh);
#   3. every 5 s pulls new commits of the current branch, fast-forward only: local edits and local
#      commits are never touched (the pull just stops, with a warning).
# Ctrl+C stops everything.
set -euo pipefail
cd "$(dirname "$0")/.."
export APP_VARIANT=development

[ "$(uname)" = Darwin ] || { echo "Serve un Mac con Xcode."; exit 1; }
V=$(xcodebuild -version 2>/dev/null | awk 'NR==1{print $2}')
case "$V" in
  26.[4-9]* | 26.[1-9][0-9]* | 2[7-9].*) ;;
  *) echo "Serve Xcode 26.4 o successivo (trovato: ${V:-nessuno}). Se è installato: sudo xcode-select -s /Applications/Xcode.app"; exit 1 ;;
esac
command -v node >/dev/null || { echo "Serve Node.js 22.13+ (https://nodejs.org)."; exit 1; }
command -v pod >/dev/null || { echo "Serve CocoaPods: brew install cocoapods"; exit 1; }

BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" != HEAD ] || { echo "Nessun branch attivo: git checkout claude/corduroy-motion-trailer"; exit 1; }
STAMP=ios/.serie-live-native

# everything that ends up in the native project; a change here needs a new build
native_hash() {
  { echo "$APP_VARIANT"; cat package.json package-lock.json app.json app.config.ts assets/icon.png assets/splash-icon.png assets/fonts/* 2>/dev/null || true; } | shasum | cut -d' ' -f1
}

BLOCKED="⚠︎ Ci sono modifiche nuove ma non le scarico: hai modifiche locali che le toccano (git status). Il resto continua."
# pull new commits: prints them and returns 0 if HEAD moved, 1 if nothing new, 2 if blocked by local changes
pull() {
  local before after
  before=$(git rev-parse HEAD)
  git fetch -q origin "$BRANCH" 2>/dev/null || return 1
  if ! git merge -q --ff-only "origin/$BRANCH" >/dev/null 2>&1; then
    [ "$(git rev-list --count "HEAD..origin/$BRANCH" 2>/dev/null || echo 0)" = "0" ] && return 1
    return 2
  fi
  after=$(git rev-parse HEAD)
  [ "$before" != "$after" ] || return 1
  git log --reverse --format='  ⟳ %s' "$before..$after"
}

if out=$(pull); then echo "$out"; else [ "$?" != 2 ] || echo "$BLOCKED"; fi

if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$(native_hash)" ]; then
  echo "Preparo l'app di sviluppo \"Serie Dev\" (la prima volta 5–10 minuti)…"
  npm ci --no-audit --no-fund
  npx expo prebuild --platform ios --clean
  npx expo run:ios --no-bundler ${1+"$@"}
  native_hash >"$STAMP"
fi

(
  warned=
  while sleep 5; do
    if out=$(pull); then
      warned=
      echo
      echo "$out"
      osascript -e "display notification \"$(echo "$out" | tail -1 | sed 's/^ *⟳ //; s/"/'"'"'/g')\" with title \"Serie Dev aggiornata\"" >/dev/null 2>&1 || true
      if [ "$(native_hash)" != "$(cat "$STAMP" 2>/dev/null)" ]; then
        echo "⚠︎ Questa modifica tocca la parte nativa: premi Ctrl+C e rilancia tools/live.sh (ricompila l'app)."
      fi
    elif [ "$?" = 2 ] && [ -z "$warned" ]; then
      echo "$BLOCKED"
      warned=1
    fi
  done
) &
LOOP=$!
trap 'kill "$LOOP" 2>/dev/null || true' EXIT

echo "Aggiornamenti automatici attivi su $BRANCH. Ctrl+C per uscire."
if [ "${1:-}" = "--device" ]; then
  npx expo start --dev-client # on the iPhone: open Serie Dev (same Wi-Fi) or scan the QR code
else
  npx expo start --dev-client --ios
fi
