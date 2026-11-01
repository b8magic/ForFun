# Concept A: FRONT ROW TO FUEGO
### Solex Tours · Expedición Volcán Acatenango · English, mobile-first site proposal

---

## 1. The big idea

**The website is a 24-hour film, and the camp is the best seat in the house.** It opens on the money shot, Fuego erupting at 21:40 seen from the Solex camp. A title sequence then rewinds the clock to 08:00 in Antigua, and every scroll moves the tour clock forward through midday, golden hour, the night show and a blue-hour summit, with colour, light and type changing as the hours pass.

The metaphor carries the one fact that sets Solex apart: the camp is on the right-hand side of Acatenango, so Fuego is straight ahead. In film and theatre language that is simply *the front row*. A small local crew of 2–8 per guide is *the cast*. Booking is *getting your ticket*.

---

## 2. Why it converts

| Traveller's situation | What the design does |
|---|---|
| On a phone in Antigua, often the night before, comparing several agencies | The first screen shows the product (an eruption), the differentiator ("Front-row seats"), the price (Q750 ≈ US$100) and a WhatsApp CTA, all visible without scrolling. |
| "They all look the same" | The site doesn't open with a list of features. It opens with **one memorable claim**, and the seat map makes that claim easy to see in about 3 seconds. |
| "What do I actually get, and when?" | The scroll *is* the itinerary. Each scene gives a time, a place and what happens. The rest of the brief's FAQ answers sit inside the story. |
| Fear of hidden costs or overselling | Honesty is part of the brand: a "Straight talk" note on the guides' language, "weather permitting" in the credits, "approx." on uncertain times, review slots left empty instead of made up, and Alexander's own line: *"What we tell you is included is what we give you."* |
| Friction in booking | No forms to submit and no account. A live **ticket builder** turns four taps into a complete, polite WhatsApp message to Alexander, total included. The sticky ticket-stub CTA is always one thumb away. |
| Mid-range phone on 4G | Vanilla HTML/CSS/JS, about 31 KB gzipped of code, a 111 KB hero, self-hosted latin-subset fonts (about 95 KB). Everything below the fold is lazy-loaded. |

---

## 3. Information architecture (whole site, in scroll order)

Each scene carries a timecode (`data-clock`, minutes after 08:00 on day 1) that drives the live HUD clock, plus a `data-phase` that drives the colour temperature of the fixed UI.

