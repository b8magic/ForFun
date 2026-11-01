# corduroy — trailer source

The reproducible source for the 15.6-second motion trailer (1080×1920, 60 fps) of
**corduroy**, a concept surf log. Every frame is procedural: no footage, no
stock assets, no pre-rendered layers. The score is synthesized from the same cue sheet.

```
./build.sh            # frames → score → ../deliverables/corduroy_trailer_1080x1920.mp4
```

Requirements: Node 20+, Python 3 with numpy, ffmpeg, and Chromium via Playwright.
Set `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if a Chromium build is already installed.
A full build takes about 5 minutes on 4 cores.

## How it works

| Layer | File | What it does |
|---|---|---|
| Renderer | `render.mjs` | Serves `src/`, drives headless Chromium, calls `renderFrame(t)` and writes PNGs in parallel workers |
| Frame | `src/main.js` | Subframe motion blur (running average across a 180° shutter), then the WebGL finishing pass |
| Finishing | `src/lib/post.js` | Bloom, zoom blur, chromatic aberration, vignette, grain, flash |
| Type | `src/lib/text.js` | HarfBuzz shaping + glyph outlines flattened to polylines, so variable-font letters can stripe, stretch and warp |
| Grammar | `src/lib/util.js` | Ocean easing vocabulary (swell, build, crest, break, flow, settle), seeded randomness |
| Timeline | `src/film/timeline.js` | Every cue, shared by picture and sound |
| Acts | `src/film/act12.js` … `act56.js` | I–II swell field + identity disc, III living calendar, IV breaking wave + barrel, V–VI history + logotype |
| Data | `src/film/data.js` | Deterministic illustrative session history; all on-screen numbers are computed from it |
| Score | `audio/sound.py` | numpy synthesis: drones, droplets, risers, impact, reverb, master |

Every visual is a pure function of time, so any frame can be rendered alone:

```
node render.mjs --stills 6.9,8.45 --out out/stills --k 1     # quick stills, no motion blur
./sheet.sh out/sheet "4.2,4.6,5.0" 3                          # stills + contact sheet
```

## Notes

- Session data is illustrative and labelled as such on the end card.
- Fonts: Roboto Flex and Martian Mono, both SIL Open Font License (`fonts/OFL-*.txt`).
- See `DESIGN_LANGUAGE.md` for the identity and motion reference.
