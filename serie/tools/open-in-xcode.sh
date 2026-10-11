#!/bin/bash
# On a Mac: generate the native iOS project and open it in Xcode, ready to Run on a simulator or an iPhone.
#   cd serie && tools/open-in-xcode.sh
# The Run action is switched to Release, so the JS bundle is embedded and no Metro bundler is needed
# (like the IPA). ios/ is generated (Continuous Native Generation): change app.json / app.config.ts,
# not the Xcode project, because the next run rebuilds ios/ from scratch.
set -euo pipefail
cd "$(dirname "$0")/.."

[ "$(uname)" = Darwin ] || { echo "Serve un Mac con Xcode."; exit 1; }
V=$(xcodebuild -version 2>/dev/null | awk 'NR==1{print $2}')
case "$V" in
  26.[4-9]* | 26.[1-9][0-9]* | 2[7-9].*) ;;
  *) echo "Serve Xcode 26.4 o successivo (trovato: ${V:-nessuno}). Se è installato: sudo xcode-select -s /Applications/Xcode.app"; exit 1 ;;
esac
command -v node >/dev/null || { echo "Serve Node.js 22.13+ (https://nodejs.org)."; exit 1; }
command -v pod >/dev/null || { echo "Serve CocoaPods: brew install cocoapods"; exit 1; }

npm ci --no-audit --no-fund
npx expo prebuild --platform ios --clean --no-install
(cd ios && pod install)

WS=$(ls -d ios/*.xcworkspace | head -1)
SCHEME_FILE="ios/$(basename "$WS" .xcworkspace).xcodeproj/xcshareddata/xcschemes/$(basename "$WS" .xcworkspace).xcscheme"
[ -f "$SCHEME_FILE" ] && perl -0pi -e 's/(<LaunchAction\s+buildConfiguration = ")Debug"/$1Release"/' "$SCHEME_FILE"

echo
echo "Apro $WS in Xcode."
echo "Simulatore: scegli un iPhone in alto e premi ▶︎ (Cmd+R)."
echo "iPhone vero: collegalo, selezionalo, poi target Serie → Signing & Capabilities → Team = il tuo Apple ID"
echo "(con un Apple ID gratuito cambia anche il Bundle Identifier, es. app.serie.ios.tuonome; l'app dura 7 giorni)."
open "$WS"
