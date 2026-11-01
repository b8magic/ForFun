#!/bin/bash
# Live loop on a Mac: changes pushed to this branch show up in the iOS Simulator within seconds.
#   cd serie && tools/live.sh             # iOS Simulator
#   cd serie && tools/live.sh --device    # iPhone on the cable and on the same Wi-Fi as the Mac
# What it does:
#   1. generates the iOS project of the development app "Serie Dev" (bundle id app.serie.ios.dev,
#      next to an installed release) the first time, and again whenever native inputs change:
#      dependencies, app.json / app.config.ts, fonts, icon, splash;
#   2. builds (incrementally) and installs Serie Dev on the chosen Simulator or iPhone, every run;
#   3. starts the Metro bundler: on every code change the app updates by itself (Fast Refresh);
#   4. every 5 s pulls new commits of the current branch, fast-forward only: local edits, local
#      commits and other branches are never touched (updates pause, with a message, instead).
# The repository is private: log in once with the GitHub CLI (brew install gh; gh auth login).
# Ctrl+C stops everything.
set -euo pipefail
cd "$(dirname "$0")/.."
export APP_VARIANT=development
export GIT_TERMINAL_PROMPT=0 # never ask for a password, least of all from the background loop

[ "$(uname)" = Darwin ] || { echo "Serve un Mac con Xcode."; exit 1; }
V=$(xcodebuild -version 2>/dev/null | awk 'NR==1{print $2}' || true)
case "$V" in
  26.[4-9]* | 26.[1-9][0-9]* | 2[7-9].*) ;;
  *) echo "Serve Xcode 26.4 o successivo (trovato: ${V:-nessuno}). Se è installato: sudo xcode-select -s /Applications/Xcode.app"; exit 1 ;;
esac
command -v node >/dev/null || { echo "Serve Node.js 22.13+ (https://nodejs.org)."; exit 1; }
command -v pod >/dev/null || { echo "Serve CocoaPods: brew install cocoapods"; exit 1; }

BRANCH=$(git symbolic-ref -q --short HEAD || true)
[ -n "$BRANCH" ] || { echo "Nessun branch attivo: git checkout claude/corduroy-motion-trailer"; exit 1; }
if ! git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null 2>&1; then
  echo "Non riesco a leggere il branch $BRANCH da GitHub."
  echo "Il repository è privato: accedi una volta con  gh auth login  (GitHub CLI: brew install gh), poi rilancia."
  exit 1
fi
PREP=ios/.serie-live-native # hash of the native inputs ios/ was generated from (prebuild --clean deletes it)

