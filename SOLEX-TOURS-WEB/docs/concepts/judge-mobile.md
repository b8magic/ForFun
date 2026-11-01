# Judge: Mobile UX, Accessibility & Feasibility + Persona

**Lens:** I'm a senior mobile UX and accessibility engineer. I also role-play the persona: a 27-year-old backpacker in an Antigua hostel at 10 pm, on a mid-range Android over 4G, comparing three agencies before booking tomorrow's hike.

**Winner: B · Hecho en La Soledad (8.0)**, narrowly ahead of D · Contour (7.4). C · Summit Pass scores 6.6 and A · Front Row scores 6.0.

## How I judged

- I looked at every screenshot: all m-first, m-full, d-first and d-full captures, plus the dock and sheet states. I sliced the full-page captures into readable strips.
- I read all four concept.md files and checked the CSS and JS for scroll handlers, blur/blend/mask effects and reduced-motion handling.
- I ran a scripted audit (Playwright with Chrome 153) on each prototype at 390×844, DPR 2, as a mobile touch device:
  - where each key answer first appears, measured in screens from the top;
  - tap targets under 24 and 44 px;
  - visible text under 12 px;
  - fixed/sticky UI as a share of the viewport mid-page;
  - bytes on first load and after a full scroll;
  - focus rings on the first six Tab stops;
  - running animations and video autoplay with `prefers-reduced-motion: reduce`.
- Contrast was computed with the WCAG formula.

### Measured data (mobile, 390×844)

| | A Front Row | B Made local | C Summit Pass | D Contour |
|---|---|---|---|---|
| Page length (screens) | 20.8 | 18.9 | 19.1 | **17.9** |
| Price first seen (screen) | 0.88 | 0.76 | **0.68** | 0.77 |
| Pickup cafés first seen | 2.13 | 6.75 | 6.26 | **0.91** |
| "Mattress / sleeping bag" | 6.43 | 6.98 | 5.22 | **1.19** |
| Full inclusions ("breakfast") | 12.23 | 7.09 (summary on screen 1) | 5.28 (summary on screen 1) | 9.19 (4-item list on screen 1) |
| Spanish/English honesty | 4.45 | **2.84** | 10.19 | 3.94 |
| Cold / warm clothes | 9.13 | 8.21 | ~5.5 | **4.82** |
| Booking from the hero CTA | Bottom sheet, 2 taps | Bottom sheet, 2 taps | **Jumps 11.4 screens** to an in-page builder (send button at 14.0) | Bottom sheet, 2 taps |
| Fixed/sticky UI mid-page | 15% (header 60 + dock 64) | 10% (dock 88) | **8%** (dock 68) | **22%** (route strip 113 + dock 77) |
| Visible text nodes < 12 px | 37 (10–11 px) | **4** (11.5 px) | 17 (11–11.5 px) | **111** (10.5–11 px) |
| Tap targets < 24 px (non-inline) | 2 labels only | 3 "Ask about this tour" links (20 px tall) | none of note | 3 footer contact links, WhatsApp numbers included (19 px tall) |
| First-load bytes | **363 KB** | 565 KB (231 KB of Google Fonts) | 461 KB | 596 KB (190 KB hero + 72 KB topo.svg) |
| Bytes after full scroll | 1,872 KB | ~730 KB | **~716 KB** | 1,502 KB |
| Reduced motion | No running animations, video paused (motion is opt-in) | Same | Same | Same |
| Focus rings on first Tab stops | All present | All present | All present | All present |
| Fuego wording vs client directive | **Mentions authorities** | **Mentions authorities** | Compliant | Compliant (with a one-flag kill switch) |

My headless frame-timing run under 4× CPU throttle was inconclusive (no GPU compositing in headless). Performance judgements below rest on payload and on which effects each concept uses.

---

## A · Front Row to Fuego (24-hour film): **6.0**

**Strengths**
- **First screen:** the best "wow" of the four. It shows the eruption, H1, Q750 ≈ US$100, "all included", and a 52 px **Book your seat** CTA in the bottom-right thumb zone, with chips (2–8 per guide · Bed at camp · 3 meals + transport).
- **Reduced motion:** the best implementation. Reveals, push-in and glow sit inside `@media (prefers-reduced-motion: no-preference)`. A 2.5 s safety net and `?static=1` force content visible. Video never autoplays.
- **Booking sheet:**
  - The ticket preview, 4 tour cards and 44 px+ stepper all have sensible defaults.
  - The Send bar is sticky and shows the **total on the button** ("Send on WhatsApp | Q1,500").
  - The message quotes the website price.
- **Scene selection** (tap the clock pill) is the only mobile jump menu in the set. It's useful on a 21-screen page.
- Pickup cafés appear early (screen 2.1), with an honest "around 8:00 AM, confirmed on WhatsApp".

