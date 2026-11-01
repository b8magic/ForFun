# SERIE-APP

Serie, a motion-first activity log for iPhone, and *corduroy*, the motion trailer its visual identity comes from.

| Folder | What it is |
|---|---|
| [`serie/`](serie/README.md) | The native iOS app (Expo / React Native). Run, build and status: `serie/README.md` |
| [`trailer/`](trailer/README.md) | Reproducible source of the corduroy trailer (`trailer/build.sh`) and its design language (`trailer/DESIGN_LANGUAGE.md`) |
| `deliverables/` | The rendered trailer, style frames and score |

## corduroy — motion trailer

A 15.6-second vertical motion-graphics trailer (1080×1920, 60 fps) for a concept surf log,
generated entirely in code, with a synthesized score.

- `deliverables/corduroy_trailer_1080x1920.mp4` — the film
- `deliverables/styleframes/` — eight full-resolution style frames
- `deliverables/corduroy_score_48k.wav` — the score
- `trailer/` — reproducible source (`trailer/build.sh`), see `trailer/README.md`
- `trailer/DESIGN_LANGUAGE.md` — identity and motion reference

Session data shown in the film is illustrative.

The GitHub Actions workflows for the iOS builds stay in the repository root (`.github/workflows/`, GitHub only reads them there) and work in `SERIE-APP/serie`.