# everything that ends up in the native project; a change here needs a new iOS project
native_hash() {
  { echo "$APP_VARIANT"; cat package.json package-lock.json app.json app.config.ts assets/icon.png assets/splash-icon.png assets/fonts/* 2>/dev/null || true; } | shasum | cut -d' ' -f1
}

# macOS notification; the text goes in as an argument, so quotes and backslashes need no escaping
note() {
  osascript -e 'on run argv' -e 'display notification (item 1 of argv) with title (item 2 of argv)' -e 'end run' "$1" "$2" >/dev/null 2>&1 || true
}

# Pull new commits of $BRANCH. Prints them and returns 0 if HEAD moved; otherwise
# 1 nothing new, 2 local edits in the way, 3 histories diverged, 4 not on $BRANCH or git busy, 5 fetch failed.
pull() {
  local before remote after g
  [ "$(git symbolic-ref -q --short HEAD 2>/dev/null || true)" = "$BRANCH" ] || return 4
  g=$(git rev-parse --git-dir)
  if [ -d "$g/rebase-merge" ] || [ -d "$g/rebase-apply" ] || [ -f "$g/MERGE_HEAD" ] || [ -f "$g/CHERRY_PICK_HEAD" ] || [ -f "$g/BISECT_LOG" ]; then
    return 4
  fi
  git fetch -q origin "$BRANCH" 2>/dev/null || return 5
  before=$(git rev-parse HEAD)
  remote=$(git rev-parse "origin/$BRANCH")
  [ "$remote" != "$before" ] || return 1
  if git merge-base --is-ancestor "$remote" HEAD; then return 1; fi # only local commits ahead
  git merge-base --is-ancestor HEAD "$remote" || return 3
  git -c merge.autoStash=false merge -q --ff-only "$remote" >/dev/null 2>&1 || return 2
  after=$(git rev-parse HEAD)
  git log --reverse --format='  ⟳ %s' "$before..$after"
}

paused() {
  case "$1" in
    2) echo "Ci sono modifiche nuove ma non le scarico: hai modifiche locali nei file che cambiano (git status)." ;;
    3) echo "Il tuo branch e quello su GitHub si sono separati (commit locali o storia riscritta): git status. Per allinearti a GitHub: git reset --keep origin/$BRANCH" ;;
    4) echo "Aggiornamenti in pausa: non sei su $BRANCH, oppure git è a metà di un'operazione (rebase, merge…)." ;;
    5) echo "Non riesco a contattare GitHub (rete o accesso). Riprovo da solo." ;;
  esac
}

if out=$(pull); then echo "$out"; fi

if [ ! -f "$PREP" ] || [ "$(cat "$PREP")" != "$(native_hash)" ]; then
  echo "Preparo il progetto iOS di \"Serie Dev\" (la prima volta 5–10 minuti)…"
  npm ci --no-audit --no-fund
  npx expo prebuild --platform ios --clean
  native_hash >"$PREP"
fi
echo "Compilo e installo Serie Dev…"
if ! npx expo run:ios --no-bundler ${1+"$@"}; then
  if [ "${1:-}" = "--device" ]; then
    echo "Se Serie Dev è installata ma non si apre: sull'iPhone Impostazioni → Privacy e sicurezza → Modalità sviluppatore (si riavvia),"
    echo "poi Generali → VPN e gestione dispositivi → il tuo Apple ID → Autorizza. Poi rilancia tools/live.sh."
  fi
  exit 1
fi
if ! git diff --quiet -- package.json app.json 2>/dev/null; then
  echo "⚠︎ Durante la compilazione è cambiato package.json o app.json (per esempio il Team di firma)."
  echo "  Finché resta così, le modifiche a quei file non arrivano: git diff, poi git checkout -- package.json app.json"
fi

(
  last=
  fails=0
  while sleep 5; do
    if out=$(pull); then
      last=
      fails=0
      echo
      echo "$out"
      if [ "$(native_hash)" != "$(cat "$PREP" 2>/dev/null || true)" ]; then
        echo "⚠︎ Questa modifica tocca la parte nativa: premi Ctrl+C e rilancia tools/live.sh (ricompila l'app)."
        note "Serve ricompilare: Ctrl+C e rilancia tools/live.sh" "Serie Dev"
      else
        note "$(printf '%s\n' "$out" | tail -n 1 | sed 's/^ *⟳ //')" "Serie Dev aggiornata"
      fi
    else
      rc=$?
      if [ "$rc" = 5 ]; then fails=$((fails + 1)); else fails=0; fi
      if [ "$rc" = 1 ]; then last=; fi # in step again: report the next pause too
      # report each pause once (a fetch failure after 30 s), and again only after updates resumed
      if { [ "$rc" -ge 2 ] && [ "$rc" -le 4 ]; } || [ "$fails" = 6 ]; then
        if [ "$last" != "$rc" ]; then
          msg=$(paused "$rc")
          echo
          echo "⚠︎ $msg"
          note "$msg" "Serie Dev: aggiornamenti fermi"
          last=$rc
        fi
      fi
    fi
  done
) &
LOOP=$!
trap 'kill "$LOOP" 2>/dev/null || true' EXIT

echo "Aggiornamenti automatici attivi su $BRANCH. Ctrl+C per uscire."
if [ "${1:-}" = "--device" ]; then
  npx expo start --dev-client # on the iPhone: open Serie Dev (same Wi-Fi as the Mac) or scan the QR code
else
  npx expo start --dev-client --ios
fi