**Weaknesses**
- **Slowest answers for the persona.** The narrative order pushes the full included list and box office to **screen 12–13 of 21**. "It gets properly cold" is at screen 9 and the 4 L water rule at 13.8. At 10 pm I give up before I find out whether breakfast is included.
- **Hidden navigation.** The jump menu hides behind a "Day 1 21:40" clock pill (134×38). Nobody will guess it's navigation.
- **Highest GPU cost** for a mid-range Android:
  - the fixed header gets `backdrop-filter: blur(14px) saturate(1.2)` over photos as soon as you scroll;
  - every reveal transitions `filter: blur(6px)`;
  - a `mix-blend-mode: screen` glow breathes forever on the hero, plus an overlay grain layer;
  - phase colour cross-fades run on the fixed UI.
- **Heaviest payload (1.87 MB).** Content photos have no `srcset`: trail 255 KB, trailhead 204 KB, campfire 193 KB, all served to a 390 px screen.
- **Tiny text:** 37 visible nodes at 10–11 px mono, including "Overnight · all included" (10 px) next to the price and the ticket field labels (10 px).
- **Theme and length:** dark night sections and shifting colour temperature are weaker in daylight. On mobile there are big empty gaps between scenes.
- **Fuego FAQ** says "rules set by Guatemala's authorities". That contradicts the client directive (no statements about laws, permits or authorities).

## B · Hecho en La Soledad (Made by locals): **8.0 (winner)**

**Strengths**
- **Most legible concept.**
  - Body is 17–17.5 px Figtree on warm cream; secondary ink is 7.4:1.
  - Only **4** visible text nodes are under 12 px (11.5 px).
  - The CTA is white on #A8232B (7.1:1) with a stitched outline that survives glare.
  - It reads best in sunlight and on a dim screen at night.
- **First screen does the job:**
  - "Sleep facing Fuego." and Q750 ≈ US$100 with "transport, guide, entry, cabin & 3 meals";
  - a full-width 56 px **Check a date on WhatsApp** at y = 721–777, right in the thumb zone;
  - a "See what's included" jump and "You write to Alexander directly".
- **Best booking sheet for a phone:**
  - a native `<select>` for the tour (the fastest control on Android);
  - big − / + buttons, 2 radio cards for pickup, toggle chips;
  - a **live WhatsApp bubble preview** with a Spanish summary line for Alexander;
  - a sticky Send button, and a **"Chat without the form"** escape hatch.
  - Focus moves into the dialog and returns to the opener.
- **Cheapest visual idea to run.** The woven motifs are about 1.7 KB of data-URI SVG, reveals use `steps()` clip-paths, and nothing blurs or blends. Every photo has `srcset`/`sizes`, and the total transfer after a full scroll is about 0.73 MB.
- **Honesty arrives early** and builds trust:
  - the Spanish/English note at screen 2.8;
  - "Our honest bit" on clear skies;
  - a "What we won't promise" card;
  - "Nights at camp are cold" in What you bring.
- The dock (88 px, "Overnight · Q750 / Check a date") hides while the booking section is on screen. When hidden it's `aria-hidden` and out of the tab order.

**Weaknesses**
- **Where to meet comes late.** The cafés first appear at **screen 6.75**, and the time is only "Morning pickup; exact time confirmed". A, C and D all say "around 8:00 AM", which is what the persona needs to plan.
- **Heaviest fonts:** about **231 KB of Google Fonts** on first load (two Fraunces files with opsz and SOFT axes, 138 KB; Caveat 73 KB; Figtree 20 KB), loaded from a third party with `display=swap`. Expect a visible font swap on 4G.
- **Hero image:** `sizes="94vw"` makes a DPR 2.6 phone fetch the 1600 w file (190 KB). The concept's claimed 111 KB applies only at DPR 2.
- **Big hero, duplicated logo.** The hero arch takes about 54% of the first screen and the logo appears twice (header plus patch). The supporting line falls below the fold, and on a 360×740 Android the CTA may as well.
- **Small targets:** the "Ask about this tour" links are 20 px tall and the footer links 40 px.
- **Handwriting for headings.** Caveat is used for real headings ("One view, three shows. No extra hike.", the sheet title "Note to Alexander"). It's harder to read at a glance.
- **No total.** The WhatsApp message and slip don't show a total. A, C and D compute one.
- **Fuego FAQ** says "Access to Fuego is set by the authorities", which breaks the client directive. It's a one-line fix.

## C · Summit Pass ("Front row to Fuego"): **6.6**