| # | Section | Time / phase | Purpose | Content intent |
|---|---|---|---|---|
| 0 | **Header bar** | live | Brand, orientation, CTA | Logo roundel + "SOLEX TOURS / La Soledad · Acatenango". A **HUD timecode pill** ("Day 1 · 21:40") that opens *Scene selection* (chapter menu). A 2-px **day bar** with a glowing dot travelling through the 24 h. Desktop adds nav + "Book on WhatsApp". |
| 1 | **Cold open (hero)** | 21:40 · night | Sell the experience in one screen | Night eruption photographed from camp. Location super "COLD OPEN · Day 1 · 21:40 · From our camp". H1 *Front-row seats to an erupting volcano.* One-line lede. Price block "Overnight · all included **Q750** ≈ US$100 per person". Primary CTA **Book your seat** (WhatsApp). Chips: 2–8 per guide · Bed at camp · 3 meals + transport. |
| 2 | **Title sequence** | 21:40 → 08:00 (rewind) | Make it memorable, frame the promise | "Solex Tours presents *One Night on Acatenango*. Starring Volcán de Fuego (weather permitting). With your local guide from La Soledad. Cast size 2 to 8 hikers per guide. Running time 2 days, 1 night." Then "◀◀ Earlier that day…". The HUD clock visibly **rewinds** while this scrolls past. |
| 3 | **08:00 · Pickup at the café** | morning (paper) | Logistics, no surprises | Café Condesa (Parque Central) or Café La Parada (Parque La Merced). Bring your big bag. About 1 h to La Soledad. "Pickup around 8:00 AM, confirmed on WhatsApp." |
| 4 | **09:00 · Alexander opens his door** | morning → day | Local, human, trust | No office in Antigua, *we live here*. Welcome at his house, bathroom, briefing, rental gear, meet your guide. Luggage stays with him. Quote: *"Things don't go missing here."* Photo: trailhead Welcome sign group. |
| 5 | **10:00 · Your pace. Not the crowd's.** | midday (sky) | Differentiator #2: small groups + founder story | Guided groups of 35–60 → went independent. Quote: *"If you pay for a tour, you should be able to enjoy it without being rushed."* Facts: **2–8** per guide · **9+** = second guide · **Local** guides. Dark "Straight talk" card: guides speak mainly Spanish and a little English. |
| 6 | **14:00 · Row one, centre.** | camp (logo sky) | **Differentiator #1**: camp faces Fuego | Left-side camps vs our right-side camp. **Pick your seat** interactive seat map. Then *Your bed is already up here*: shared cabins for 6, mattress, sleeping bag and pillow at camp, a private cabin sometimes on quiet nights. Cabin video loop and a film strip of the cabin row, doorway view and new cabins. |
| 7 | **17:45 · Sunset, no extra hike.** | golden | Benefit of the seat | Sunset from camp: sea of clouds, volcano chain, Atitlán on clear evenings. Caveat: "Mountains make their own plans." Two golden-hour photos. |
| 8 | **21:00 · Dinner, hot chocolate, and the show.** | night | The payoff | Small and big eruptions, lava, valley lights. Warm-layers tip. Campfire photo, then a **full-bleed cinemascope** lava frame (2.39:1 letterbox on desktop). |
| 9 | **04:30 · One hour to 3,976 m.** | blue hour | Summit included | Leave things in the cabin, about 1 h by headlamp. Summit group photo in blue light. |
| 10 | **06:00 · First light, from the top.** | dawn (lavender → peach) | Emotional peak | Sunrise; Fuego's pink "good-morning plume". Triptych. |
| 11 | **08:00 (Day 2) · Coffee, breakfast, and down.** | day | Close the loop, onward travel | Breakfast and coffee, collect bags, drop-off at the same café. **Onward card:** continue toward Panajachel, saves about 40 min. *Fin.* |
| 12 | **Box office** (`#box-office`) | day | **Conversion** | Offer: *Overnight on Acatenango*, Q750 per person ≈ US$100. "Included" list (8 items), "You bring" (4 L water, warm clothes), optional porter Q250 up / Q250 down, rentals. Alexander's promise. **Ticket builder** (inline on page; moves into the bottom sheet on mobile). |
| 13 | **Other showtimes** | day | Cross-sell without diluting | Midnight sunrise (starts 10:30 PM, Q750), Sunset tour (10:30 AM, Q750), One-day express (5:00 AM, Q675 ≈ US$90). Each "Ask about dates" opens the builder with that tour preselected. |
| 14 | **Wardrobe department** (gear) | day | Remove the "I don't have gear" objection | Jackets, backpacks, headlamps, poles, shoes, porter (13 kg, Q250 each way). "The volcano's golden rule": 4 L of water + extra clothes. |
| 15 | **From the audience** (reviews) | day | Social proof, **real only** | Three dashed **placeholder slots** with briefs ("a guest mentioning the view of Fuego from camp…"). Fill from Google / Instagram with name, country and source. Never invent. |
| 16 | **Before you book** (FAQ) | day | Objection handling | English level; will I see eruptions; private cabin; luggage; fitness; Lake Atitlán; *Can I hike closer to Fuego?* (rules set by authorities, ask on WhatsApp, decide and pay at camp only if permitted, never prepaid). |
| 17 | **End credits** (footer) | night | Last CTA + contacts | **Post-credits scene:** "You. Front row. *Fuego, on stage.*" + CTA. Credits: both WhatsApp numbers, Instagram @solextours_acatenango, Facebook & Google "Solex Tours", photography credit, location. |
| — | **Sticky dock** (mobile) | live | Always-available CTA | Ticket stub: live tour time + "Q750 ≈ US$100 pp" + **Book your seat**. |
| — | **Booking sheet** | — | Book in under 30 s | The ticket builder in a bottom sheet. |

