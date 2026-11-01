#!/usr/bin/env bash
# Reproduce the trailer from source: frames → score → MP4.
# Requires: node 20+, python3 + numpy, ffmpeg, Chromium (Playwright).
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
WORKERS=${WORKERS:-4}
rm -rf out/frames
node render.mjs --from 0 --to 15.6 --fps 60 --workers "$WORKERS" --out out/frames
node audio/cues.mjs > audio/cues.json
python3 audio/sound.py
mkdir -p ../deliverables
ffmpeg -hide_banner -loglevel error -y -framerate 60 -i out/frames/f_%05d.png -i out/score.wav \
  -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -level 4.2 -x264-params aq-mode=3 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest \
  ../deliverables/corduroy_trailer_1080x1920.mp4
echo "→ ../deliverables/corduroy_trailer_1080x1920.mp4"