**Strengths**
- **Loud, scannable first screen.** It's a price ticket: "Q750 · US$100 per person, all in", an inclusion summary, and a 56 px full-width CTA.
- **Best dock idea.** The die-cut sun-yellow stub turns into the **live booking** once you've filled in the pass ("SUN 8 NOV · 3 PPL · Q2,250 · US$300 → Send pass"). Booking is one thumb-tap from anywhere.
- **Lightest hero:** 36 KB, preloaded with `fetchpriority=high`. Fonts are self-hosted and subset, and the effects are cheap (transform marquee, static masks, split-flap digits). Total is about 716 KB.
- The full "punched" inclusions list is at screen 5.3, with large readable rows. The "Big Antigua tour vs Solex" table is very scannable. "Getting there" works as a clear A→D route.
- The Fuego add-on is a small line (~4 h, Q300, paid at camp) with no legal wording, so it complies.

**Weaknesses**
- **Booking flow costs the persona a step.**
  - The primary CTA, "Build your Summit Pass", is jargon. It reads like a park permit.
  - It's an anchor that jumps **11.4 screens** into a dark six-step builder, and the send button sits at screen 14. The persona loses their place, and there's no bottom sheet.
  - The direct WhatsApp option is a 35 px secondary text link.
- **Contrast failure:** "EVERYTHING UP THE MOUNTAIN." is paper #F7F0E3 on periwinkle #8A9EE8, which is **2.28:1**. That fails even the 3:1 large-text threshold. The lava CTA with ink text is 4.58:1, which passes only because the text is large and bold.
- **Slow on the honest details:** the Spanish/English honesty is at screen **10.2**, pickup at 6.3, and "warm layers" at about 5.5.
- **Mono and condensed type:** much of the supporting information, including the first-screen inclusion list, is uppercase Space Mono at 11–12 px, and display text is condensed caps. Both are slower to read and weaker in sunlight.
- **Busy palette:** seven background colours (sky, navy, paper, periwinkle, ember, sun, ink) make for a lot of visual switching on a small screen.
- No "how hard is it?" answer.

## D · CONTOUR (The Right Side of the Mountain): **7.4**

**Strengths**
- **Fastest answers for the persona.** The first screen holds:
  - the claim, "Fuego, straight ahead.";
  - Q750 ≈ US$100;
  - a 4-item inclusions list;
  - a 56 px full-width CTA;
  - **both pickup cafés** (screen 0.91).

  Bedding is at 1.2 (legend), the Spanish honesty at 3.9, and cold/water at 4.8. It's the shortest page (17.9 screens) and the most "screenshot and compare" of the four.
- **Manifest sheet:** clear tour cards with price and start time, a 2-wide grid, a big stepper with a live guide count and total, a live preview, and a sticky **Open WhatsApp** button. The second number gets the same prefilled text.
- **Group gauge:** the people count is shared state, so "Ask for N people" opens the manifest prefilled.
- The Fuego add-on complies, behind a one-line `ADDONS.fuego` kill switch.

**Weaknesses**
- **Worst small-text legibility.**
  - **111** visible text nodes are 10.5–11 px mono in #4A5866, often over contour lines.
  - They include the price unit ("≈ US$100 per person"), the hero inclusions, spec-sheet keys, timetable inclusions and manifest sub-labels.
  - This is the concept most likely to wash out in sunlight.
- **Too much fixed UI on a phone.** Throughout the longest section, the sticky route strip (113 px, with `backdrop-filter: blur(8px)`) plus the dock (77 px) cover **22%** of the viewport. The decorative altimeter takes about a third of the dock's width.
- **Heaviest first load (596 KB).**
  - The hero's `srcset` descriptors are wrong (`plume-800.webp 600w`, `plume-1600.webp 1200w`), so any DPR 2 phone downloads the **190 KB** file.
  - `topo.svg` (72 KB) is used as a CSS mask on several large layers, which costs raster time on low-end GPUs.
  - Google Fonts add 169 KB (Archivo variable 88 KB, Caveat 50 KB, JetBrains Mono 31 KB).
  - The video is 630 KB and two 800 w photos are 140–150 KB each.
- **Small targets:** the footer WhatsApp numbers and Instagram link are 19 px tall.
- No "how hard is it?" answer. The cool "Swiss instrument" tone carries less warmth than B.

---

## Verdict for this lens

**B wins**, though D is the better first screen for the persona. B is the concept I'd trust to ship to a mid-range Android without a performance or legibility rescue:
- it has the best type scale, contrast and sunlight legibility;
- its visual idea costs almost nothing to run;
- its booking sheet is the best fit for a phone;
- its weak spots (late pickup info, heavy third-party fonts, oversized hero) are content and config fixes, not structural ones.

D's weaknesses are part of its identity: tiny technical mono labels, a sticky instrument strip and contour masks. Fixing them dilutes the concept.

## Best ideas from the other concepts to graft onto B