**Note on the Fuego extension.** It is never shown as a headline or a priced add-on. It appears only in the FAQ, with the legal caveat. If the authorities restrict it, delete one FAQ item and nothing else changes.

---

## 4. Typography (Google Fonts, all SIL OFL, self-hosted latin subsets)

| Role | Family | Use | Mobile | Desktop |
|---|---|---|---|---|
| Display | **Instrument Serif** (regular + italic) | Headlines, giant timecodes, prices, quotes, credits. The italic adds the "film title" emotion and carries the accent colour of each time of day. | H1 44–54 px / 0.94; H2 40–48 px / 0.98; timecode numerals 80 px / 0.74; price 42 px | H1 72–120 px; H2 52–76 px; timecode 112–168 px; box-office price 96 px |
| Text | **Figtree** (variable 400–800) | Body, UI, buttons, form labels inside controls | Body 17 px / 1.55; buttons 15.5–17 px 800 | Body 18 px / 1.55 |
| Mono | **JetBrains Mono** (variable) | Slate/timecode labels, captions, eyebrows, ticket fields, "credits" metadata. This is the film-slate voice. | 12 px uppercase, tracking 0.14 em (never below 10 px; legal/meta captions 11 px) | 12 px |

Rules: tabular lining figures for all times and prices. The H1/H2 *italic phrase* is always the emotional half of the sentence ("Not the crowd's.", "no extra hike.", "and the show."). Body copy never sits in the serif.

---

## 5. Colour tokens (derived from the logo and sampled from the real photos with ImageMagick)

Sampling: `convert <photo> -resize 200x200 +dither -colors 8 -format %c histogram:info:` for dominant colours, and `%[hex:p{x,y}]` for point samples (plume core, lava, sun). Text pairs were verified with a WCAG contrast script.

