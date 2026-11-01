# D · CONTOUR: "The Right Side of the Mountain"

**Key:** `D-contour` · **Prototype:** `index.html` (+ `css/contour.css`, `js/contour.js`, `img/`) · **Preview:** serve the folder (`python3 -m http.server`) and open `/index.html`. Add `?static=1` to switch off all motion (used for full-page screenshots).

---

## 1. The big idea

The whole site is a survey sheet of one route. It runs from a café in Antigua (1,530 m) to the 3,976 m summit and back, drawn as an elevation profile that you travel down the page while an altimeter in the booking bar climbs with you. The precision of expedition gear (contour lines, map labels, a compass viewfinder) is there to prove one claim: from Solex's camp on the right-hand side of Acatenango, **Fuego is straight ahead.**

Tone: Swiss, exact, calm, like a well-run operation. Warmth comes from Alexander, whose words appear as handwritten notes on the map.

## 2. Why it converts

1. **The first mobile screen answers every question a traveller has the night before.** The headline claim ("Fuego, straight ahead."), the camp's location, small groups and set-up cabins are all there. So are a real eruption photo with a crosshair on the crater, the **price (Q750 ≈ US$100)**, four inclusions, a **full-width WhatsApp button** and both pickup cafés. Everything fits above the fold at 390×844.
2. **Differentiators are demonstrated, not asserted.** The *Sightline* viewfinder swings from a typical left-side camp to the Solex camp, so the visitor sees why "straight ahead" matters. The *Group gauge* shows 2–8 per guide and what happens at nine people.
3. **There's always one tap to book.** A dark dock with the altimeter and a lava-orange "Check dates · Q750" button follows the visitor after the hero CTA scrolls away. On desktop the header CTA stays visible.
4. **Scrolling feels like progress.** The altimeter and the moving marker on the profile give a reason to keep reading: the itinerary *is* the scroll. Reaching 3,976 m turns the readout sun-yellow.
5. **A low-friction WhatsApp message.** The "Climb manifest" writes a structured message with bilingual labels (English + Spanish), so English-speaking travellers and Alexander understand each other on the first message. That means fewer back-and-forths and faster confirmations.
6. **Honesty builds trust.** The site says the guides speak mainly Spanish and a little English, that views need clear skies, and that review slots are placeholders. Alexander's line "What we tell you is included is what we give you" is backed by a spec sheet that lists exactly that.
7. **It works on a phone at night on 4G.** The camp chapter is dark (easy on the eyes after dinner), tap targets are at least 44 px, and the critical path is about 120 KB plus fonts.

## 3. Information architecture (whole site)

One long, ordered page is the core product. The section numbers (§) and waypoints (WP) are printed on the page, the way a field manual labels its parts.