1. **From D: put the logistics on the first screen.** Directly under B's price, add a 4-item inclusions list and the line "Pickup in Antigua · Café Condesa (Parque Central) or Café La Parada (Parque La Merced) · around 8:00 AM, confirmed on WhatsApp". D shows the cafés at screen 0.9; B currently shows them at 6.75.
2. **From D: replace the 3-item ribbon with a 6-cell legend.** D's legend covers Fuego dead ahead · Sunset from camp · 2–8 per guide · Cabins set up · Sunrise summit · 100% local. Redraw the icons in B's stitch style.
3. **From C: a dock that becomes the booking.** Once the slip has data, the dock rewrites itself to "Sun 8 Nov · 3 people · Q2,250 ≈ US$300 → Send". Pair it with C's live **total in Q and US$** on the slip and in the message.
4. **From A: total on the send button and the website price quoted in the message.** For example "Send on WhatsApp · Q1,500" and "Website price: Q750 pp (Q1,500 total)", which prevents price disputes.
5. **From A: a jump menu.** Use the idea behind A's "Scene selection", but label it honestly as "Menu" in B's header next to the WhatsApp button: What's included · Getting there · The camp · Gear · Questions · Book. Alternatively, put a row of anchor chips under the hero.
6. **From A: opt-in motion.** Wrap all reveal styles in `@media (prefers-reduced-motion: no-preference)` and add a 2.5 s "force visible" safety net, so slow JS or a failed IntersectionObserver can never leave content invisible.
7. **From D: shared group-size state.** Stepping hikers in B's loom section should prefill "How many of you?" in the slip ("Ask for 4 people").
8. **From C: font engineering.** Self-host pyftsubset Latin subsets (as C did, preloading only two files). Apply it to Fraunces 700 / italic, Figtree 400–700 and a glyph-subset Caveat.
9. **From C: the A→D "Getting there" route.** Add timestamps (Café ~8:00 → ~1 h → Alexander's house → … → same café) to B's two meeting-point cards.

## Must-fix in the winner (B)

1. **Fuego FAQ:** delete "Access to Fuego is set by the authorities… only offer what's allowed". Reword exactly as Alexander offers it, per the client directive: optional extra hike from camp toward Fuego, about 4 h (sometimes more), +Q300 pp, decided and paid at camp if you feel fit and the weather's right, nothing prepaid. Keep it as one FAQ item and one small line in the ticket, never in a headline.
2. **Pickup:** show the cafés and "around 8:00 AM (confirmed on WhatsApp)" in the hero and on the ticket. Replace the vague "Morning pickup".
3. **Fonts:** self-host and subset, cutting the measured ~231 KB of third-party fonts to ≤ 100 KB. Preload only Fraunces 700 and Figtree 400, use `size-adjust` fallbacks to avoid layout shift, and restrict Caveat to the signature and margin notes.
4. **Hero image:** cap the mobile hero at about 1000–1200 px wide (≤ 90 KB). `94vw` on a DPR 2.6 phone currently fetches the 190 KB 1600 w file. Keep the preload's `imagesrcset` identical to the `<img>`.
5. **Hero above the fold:** on mobile, shrink the arch to about 45% of the viewport and drop the duplicate logo patch below 600 px. Verify that price, includes, pickup line and CTA all fit above the fold on **360×740**.
6. **Tap targets:** make the "Ask about this tour" links (20 px tall) into ≥ 44 px buttons, and the footer contact links ≥ 44 px.
7. **Legible headings:** headings that carry information, such as "One view, three shows. No extra hike." and the sheet title, should use Fraunces italic, not Caveat.
8. **Totals:** add a computed total (Q and ≈ US$, with "extras paid on the day") to the slip, the send button and the WhatsApp message.
9. **Night-before questions:** add an FAQ "Can I book for tomorrow?". It needs Alexander's real cut-off, so leave it as a marked placeholder until he answers. Keep "How hard is the hike?" near the ticket.
10. **Re-test the dark camp section** (sightline and view switcher) for tap size and contrast at 360 px. Tab labels are fine; check the swipe affordance has a visible hint.

## Must-fix if another concept is chosen instead

- **A:**
  - move a compact "what's included" block and the cold/water rule into the first two screens;
  - label the jump menu;
  - remove the backdrop blur on mobile and the blur-filter reveals;
  - add `srcset` to all photos;
  - raise 10–11 px mono to ≥ 12 px;
  - remove the authorities wording.
- **C:**
  - make the hero CTA open the builder as a bottom sheet (or go straight to WhatsApp) instead of jumping 11 screens;
  - rename "Summit Pass" in CTAs to plain words ("Check a date on WhatsApp");
  - fix paper on periwinkle (2.28:1);
  - move the Spanish/English note up.
- **D:**
  - raise mono text to ≥ 12–13 px and darken it on contour areas;
  - collapse the mobile route strip to about 44 px with no blur, or drop it on mobile;
  - fix the hero `srcset` descriptors;
  - self-host fonts;
  - make the footer WhatsApp links ≥ 44 px.