| Token | Hex | Source | Role |
|---|---|---|---|
| `--peak` | `#0D0F14` | Logo peaks (#020202) softened | Ink, ticket, dock |
| `--logo-sky` | `#ABD4E9` | Logo roundel (#ABD4E9 exact) | 14:00 camp section, daybar |
| `--marigold` | `#F1C16F` | Logo sun (#F1C16F exact) | Eyebrows on dark, "Straight talk" label |
| `--lava` | `#FF7F60` | `fuego_eruption_night_red_plume.jpg` plume core (#FF7F60) | **Primary CTA**, night accents. Ink on lava 7.7:1; lava on night 7.5:1 |
| `--ember` | `#E85008` | `3933a9bd_original.jpg` sunrise plume | Dawn accents (decorative) |
| `--ember-ink` | `#9A3412` | Ember darkened for AA | Timecodes / eyebrows on paper (6.3:1) |
| `--night-950/900/800/700/600` | `#05080F` `#0B1220` `#131D33` `#1D3052` `#2F4870` | `fuego_eruption_night_lava_city_lights.jpg` sky (#131D33, #1D3052, #2F4870) | Night, blue hour, seat-map stage |
| `--moonlit` | `#658AB5` | Red-plume sky | Secondary night tone |
| `--midday` / `--midday-ink` | `#2A6FCB` / `#1F5FB8` | `cabin_fuego_day.jpg` sky (#2A6FCB) | 10:00 / 14:00 accents (5.4–5.6:1 on light), focus ring |
| `--sky-50/100` | `#EEF6FB` `#D7E9F5` | Logo sky tints | Midday backgrounds |
| `--gold-soft` / `--gold` | `#F3C46E` / `#E5AD42` | `sunset_group_three.jpg` sun band (#E5AD42) | 17:45 background (ink 11.5:1) |
| `--dusk` / `--soil` | `#D9773A` / `#5C3622` | Sunset sky + camp ground (#5C3622) | Sunset → night transition |
| `--dawn` / `--dawn-glow` | `#8A9EE8` / `#FDF1D6` | `3933a9bd_original.jpg` lavender sky (#8A9EE8) + horizon (#FDFBA4 softened) | 04:30 → 06:00 gradient |
| `--textile` / `--textile-deep` | `#A14D2E` / `#6D1E13` | Cabin fabric `0bd7af40_original.jpg` (#A14D2E, #6D1E13) | "already up here" italic, video poster bg |
| `--paper` / `--paper-2` / `--paper-3` | `#F6EFE3` `#EFE5D3` `#FFFBF4` | Warm sea-of-clouds whites | Box office, FAQ, cards |
| `--muted` | `#5A5650` | Basalt / ash (#898377) deepened | Secondary text on paper (6.3:1) |
| `--muted-night` | `#A9B4C8` | Moonlit cloud | Secondary text on night (8.9:1) |

**Phase themes for fixed UI** (`html[data-phase]`): `night`, `morning`, `midday`, `camp`, `golden`, `bluehour`, `dawn`, `day`. Each sets `--bar-bg`, `--bar-ink` and `--bar-accent`, so the header, HUD icon, day-bar dot and dock hairline shift colour temperature with the story (transitions 0.6 s).

---

## 6. Imagery plan (real photos only; resized copies in `img/`, webp q 68–78, max 1600 px)

| Slot | File in `img/` | Source | Crop / focal point |
|---|---|---|---|
| Hero (mobile) | `hero-fuego-night-sm.webp` 900×1200 | `owner/fuego_eruption_night_red_plume.jpg` | `object-position: 42% 30%`. Crater at (0.417, 0.43) of the image; JS pins the lava-glow there. Plume and crater sit in the top half; text sits over the dark flank. |
| Hero (desktop) | `hero-fuego-night.webp` 1200×1600 | same | Right 62% of the viewport, `50% 30%`, left edge fades into the night panel. |
| 09:00 | `trailhead-welcome.webp` | `site/…/image01.jpg` | Full frame. The Welcome sign must stay in shot. |
| 10:00 | `trail-midday.webp` | `gallery01/942c4bdf_original.jpg` | Desktop 4:5 at `40% 50%`; keep hiker + dog. |
| 14:00 strip | `camp-path-fuego-sm.webp`, `cabin-door-fuego.webp`, `camp-green-cabins.webp` | `owner/cabins_path_fuego_day.jpg`, `gallery01/0bd7af40_original.jpg`, `owner/new_green_cabins.jpg` | 3:4 film-strip frames; green cabins at `30% 50%`. |
| 14:00 video | `cabin-beds.mp4` (383 KB, 640 w, h.264, no audio) + `cabin-beds-poster.webp` | `owner/cabin_interior_beds.mp4` | 848:474. Plays only in view and is never autoplayed with reduced motion. Has a pause button. |
| 17:45 | `sunset-three.webp`, `sunset-fuego-clouds.webp` | `owner/sunset_group_three.jpg`, `owner/sunset_man_fuego.jpg` | Duo, offset second frame; first at 4:5 `40% 50%`. |
| 21:00 | `night-campfire.webp` (16:10) + `night-lava-city(-sm).webp` | `gallery01/ec2669a1_original.jpg`, `owner/fuego_eruption_night_lava_city_lights.jpg` | Lava frame: mobile 4:5 bleed `50% 32%`; desktop 2.39:1 letterbox `50% 30%` (plume + lava + valley lights). |
| 04:30 | `summit-bluehour.webp` | `gallery01/435e7f25_original.jpg` | 4:3. |
| 06:00 | `sunrise-eruption.webp` (tall), `sunrise-friends.webp`, `sunrise-shadow.webp` | `gallery01/3933a9bd_original.jpg`, `gallery01/8a98a90b_original.jpg`, `site/…/image12.jpg` | Triptych: tall + two squares. |
| Gear | `backpack-agua.webp` | `site/…/image05.jpg` | 4:3 at `50% 40%`. |
| Brand | `logo-96.png`, `logo-256.webp` | `site/logo.png` (trimmed) | Header roundel with a white ring; footer. |

Reserve for the full build: `owner/cabin_fuego_day.jpg` (OG/share image, about 1200×630 crop centred on the cabin + Fuego), `gallery01/6c07d214_original.jpg` and `image02.jpg` (alternative sunrise groups), `gallery01/df16b529_original.jpg` (group at Alexander's house, which could illustrate 09:00 if he confirms the location).

---

## 7. Motion language: "exposure and focus-pull"

| Motion | Behaviour | Reduced-motion fallback |
|---|---|---|
| **Exposure reveal** | Blocks fade in from 18 px with a 6 px blur that sharpens (0.9 s, `cubic-bezier(.2,.7,.2,1)`), like a lens pulling focus. | Content is visible immediately: no transform, no blur. A `?static=1` mode and a 2.5 s safety net also force everything visible. |
| **Hero push-in** | Photo scales 1.08 → 1 over 14 s (slow dolly). | Static. |
| **Lava breath** | Radial coral glow pinned to the photographed crater (computed from `object-fit` math), "breathing" every 5.5 s with `mix-blend: screen`. | Static glow at 60%. |
| **Hero type entrance** | Lines rise in sequence, 120 ms stagger. | None. |
| **Live clock** | The HUD timecode runs forward while you scroll and **rewinds** across the title sequence (rewind icon, accent colour). The day-bar dot travels. | Text still updates; it's information, not animation. |
| **Phase shifts** | Header, dock hairline, icons and rail cross-fade colour temperature (0.6 s). | Instant. |
| **Seat map** | Sightline cone cross-fades between seats; seats recolour; plume puffs gently. | Instant swap, static plume. |
| **Ticket printing** | Each changed ticket field flashes lava, like ink landing. On send the stub **tears off** (rotate + drop) before WhatsApp opens. | No flash, no tear; WhatsApp opens immediately. |
| **Sheet** | Bottom sheet slides up 0.45 s with a fading backdrop. | Appears instantly. |
| Smooth scroll | Anchor jumps scroll smoothly. | Only with `no-preference`. |

---

## 8. Signature interactions

1. **The scroll is the clock.** A live timecode HUD ("Day 1 · 17:45 · Sunset") and a 24-hour day bar move with the story. The cold open starts at 21:40, the title sequence rewinds to 08:00, and each scene "holds" its time before rolling to the next. Colour temperature follows. Tapping the HUD opens **Scene selection**, a DVD-style chapter menu that doubles as navigation on mobile. On desktop, a right-edge **timeline rail** shows dots per scene, with labels on hover/focus.
2. **Pick your seat.** A theatre seat-map schematic of the camp's position. Fuego is the stage. Toggle **Front row (Solex camp)** and **Side seat (most camps)**: a sightline cone swings from "Fuego straight ahead" to "toward Antigua & Guatemala City", seats light up, and the caption lists what you see from each seat. The front row has exactly 8 seats, the maximum per guide. It is labelled "Schematic, not to scale", so it explains without fabricating a view.
3. **Your ticket.** Booking is an admission ticket that prints as you choose (Admit N, tour, date, pickup café + time, seat, total in Q and US$, perforated stub). "Send on WhatsApp", with the live total on the button, tears the stub and opens WhatsApp with a ready-to-send message. The same form lives inline at the box office and moves into the mobile bottom sheet when opened from the dock, so there is one source of truth.
   *Supporting moments:* the cold open → "◀◀ Earlier that day…" rewind, the post-credits CTA, and the film-strip carousel with sprocket holes.

---

## 9. WhatsApp booking flow

**Entry points:** hero CTA, sticky dock, header "Book on WhatsApp" (desktop), box office, every "Other showtimes" card (preselects that tour), and the post-credits CTA. Without JS, every one of them is a plain `https://wa.me/50248347003` link.

**Fields** (all optional except the ones with defaults; nothing is validated so nobody gets stuck):

| Field | Control | Default | Notes |
|---|---|---|---|
| Tour | 4 radio cards | Overnight (2D/1N · Q750) | Midnight sunrise (10:30 PM · Q750), Sunset (10:30 AM · Q750), One-day express (5:00 AM · Q675) |
| Date | native date input, `min` = today | empty → "flexible, please suggest" | |
| Hikers | stepper 1–20 | 2 | 9+ shows "Two guides go with your group." |
| Pickup | 2 radio cards | Café Condesa, Parque Central | Café La Parada, Parque La Merced |
| Extras | toggle chips | none | Porter up Q250, Porter down Q250, Jacket, Headlamp, Poles, Shoes, Backpack ("paid on the day, optional") |
| After the tour | 2 radio cards | Back to Antigua | "On to Panajachel, saves ~40 min" |
| Name | text, `autocomplete=given-name` | empty | omitted from the message if empty |

**Exact prefilled message template** (sent to `https://wa.me/50248347003?text=<urlencoded>`; the second line +502 4946 8883 is linked under the button):

```
Hi Alexander! I'd like to book with Solex Tours.

Tour: {Overnight on Acatenango (2 days / 1 night) | Midnight sunrise tour (starts 10:30 PM) | Sunset tour (starts 10:30 AM) | One-day express (starts 5:00 AM)}
Date: {Sun, 8 Nov 2026 | flexible, please suggest}
Hikers: {n}
Pickup: {Café Condesa, Parque Central | Café La Parada, Parque La Merced} (Antigua)
Extras: {porter up (13 kg, Q250), rent a jacket, … | none for now}
After the tour: {back to Antigua | heading on toward Panajachel}
Name: {name}            ← line omitted if empty

Website price: Q{price} per person (Q{price × n} total). Is there space? Thank you!
```

Example as generated by the prototype in the test run:
```
Hi Alexander! I'd like to book with Solex Tours.

Tour: Overnight on Acatenango (2 days / 1 night)
Date: Sun, 8 Nov 2026
Hikers: 3
Pickup: Café Condesa, Parque Central (Antigua)
Extras: porter up (13 kg, Q250)
After the tour: back to Antigua
Name: Maria

Website price: Q750 per person (Q2,250 total). Is there space? Thank you!
```
Why this wording: it is plain English that is easy for Alexander to put through a translator, every answer he needs is on its own line, and quoting the website price prevents price disputes. Under the button: "Opens WhatsApp with your message ready… Nothing is charged here; Alexander confirms availability." Optionally add a Spanish echo line for Alexander in production.

---

## 10. Mobile sticky CTA: the ticket stub dock

- Fixed 10 px from the bottom (plus safe-area inset), full width minus 20 px, 64 px tall, radius 16, `--peak` background.
- **Left stub:** live icon (sun, moon or rewind) + live tour time ("Day 1 · 14:00") in mono, then **Q750** (serif) "≈ US$100 pp". It separates from the button with a dashed perforation line.
- **Right:** lava button "Book your seat" with the WhatsApp glyph, 50 px tall, ink text (7.7:1).
- A 2-px hairline on top glows in the current phase accent, so the dock changes temperature with the story.
- **Appears** once the hero price/CTA scrolls away. **Steps aside** while the inline ticket builder is on screen, so there are never two CTAs on screen. Slides with a 0.5 s ease (instant with reduced motion).
- Tap → **bottom sheet** (`<dialog>`, focus-trapped, Esc / backdrop / × to close). The ticket sits at the top, the fields below, and a sticky "Send on WhatsApp | Q1,500" button stays above the thumb zone.

---

## 11. Desktop adaptation (≥ 900 px; rail ≥ 1100 px)

- **Hero:** a night panel (left ~40%) holds giant serif type (up to 120 px) that **overlaps** a tall portrait film frame of the eruption (right 62%, feathered into the night). The price + CTA sit in a glass panel. "Watch the 24 hours" cue and photo credit sit in the bottom corners.
- **Header:** full nav (The 24 hours · The camp · Price & booking · Questions), HUD pill with the place name, and a lava "Book on WhatsApp" button. The bar blurs and re-tints per phase.
- **Scenes:** a two-column "chapter" grid. Left: giant timecode numerals (112–168 px), heading, copy. Right: media (sticky trail photo, seat-map card, duo/trio frames). Alternate scenes (08:00, 21:00, Day-2 08:00) put copy on the right for rhythm.
- **Night:** a true **cinemascope moment**, the lava frame at 2.39:1 between black letterbox bars, full-bleed.
- **Film strip:** the three cabin frames sit side by side in a sprocket-holed strip.
- **Box office:** offer on the left, a **sticky ticket builder card** on the right. Header and dock CTAs scroll to it (no modal on desktop).
- **Timeline rail:** right edge, dots per scene, active dot glows in the phase accent, labels on hover/focus, keyboard reachable.

---

## 12. Accessibility and performance

- WCAG AA pairs verified (see tokens). Visible 3-px focus rings, recoloured on lava/dark surfaces. Skip link. Semantic sections with `aria-labelledby`. The seat map is `role="img"` with `<title>/<desc>` plus a live text caption. Radio and checkbox controls are real inputs with visually customised labels. Touch targets are ≥ 44 px (no target under 24 px in the automated check).
- `prefers-reduced-motion`: all motion is removed, everything is visible, video does not autoplay. Every video has a pause control.
- Weight (prototype): HTML 13 KB, CSS 12 KB, JS 5.5 KB gzipped. Above the fold on mobile: hero 111 KB + fonts about 95 KB + logo 16 KB, about 250 KB in total. Everything else uses `loading="lazy"` with explicit width/height (no layout shift). The video uses `preload="none"`. There are no frameworks or third-party scripts.

---

## 13. Honesty flags / to confirm with Alexander before launch

1. **Pickup time:** the latest voice note says 8:00 AM; the current site says 6:30 AM. The prototype says "around 8:00 AM, confirmed on WhatsApp" and marks scene times "approx.".
2. **Scene times** (17:45 sunset, 04:30 start, 06:00 sunrise, 08:00 breakfast) are illustrative. Confirm the real schedule.
3. **Fuego extension:** treated as FAQ-only with a legal caveat. Remove it entirely if ascents stay restricted.
4. **Rental prices:** unknown, so the site says "ask for prices". The porter price (13 kg, Q250 each way) comes from the current site.
5. **Gloves/hats** are listed as included on the current site but were not mentioned by Alexander, so they were omitted until confirmed.
6. **Reviews:** placeholder slots only. Fill them with real, attributed reviews.
7. **Photo attributions:** confirm the hero night photo was taken from the Solex camp (the caption says so).
8. **Payment method/deposit:** not specified anywhere, so the site promises nothing ("Nothing is charged here").

---

## 14. Files

- `index.html`: prototype (all sections, real copy)
- `css/styles.css`: tokens, phases, layout, motion
- `js/app.js`: clock/HUD/rail, reveals, lava-glow pin, seat map, video, ticket builder + WhatsApp message, sheet, dock
- `img/`: resized webp + compressed mp4; `fonts/`: self-hosted OFL woff2 (latin)
- `screenshots/`: `m-first.png`, `m-full.png`, `d-first.png`, `d-full.png` (+ `m-dock.png`, `m-sheet.png`)
- QA: append `?static=1` to show every reveal at once.
