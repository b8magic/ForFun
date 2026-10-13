#!/bin/bash
# Native smoke test on an iOS Simulator (macOS + Xcode; used by .github/workflows/ios-simulator.yml).
#   tools/sim-smoke.sh <path/to/Serie.app> <output dir>
# Boots an iPhone simulator, installs the Release simulator build, launches it once on its own,
# then runs the Maestro flows in maestro/ while recording the screen. Leaves in <output dir>:
# serie-simulator.mp4, screens/*.png, app.log, maestro-*.xml, maestro/<flow>/ (Maestro logs), crashes/, summary.md.
# Exit code is non-zero if the app did not stay up or a flow failed; the outputs are kept either way.
set -uo pipefail
cd "$(dirname "$0")/.."
APP=$1
OUT=$2
BUNDLE=app.serie.ios
FLOWS=$PWD/maestro
mkdir -p "$OUT/screens" "$OUT/crashes" "$OUT/maestro"
SUMMARY=$OUT/summary.md
: >"$SUMMARY"
FAIL=0
say() { echo "$*"; echo "$*" >>"$SUMMARY"; }

# newest iOS runtime, an iPhone Pro if there is one
read -r UDID NAME < <(xcrun simctl list devices available -j | python3 -c '
import json, re, sys
data = json.load(sys.stdin)["devices"]
def ver(rt):
    m = re.search(r"iOS-(\d+)-(\d+)", rt)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
rts = sorted((rt for rt in data if "iOS" in rt and data[rt]), key=ver, reverse=True)
for rt in rts:
    phones = [d for d in data[rt] if d["name"].startswith("iPhone")]
    if not phones:
        continue
    phones.sort(key=lambda d: (" Pro" not in d["name"] or "Max" in d["name"], d["name"]), reverse=False)
    d = phones[0]
    print(d["udid"], d["name"] + " · " + rt.split(".")[-1])
    break
')
[ -n "${UDID:-}" ] || { say "No iPhone simulator available"; exit 1; }
say "- Simulator: $NAME"
xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b >/dev/null
xcrun simctl status_bar "$UDID" override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 2>/dev/null || true
xcrun simctl install "$UDID" "$APP"
# the calendar flow uses the simulator's own (empty) calendars; Maestro also grants permissions on launch
xcrun simctl privacy "$UDID" grant calendar "$BUNDLE" 2>/dev/null || true

xcrun simctl io "$UDID" recordVideo --codec=h264 --force "$OUT/serie-simulator.mp4" >"$OUT/recordVideo.log" 2>&1 &
REC=$!
xcrun simctl spawn "$UDID" log stream --style compact --level info --predicate 'process == "Serie"' >"$OUT/app.log" 2>&1 &
LOGP=$!
stop_capture() {
  kill -INT "$REC" 2>/dev/null
  for _ in $(seq 1 40); do kill -0 "$REC" 2>/dev/null || break; sleep 0.25; done
  kill "$LOGP" 2>/dev/null
}
trap stop_capture EXIT
sleep 2

# 1. plain launch, no test driver: does it start and stay up?
touch "$OUT/.start"
xcrun simctl launch "$UDID" "$BUNDLE"
sleep 15
xcrun simctl io "$UDID" screenshot "$OUT/screens/00-launch.png" >/dev/null 2>&1 || true
if pgrep -f "Serie.app/Serie" >/dev/null; then
  say "- Launch: running after 15 s"
else
  say "- Launch: **the app is not running 15 s after launch**"
  FAIL=1
fi
xcrun simctl terminate "$UDID" "$BUNDLE" 2>/dev/null || true

# 2. Maestro flows (separate runs; dependent fixtures must pass before use)
PREV=$(python3 -c 'import datetime as d; print((d.date.today().replace(day=1) - d.timedelta(days=1)).strftime("%Y-%m"))')
PREV_YEAR=${PREV:0:4}
PREV_MONTH=$((10#${PREV:5:2}))

# The fixture created by flow01 belongs only to this fresh simulator install.
# Reconstruct v1 from the additive v2 schema, then let the ACTUAL native driver
# migrate it on app boot. Compare every original table, including nulls and ids.
native_upgrade() {
  local upgrade_container upgraded=0
  xcrun simctl terminate "$UDID" "$BUNDLE" >>"$OUT/native-upgrade.log" 2>&1 || return 1
  upgrade_container=$(xcrun simctl get_app_container "$UDID" "$BUNDLE" data) || return 1
  python3 tools/native-upgrade.py prepare --container "$upgrade_container" --out "$OUT" \
    --previous-month "$PREV" --source-commit "$(git rev-parse HEAD)" --bundle "$BUNDLE" \
    >>"$OUT/native-upgrade.log" 2>&1 || return 1
  xcrun simctl launch "$UDID" "$BUNDLE" >>"$OUT/native-upgrade.log" 2>&1 || return 1
  for _ in $(seq 1 60); do
    if python3 tools/native-upgrade.py status --out "$OUT"; then upgraded=1; break; fi
    sleep 0.5
  done
  [ "$upgraded" = 1 ] || { echo "Native migration did not reach v2 in 30 seconds" >>"$OUT/native-upgrade.log"; return 1; }
  maestro --device "$UDID" test "$FLOWS/subflows/upgrade-ready.yaml" -e PREV="$PREV" -e PREV_YEAR="$PREV_YEAR" -e PREV_MONTH="$PREV_MONTH" \
    --format junit --output "$OUT/maestro-native-upgrade.xml" \
    --test-output-dir "$OUT/maestro/native-upgrade" --debug-output "$OUT/maestro/native-upgrade/debug" --flatten-debug-output \
    >>"$OUT/native-upgrade.log" 2>&1 || return 1
  xcrun simctl terminate "$UDID" "$BUNDLE" >>"$OUT/native-upgrade.log" 2>&1 || return 1
  python3 tools/native-upgrade.py verify --out "$OUT" >>"$OUT/native-upgrade.log" 2>&1
}

if command -v maestro >/dev/null; then
  say "- Maestro $(maestro --version 2>/dev/null | tail -1) · PREV=$PREV"
  LOG_FIXTURE_READY=0
  MAP_FIXTURE_READY=0
  for flow in "$FLOWS"/[0-9]*.yaml; do
    name=$(basename "$flow" .yaml)
    case "$name" in
      02-details-map)
        if [ "$LOG_FIXTURE_READY" != 1 ]; then
          say "- $name: **NOT_RUN** (required 01-log fixture and native upgrade did not pass)"
          FAIL=1
          continue
        fi
        ;;
      03-calendar|04-settings-periods)
        if [ "$LOG_FIXTURE_READY" != 1 ]; then
          say "- $name: **NOT_RUN** (required 01-log fixture and native upgrade did not pass)"
          FAIL=1
          continue
        fi
        if [ "$MAP_FIXTURE_READY" != 1 ]; then
          say "- $name: **NOT_RUN** (required 02-details-map fixture did not pass)"
          FAIL=1
          continue
        fi
        ;;
    esac
    t0=$(date +%s)
    if maestro --device "$UDID" test "$flow" -e PREV="$PREV" -e PREV_YEAR="$PREV_YEAR" -e PREV_MONTH="$PREV_MONTH" --format junit --output "$OUT/maestro-$name.xml" \
      --test-output-dir "$OUT/maestro/$name" --debug-output "$OUT/maestro/$name/debug" --flatten-debug-output; then
      say "- $name: passed ($(( $(date +%s) - t0 )) s)"
      if [ "$name" = "01-log" ]; then
        if native_upgrade; then
          say "- Native upgrade v1 → v2: passed (all six original tables unchanged; SQLite integrity + foreign keys valid)"
          LOG_FIXTURE_READY=1
        else
          say "- Native upgrade v1 → v2: **failed** (see native-upgrade.log and snapshots)"
          FAIL=1
          xcrun simctl io "$UDID" screenshot "$OUT/screens/fail-native-upgrade.png" >/dev/null 2>&1 || true
        fi
      elif [ "$name" = "02-details-map" ]; then
        MAP_FIXTURE_READY=1
      fi
    else
      say "- $name: **failed** ($(( $(date +%s) - t0 )) s)"
      FAIL=1
      if [ "$name" = "01-log" ]; then say "- Native upgrade: **not run**, prerequisite fresh fixture failed"; fi
      xcrun simctl io "$UDID" screenshot "$OUT/screens/fail-$name.png" >/dev/null 2>&1 || true
    fi
  done
else
  say "- Maestro: not installed, flows skipped"
  FAIL=1
fi

# takeScreenshot files (and failure screenshots) land in each flow's output dir; gather them
for d in "$OUT"/maestro/*/; do
  find "$d" -name '*.png' -print0 2>/dev/null | while IFS= read -r -d '' f; do cp "$f" "$OUT/screens/$(basename "$d")--$(basename "$f")"; done
done

# A bounded set of small previews is also available through the text logs API;
# full PNGs and video remain in the artifact. Diagnostics cannot alter the gate.
python3 tools/print-native-screens.py "$OUT/screens" || say "- Native previews unavailable"

# the raw recording is ~1 MB/s at full resolution: stop it and keep a small copy (about 540 px wide)
stop_capture
trap - EXIT
V=$OUT/serie-simulator.mp4
if [ -s "$V" ]; then
  # macOS runners have no ffmpeg: a static build from PyPI (imageio-ffmpeg) in a throwaway venv
  FF=$(command -v ffmpeg || true)
  if [ -z "$FF" ] && python3 -m venv "$OUT/.ffvenv" >/dev/null 2>&1 && "$OUT/.ffvenv/bin/pip" -q install imageio-ffmpeg >/dev/null 2>&1; then
    FF=$("$OUT/.ffvenv/bin/python" -c 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || true)
  fi
  if [ -n "$FF" ]; then
    "$FF" -v error -y -i "$V" -vf "scale=540:-2,fps=30" -c:v libx264 -preset veryfast -crf 28 -an "$OUT/small.mp4" || say "- ffmpeg failed"
  else
    avconvert --preset Preset1920x1080 --source "$V" --output "$OUT/small.mp4" || say "- avconvert failed"
  fi
  rm -rf "$OUT/.ffvenv"
  if [ -s "$OUT/small.mp4" ]; then mv "$OUT/small.mp4" "$V"; fi
  say "- Video: $(du -h "$V" | cut -f1)"
fi

# crash reports written since the first launch (simulator apps report to the host)
find "$HOME/Library/Logs/DiagnosticReports" -name 'Serie*' -newer "$OUT/.start" -exec cp {} "$OUT/crashes/" \; 2>/dev/null
N=$(find "$OUT/crashes" -type f | wc -l | tr -d ' ')
if [ "$N" != "0" ]; then
  say "- Crash reports: **$N**"
  FAIL=1
else
  say "- Crash reports: none"
fi
exit $FAIL