| # | Section | Purpose | Content intent |
|---|---|---|---|
| 00 | **Header** | Orientation + persistent booking | Logo disc + wordmark, "La Soledad · Acatenango". Desktop: Route, Camp, Overnight, Other tours, Gear, FAQ + "Book on WhatsApp". Mobile: logo + "Book". |
| 01 | **Hero** (ALT 1,530 m, Antigua) | Sell the experience in one screen | Kicker "Acatenango · 3,976 m / Overnight from Antigua". H1 **"Fuego, straight ahead."** One-line lede. The eruption photo is framed as a map plate (registration marks, altitude ticks, crosshair, "FUEGO 3,763 m" label, handwritten "straight ahead from our camp!"). Price block, inclusions, full-width CTA, pickup cafés. |
| 02 | **Legend** | Six reasons, scannable in 5 s | Map-legend box with symbols: Fuego dead ahead · Sunset from camp · 2–8 per guide · Cabins set up · Sunrise summit · 100% local. |
| 03 | **§01 Route** (the spine) | Show the whole experience as one loop | Sticky elevation profile (mobile: top strip; desktop: left column with a photo for each waypoint) + six waypoints: |
| | WP01 Antigua, 1,530 m | Remove logistics anxiety | Café Condesa / Café La Parada, bring your suitcase, ~1 h drive, "time confirmed on WhatsApp". |
| | WP02 La Soledad, ≈2,400 m | Introduce Alexander + small groups | Welcome at his house, luggage ("Things don't go missing here."), **Field note: group size** (35–60 → 2–8), his origin story, quote, **Group gauge**, honest language note. |
| | WP03 The climb | Set expectations | At your group's pace, lunch included, Golden rule (4 L water + warm clothes), carry-less options (rentals, porter 13 kg). |
| | WP04 Camp, ≈3,600 m (night chapter) | **Core differentiator** | "The right side of the mountain." Left vs right explanation, **Sightline viewfinder**, three facts with photos (small eruptions too / no extra sunset hike / the whole volcano chain + Atitlán), **Cabin spec** with real interior video, cabin-door photo. |
| | WP05 Summit, 3,976 m (sun band) | The emotional peak | Huge "3,976 m", sunrise hike about 1 h above camp, summit photo. |
| | WP06 Descent | Close the loop + upsell convenience | Coffee, breakfast, descent, bags, same café drop-off; **onward to Panajachel saves ~40 min**. |
| 04 | **§02 Overnight spec sheet** | The offer, the close | A ticket-style card: Q750 / ≈US$100, spec table (Transport, Guide, Entry, Night, Meals, Warm drinks, Luggage, Pickup), "You bring", "Optional" (porter, rentals, Fuego add-on in small type), CTA, Alexander's promise. |
| 05 | **§03 Other ways up** | Capture time-poor travellers | Timetable rows: Midnight sunrise 10:30 PM Q750 · Sunset 10:30 AM Q750 · One-day express 5:00 AM Q675; each with an arrow button that opens the manifest with that tour preselected. |
| 06 | **§04 Gear** | Answer "I have no gear" | Numbered kit grid (jackets, backpacks, headlamps, poles, shoes, porter Q250 up / Q250 down), "prices on WhatsApp", Golden rule box. |
| 07 | **§05 Who we are** | Local, family, community | Family agency at the main entrance; money stays in La Soledad (wording to confirm); "promises vs reality" quote; new cabins photo. |
| 08 | **§06 Field reports** | Social proof (placeholder) | Three clearly labelled dashed **placeholder slots** for real Google/Instagram reviews. No invented reviews or ratings. |
| 09 | **§07 FAQ** | Remove last objections | Pickup, English, suitcase, eruptions, private cabin, Panajachel, closer to Fuego (add-on), what to bring, how to book. |
| 10 | **Final CTA** (night) | Last push | "ALT 3,976 m · SUMMIT" chip, **"See you in La Soledad."**, CTA + both WhatsApp numbers. |
| 11 | **Footer** | Contacts | Logo, address, both WhatsApp lines, Instagram @solextours_acatenango, Facebook/Google "Solex Tours", coordinates. |
| — | **Climb manifest** (dialog) | Booking | See §9. |
| — | **Dock** (mobile) / **Rail** (desktop) | Persistent CTA + altimeter | See §10–11. |

Phase 2 (outside the prototype): `/es` Spanish mirror with the same anchors; an Instagram-fed gallery strip; a short privacy note.

## 4. Typography (Google Fonts, all OFL)

| Role | Family | Settings |
|---|---|---|
| Display | **Archivo** (variable, `wdth` 62–125, `wght` 400–800) | `font-stretch: 62%` · `800` · tight leading (.84–.9) · slight negative tracking. Condensed Swiss grotesque, like engraved instrument labels. |
| Text | **Archivo** | `font-stretch: 100%` · 400/700. One family keeps the payload small. |
| Wordmark / nav | **Archivo** | `font-stretch: 118%` · 800 · tracked caps ("SOLEX TOURS"). |
| Data / labels / altimeter | **JetBrains Mono** 400/500/700 | Uppercase, +0.08–0.12em tracking, tabular figures for the altimeter. |
| Alexander's voice | **Caveat** 600 | Only for his quotes and the hand annotation on the hero map. Echoes the brush lettering in the logo. |

