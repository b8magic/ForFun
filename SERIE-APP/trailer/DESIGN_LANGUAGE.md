# corduroy — identity & motion language

Surfers call clean, evenly spaced swell *corduroy*. The identity turns that image
into an interface. **Each week is a swell line, each session is a crest on it,
and saving makes the lines break like a wave.**

## Primitives

| Primitive | Meaning | Behavior |
|---|---|---|
| **Line** | A swell, a week, a month: a unit of time drawn as water | Carries every other object; never static, never noisy |
| **Crest** | A selected day | Press-in dip, then a damped rise (`settle`, ζ ≈ 0.36) |
| **Dot** | One session | Always Flare; rides whatever line carries it |
| **Disc** | An activity | A circular window onto that activity's motion pattern (Surf: waves, Run: strided dashes, Train: pulsing bars, Travel: drifting heading) |
| **Ring** | Touch, or a recorded session | A disturbance spreading outward |

## Palette

| Token | Hex | Role |
|---|---|---|
| Ink | `#0C0B09` | Night: anticipation and interaction |
| Foam | `#EEE8DA` | Lines, numerals and labels on Ink |
| Bone | `#ECE5D6` | Calm after the break: history drawn in ink |
| Flare | `#FF4D1F` | Sessions only: selected day, saved dot, the energy line |
| Activity hues | `#C9F06A` Run · `#B9A8FF` Train · `#F3C46E` Travel | Identity dots only |

Blue never carries the identity. The ocean comes through as line density, curvature and release.

## Type

- **Roboto Flex** (display, variable): width 25–151 and weight 100–1000 act as one gesture.
  Tension compresses the word (narrow and heavy); release opens it (wide and light). Months use
  width 58 / weight 300, counters roll wide and land condensed, and the logotype uses weight 880 with stripes.
- **Martian Mono** (data, width 87.5): dates, counts, weekday headers, HUD, tagline. Tabular figures.

## Composition (1080 × 1920)

80 px side margins · 7-column day grid (131 px) · week-lines 170 px apart · HUD on a 64 px margin ·
Save control 936 × 128 at the thumb line · history ridgelines from x = 196 to 900 with labels outside.

## Motion grammar

| Phase | Curve | Used for |
|---|---|---|
| Swell | `−(cos πt − 1)/2` | Camera cranes, slow ambient energy |
| Build | `t³` | Drawback before the break, accumulation |
| Crest | back-out, c = 1.25 | Lines landing into rows, arriving and hanging |
| Break | expo in-out | The release |
| Flow | `1 − (1 − t)⁵` | Type and lines carried into place |
| Settle | damped spring | Crests, landings, the final period |

Rules:

1. **One physics.** Lines, type, the Save liquid and the history all respond to the same displacement field.
2. **Object permanence.** Disc stripes become week-lines, week-lines become the wave, spray becomes the months, and selected dots land in history.
3. **Stillness earns release.** Readable moments hold still; the break gets 8× motion blur, aberration and shake.
4. **Type behaves like water.** Letters surface from a waterline, condense under tension, open on release, and stripe into the logo.
5. **Honest numbers.** Every figure is computed from records. Unknown durations stay unknown ("duration on 265 of 386").
6. **Interruptible.** Every motion is a function of state and time, so an interruption continues from the current water.

## Film structure (15.6 s)

| Act | Time | Product moment |
|---|---|---|
| 01 Swell | 0.00–2.20 | Horizon line → perspective swell field, flare sun |
| 02 Build | 2.20–4.40 | Crane overhead → Surf disc; identity flick Surf/Run/Train/Travel; dock to header |
| 03 Crest | 4.40–7.22 | Disc unfolds into October; taps on 3, 6, 7, 10; Save fills |
| 04 Break | 7.22–9.34 | Save → drawback → rising curl → barrel → impact |
| 05 Flow | 9.34–12.65 | White water settles into months; dots land (Oct 2 → 6); zoom to 2019–2026; counter to 386 |
| 06 Calm | 12.65–15.60 | Ridges flatten → striped logotype → period → tagline |