| Token | Mobile (390) | Desktop (1440) |
|---|---|---|
| H1 | clamp 54 → ~64 px, 2 lines | ~150 px, 3 lines |
| H2 | 44–52 px | up to 108 px |
| H3 | 31 px | 40 px |
| Summit numeral | ~128 px | 260 px |
| Price numeral | 54 px (hero), 58 px (sheet) | 72 / 92 px |
| Body | 16.5–17 px / 1.5 | 18–21 px |
| Mono labels | 10.5–12 px caps | 10.5–12 px |
| Quotes (Caveat) | 30–33 px | 30–33 px |

## 5. Colour tokens

Sampled with ImageMagick (`-colors N -format %c histogram:info:` and pixel probes) from `site/logo.png` and the photos.

| Token | Hex | Source | Use | Contrast |
|---|---|---|---|---|
| `--sky` | `#ACD5EA` | Logo disc, rgb(173,211,232) | Offer band, toggles, contour lines | ink on sky 10.8:1 |
| `--paper` | `#F3F8FB` | Logo sky lifted | Page "survey paper" | ink 15.8:1 |
| `--paper-2` / `--sky-2` | `#E6F1F8` / `#DDEEF7` | Tints | Local band, notes, selected options | |
| `--ink` | `#1E1D18` | Logo peaks, rgb(30,29,24) | Text, rules, buttons | |
| `--ink-2` | `#4A5866` | Derived | Secondary text | 6.8:1 on paper |
| `--blue` | `#2F6390` | Twilight sky behind the plume (#4E7AAD), darkened for AA | Links, focus ring | 5.9:1 on paper |
| `--sun` | `#F4BD63` | Logo sun, rgb(244,189,99) | Summit band, night accents | ink 9.9:1 · on night 11:1 |
| `--lava` | `#FF5A36` | Plume/lava pixels #FF5636 / #F76B57 | **Primary CTA** (ink text), profile marker | ink on lava 5.4:1 |
| `--lava-ink` | `#C7381A` | Lava, darkened | Lava as text/strokes on paper | 4.9:1 |
| `--night` | `#0B1220` | Eruption-photo sky #06080B / #1D3052 | Camp chapter, final CTA | paper 17.5:1 |
| `--night-2/3` | `#1D3052` / `#2B4470` | Night-sky blues | Panorama, contour lines on night | |
| `--night-txt` / `--night-mute` | `#C9D6E2` / `#8EA3B8` | Derived | Text on night | 7.2:1 minimum |

The CTA is lava-orange with ink text (5.4:1), not WhatsApp green. It is the brightest pixel on every screen and belongs to the brand (the eruption), with the WhatsApp glyph inside.

## 6. Imagery plan (real photos only; resized copies in `img/`, ≤1600 px, WebP q78)

| File (source) | Where | Crop / focal point |
|---|---|---|
| `plume-800/1600.webp` ← owner/fuego_eruption_night_red_plume.jpg | **Hero plate** | Mobile crop: rows 20–80% of the image (`--ct:.2; --ch:.6`), crater at (39.5%, 42.5%). The reticle is placed by JS from the image rect so it always sits on the crater. Desktop: full 3:4. Preloaded, `fetchpriority=high`. |
| `ready-group-800.webp` ← gallery df16b529 | Desktop sticky photo, WP01 | centre |
| `trailhead-800/1408.webp` ← image01 | WP02 (mobile inline; desktop sticky) | 16:11, centre (group + welcome sign) |
| `trail-ash-800/1600.webp` ← gallery 942c4bdf | WP03 inline | 4:3 centre |
| `gear-backpack-884.webp` ← image05 | WP03 sticky (desktop), §04 Gear | 50% 40% |
| `cabins-path-800.webp` ← owner/cabins_path_fuego_day.jpg | WP04 sticky (desktop) | cover, Fuego right third |
| `lava-800/1600.webp` ← owner/fuego_eruption_night_lava_city_lights.jpg | Fact 01 "Small ones too." | 4:5, crater upper-middle |
| `sunset-group-800/1024.webp` ← owner/sunset_group_three.jpg | Fact 02 "No extra hike." | 4:5, people centred |
| `sunset-ridge-838.webp` ← gallery 2ed1028f | Fact 03 "The whole chain." | 4:5 |
| `cabin-beds.mp4` (645 KB, H.264, no audio) + `cabin-beds-poster.webp` (sharpest frame by Laplacian variance) ← owner/cabin_interior_beds.mp4 | Cabin spec | 848:474, `preload="none"`, autoplays muted only when ≥50% visible and motion is allowed |
| `door-fuego-800/1280.webp` ← gallery 0bd7af40 | Cabin block | 4:5 / 3:4, door frame centred |
| `summit-group-800/1600.webp` ← gallery 435e7f25 | WP05 inline | 4:3, group bottom third |
| `sunrise-friends-800.webp` ← gallery 8a98a90b | WP05 sticky (desktop) | centre |
| `sunrise-eruption-1016.webp` ← gallery 3933a9bd | WP06 inline | 4:5, `50% 30%` (plume) |
| `cabin-fuego-800.webp` ← owner/cabin_fuego_day.jpg | WP06 sticky (desktop) | centre |
| `green-cabins-800/1280.webp` ← owner/new_green_cabins.jpg | §05 Who we are | 4:3 |
| `logo-256.webp`, `favicon-64.png` ← site/logo.png | Header, footer, favicon | trimmed |
| `topo.svg` (74 KB, 31 KB gz) | Contour backgrounds everywhere | Generated: a heightfield of Acatenango's twin summits + Fuego, then marching squares, a 100 m interval and a heavier index line every 500 m. Used as a CSS **mask**, so one file is recoloured per section (sky on paper, navy on night, deep sky on the offer band). |

## 7. Motion language: "plotted, not floated"

Everything moves the way an instrument draws: lines plot, digits roll, images print.

- **Hero:** H1 lines rise 22 px (800 ms, `cubic-bezier(.2,.7,.2,1)`). The reticle **locks on** to the crater (scale 2.4→1, 1.1 s), then the Fuego label slides in.
- **Photos print top-down:** `clip-path: inset(0 0 100% 0) → inset(0)` on the image (1.1 s, `cubic-bezier(.65,0,.25,1)`), like a plotter. The clip sits on the `<img>`, not the observed figure, because Chrome's IntersectionObserver honours the target's own clip-path.
- **Profile:** the travelled part of the route is revealed by a clip rect that follows scroll. The marker pings every 2.2 s.
- **Altimeter:** odometer wheels (500 ms) per digit.
- **Sightline:** the panorama pans and the viewfinder slides (1.4 s, ease-in-out) like turning your head. Fuego's plume breathes and the lava glows on a 6 s loop.
- **Dock / sheet:** slide in 450 ms. On desktop the manifest is a drawer from the right.
- **Reduced motion** (`prefers-reduced-motion: reduce`, or `?static=1`): no animations or transitions. Every reveal is shown, the viewfinder starts on "Our camp", the altimeter digits switch instantly, photos swap without fades, the video does not autoplay (play button) and smooth scrolling is off.

## 8. Signature interactions

1. **The Altimeter.** The dock (mobile) and a fixed vertical gauge (desktop, ticks every 100 m, index every 500 m) read the visitor's position on the route from the scroll. The value comes from the same profile function that draws the spine, so the number, the marker and the waypoint always agree: 1,530 → 2,400 (La Soledad) → climbing → 3,600 (Camp · Fuego ahead) → night → **3,976 Summit · sunrise** (readout turns sun-yellow) → back down to Antigua. It's decorative (`aria-hidden`) and the content stays readable without it.
2. **Sightline viewfinder.** A schematic night panorama from Acatenango with a compass tape (E · SE · S · SW · W). It shows Guatemala City and Antigua, Agua, Fuego with plume and lava, the sunset, the volcano chain and Lake Atitlán. Two buttons ("A · Most camps, left side" / "B · Our camp, right side", `aria-pressed`) swing the viewfinder. Things inside the field of view light up and the caption changes (`aria-live`). On first view it starts on A and swings to B by itself. It is labelled "Schematic, not to scale. Views need clear skies."
3. **Group gauge → Climb manifest.** A stepper (1–20) draws travellers as dots grouped behind a guide marker (max 8 per guide). It reads "9 travellers · 2 guides · nine of you? two guides go". The count is shared state: "Ask for N people" opens the manifest with N already filled in, including the guide count and the total in Q and US$.

(The **route spine**, a sticky elevation profile with day/night shading and waypoint numbers, ties the three together.)

## 9. WhatsApp booking flow

Every CTA is a real `wa.me` link (it works without JS). With JS it opens the **Climb manifest** (`<dialog>`: bottom sheet on mobile, right drawer on desktop, focus is trapped and returns to the opener).

**Fields (all but the tour optional):**

1. Tour: Overnight 2D/1N (default) · Midnight sunrise · Sunset · One-day express (radio cards with price and start time; the timetable buttons preselect one)
2. Date (`type=date`, min = today) + "My dates are flexible"
3. People (stepper; shows "N guide(s) · Q total (≈US$)")
4. Pickup: Café Condesa (Parque Central) / Café La Parada (Parque La Merced)
5. After the climb: Back to Antigua / On to Panajachel (saves ≈40 min)
6. Rent or add: Porter 13 kg · Jacket · Backpack · Headlamp · Poles · Shoes
7. Name

A live preview bubble shows the exact message. The sticky "Open WhatsApp" button sends to +502 4834 7003, with a secondary link for +502 4946 8883 carrying the same text.

**Exact template** (lines for empty optional fields are left out):

```
Hi Alexander! I found Solex Tours online and I'd like to book.

Tour: Overnight 2D/1N, camp facing Fuego (Q750 pp)
Date (fecha): Sat 8 Nov 2026
People (personas): 2
Pickup (recogida): Café Condesa, Parque Central
After (después): back to Antigua
Rent (alquilar): porter (13 kg), headlamp
Name (nombre): Anna

Is there space for us? Thank you!
```

Variants: no date → `Date (fecha): not fixed yet` (`, flexible` if ticked). Dated and flexible → `Sat 8 Nov 2026 (flexible)`. Panajachel → `After (después): continuing to Panajachel`. Other tours use their own name and price, e.g. `Tour: One-day express (5:00 AM start) (Q675 pp)`.

## 10. Mobile sticky CTA (the dock)

- Fixed to the bottom with safe-area padding, ink `#1E1D18` background, about 72 px tall. It appears only after the hero CTA scrolls away (IntersectionObserver). While hidden it uses `visibility:hidden`, so it is also out of the tab order.
- **Left:** the altimeter: `ALT` label, 26 px mono odometer digits + `m`, and the current place under it ("CAMP · FUEGO AHEAD").
- **Right:** a lava button (52 px tall, flexible width) with the WhatsApp glyph, **"Check dates"** and an ink price chip **Q750**. It opens the manifest.
- During the route section on mobile a sticky **route strip** at the top (profile + "WP 03 · CLIMBING · DAY 1") pairs with the dock. The visitor always knows where they are and how to book.

## 11. Desktop adaptation (≥1024 px)

- Sticky translucent header with nav and "Book on WhatsApp"; no dock.
- **Hero:** 12-column grid. Copy in columns 1–6 (H1 at ~150 px over 3 lines, price block and CTA at the bottom), the plate in columns 7–12 at full 3:4 height.
- Legend becomes a single 6-column strip.
- **Route:** 5/7 split. The left column is a sticky instrument panel (a large profile with labelled waypoints and altitude grid, a readout bar, and a photo that crossfades for each waypoint). The right column holds the chapters, with the night and summit chapters as framed panels. The viewfinder shows the whole sweep with dimmed out-of-view zones.
- **Altitude rail** fixed at the right edge (it inverts over the dark final section).
- Spec sheet centred (max 900 px) with a 14 px hard ink shadow and a two-column CTA + promise row. Timetable becomes a single row per tour. FAQ has a sticky heading column. The final CTA uses a 7/5 split.

## 12. Accessibility and performance

- WCAG AA contrast checked for every text/background pair (table in §5).
- Skip link, landmarks and one H1 in order. Alt text describes every real photo. Decorative SVG/HUD is `aria-hidden`. The panorama has a `<title>`.
- Focus: 3 px `--blue` outline (sun-yellow on dark). Radio and chip focus rings sit on the visible card.
- Controls: buttons have labels (`aria-pressed`, stepper `aria-label`s, `aria-live` outputs). Native `<dialog>` handles Esc and focus return.
- Tap targets are at least 44 px and inputs are 16 px (no iOS zoom).
- No frameworks. Gzipped: HTML 13 KB, CSS 10 KB, JS 8 KB, hero image 38 KB, logo 13 KB, topo 31 KB. Below-fold images are lazy and the video is `preload=none`. Fonts: three OFL families via Google Fonts with `display=swap`; for production, self-host and subset Caveat to the quote glyphs.

## 13. Content decisions and items to confirm with Alexander

- **Pickup time:** the site says 6:30 AM; the latest voice note (31 Oct) says 8:00 AM. The prototype shows "around 8:00 AM, confirmed on WhatsApp".
- **Meals:** the old site lists 4; Alexander's latest message lists 3 (lunch + dinner day 1, breakfast day 2) plus hot chocolate and coffee. The prototype uses 3.
- **Gloves and hats** are listed on the old site for the overnight but not in the voice notes, so they're left out of the overnight spec. They are kept for the other tours, as the current site lists them.
- **Altitudes:** summit 3,976 m (given) and Fuego 3,763 m (public reference). Antigua 1,530 m and La Soledad ≈2,400 m are public approximations. **Camp ≈3,600 m is an estimate** ("about an hour below the summit") and should be checked with a GPS reading. Coordinates are rounded public values.
- **Fuego extra hike:** shown only as one small line in "Optional" and one FAQ item, worded as Alexander offers it: about 4 h, +Q300, decided and paid at camp if fit and the weather is right, nothing to prepay. It is never a headline and the site makes no statements about permits or rules. It sits behind a one-line flag (`ADDONS.fuego` in `js/contour.js`) so it can be removed site-wide in seconds if Alexander decides not to list it.
- **Community wording** in §05 needs Alexander's sign-off.
- Rental prices, the hike time to camp, and who provides the onward Panajachel transport are not stated in the material, so the site doesn't invent them ("prices on WhatsApp", "ask Alexander").
- **Reviews:** three placeholder slots, clearly labelled, to be filled with real reviews.
- The left/right camp comparison is Alexander's own description, presented as a schematic.

## 14. Deliverables

- `concept.md` (this file)
- `index.html`, `css/contour.css`, `js/contour.js`, `img/` (web copies + generated `topo.svg`)
- Screenshots: `m-first.png`, `m-full.png`, `d-first.png`, `d-full.png`. Extras in `extra/`: route strip + dock, camp viewfinder, summit, offer, manifest (top and bottom), desktop route and camp.
