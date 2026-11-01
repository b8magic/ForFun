# C · SUMMIT PASS — "Front row to Fuego"

Concept for a new English, mobile-first site for **Solex Tours — Expedición Volcán Acatenango** (Alexander, La Soledad).
Prototype: `index.html` (+ `css/site.css`, `js/site.js`, `fonts/`, `img/`). Vanilla HTML/CSS/JS, no frameworks.

---

## 1. The big idea (2 sentences)

Solex's camp is the best seat in the house: it's on the right-hand side of Acatenango, so Fuego is straight ahead, with no head-turning and no extra sunset walk. So the whole site works like a loud, honest **ticket booth**. Every price is printed like a ticket, and booking means building a **Summit Pass** (tour, date, people, pickup) that you "tear off" straight into Alexander's WhatsApp, already written out.

**Tagline:** *Front row to Fuego.*  **Booking object:** *the Summit Pass.*  **Tone:** poster-loud, ticket-precise, warm and plain-spoken.

## 2. Why it converts

| Lever | How Summit Pass uses it |
|---|---|
| **Price on the first screen** | The hero *is* a ticket. Its stub shows **Q750 · US$100 per person, all in** plus a one-line "included" list and the primary CTA, all above the fold on a 390×844 phone. |
| **A single, tangible action** | "Build your Summit Pass" appears in every section. The pass is something you make, so the last step feels like collecting a ticket, not filling in a form. |
| **No composing, no language barrier** | Travellers in Antigua book at night from a café. The pass writes a WhatsApp message with **bilingual labels** (Date *(fecha)*, People *(personas)*, Pickup *(salida)*), so Alexander can read it at a glance. Two taps: build, then send. |
| **The differentiator you can see** | The "Pick your seat" viewfinder **shows** the left-side vs right-side view instead of just claiming it, and the "Big Antigua tour vs Solex" table makes it scannable. |
| **Trust through honesty** | Guides speak "mainly Spanish and a little English". Views need a clear sky. Reviews are real ones only (placeholder slots). "Nothing is booked until Alexander confirms." "What we list is what you get." |
| **A sticky stub that follows you** | The bottom dock is a ticket stub. It starts as "Overnight from Q750 · Build pass". Once you've filled in the pass, it becomes a live summary ("Sun 8 Nov · 3 ppl · Q2,250") with **Send pass**. |
| **Speed** | ~28 KB gzipped HTML+CSS+JS, 4 self-hosted subset fonts (173 KB), a 36 KB hero image. Everything below the fold is lazy. |

## 3. Information architecture (whole site, in order)

| # | Section | Purpose | Content intent |
|---|---|---|---|
| 0 | **Header** | Brand + escape hatch | Logo disc, "SOLEX TOURS / La Soledad · Acatenango", nav (desktop), black **Chat** pill → WhatsApp. |
| 1 | **Hero ticket** "Front row to Fuego." | Sell the experience, the price and the action in one screen | Sunrise eruption photo; kicker "Admit one · Acatenango 3,976 m"; "Max 8 per guide" stamp; one-line promise; stub with Q750 / US$100, skyline barcode, included list, **Build your Summit Pass**, "or ask Alexander on WhatsApp". |
| 2 | **Marquee band** | Repeat the proof points at a glance | 2–8 people per guide · Camp faces Fuego · Sunset from camp · Your bed is already up there · Pickup at 2 cafés in Antigua · Local guides from La Soledad · What we list is what you get. |
| 3 | **01 Pick your seat** "Same volcano. Better seat." | The #1 differentiator, shown not told | Left/Right seat toggle → illustrated viewfinder pans from city lights (Fuego off to one side) to Fuego straight ahead with the sunset, volcano chain and Lake Atitlán; a "from this seat" list; a real night photo from camp; "Illustration, not to scale. Every view needs a clear sky." |
| 4 | **02 Why small** "Big Antigua tour vs Solex." | Turn Alexander's origin story into a comparison you can scan | Rows: Group, Pace, Camp, Sunset, Extras, Promise. Footnote: "Left column: what Alexander saw in his years guiding for big agencies. Not every agency works like this." |
| 5 | **03 The pass** "One price. Everything up the mountain." | The hero product, priced and itemised | Overnight ticket: Q750 / US$100; 7 "punched" inclusions; golden rule (4 L water + layers); optional extras (porter Q250 up/down, rentals, the small conditional Fuego add-on); CTA. Beside it: **Your 24 hours** timeline (Day 1 / Day 2). |
| 6 | **04 Camp** "Your bed is already up there." | Remove the fear of a cold, hard night | Cabin interior video (woven blankets), cabin door framing Fuego, sunset from camp, the cabin row. Facts: 6 per cabin (shared) · 0 tents to carry · private cabin sometimes possible on quiet nights. |
| 7 | **05 Who's taking you** "Alexander got tired of rushing people." | Human trust + local roots | Trailhead photo; his story; handwritten quote *"If you pay for a tour, you should be able to enjoy it without being rushed."*; **Straight talk** language card; community line (wording to be confirmed with Alexander). |
| 8 | **06 Other passes** | Catch people who are short on time | Midnight Sunrise (10:30 PM), Sunset Hike (10:30 AM), One-Day Express (5:00 AM, Q675/US$90). Each "Pick this pass" preselects the builder. |
| 9 | **07 Book** "Build your Summit Pass." | Conversion engine | 6-step form (tour, date, people, pickup + after, extras, first name) → live paper pass → **Tear & send on WhatsApp**. |
| 10 | **08 Getting there** | Logistics anxiety killer | A → D route: café pickup, ~1 h to La Soledad, leave your suitcase at Alexander's house ("Things don't go missing here."), back to the same café or on toward Panajachel (~40 min saved). **Travel light, rent the rest** card + golden rule. |
| 11 | **09 Travellers** | Social proof, honestly | 3 clearly marked **placeholder** slots for real, linked Google reviews. Nothing invented. |
| 12 | **10 Before you go** "Fair questions." | Answer the night-before doubts | Native `<details>`: English?, private cabin?, cloudy?, what to bring, suitcase, closer to Fuego (optional, decided at camp), how to pay. |
| 13 | **Final CTA** "Your seat faces Fuego." | Last push | Night eruption with city lights; Build pass + WhatsApp number. |
| 14 | **Footer** | Contacts | Logo, address (La Soledad, main entrance), both WhatsApp numbers, Instagram @solextours_acatenango, Facebook/Google "Solex Tours". |
| — | **Sticky dock** | Always one tap from booking | See §10. |

## 4. Typography (Google Fonts, all SIL OFL 1.1, self-hosted latin subsets)

| Role | Family / settings | Mobile | Desktop |
|---|---|---|---|
| **Display** (poster headlines, prices, ticket titles) | **Archivo** variable, `font-stretch:62%` (wdth 62), weight 900, UPPERCASE, line-height .84–.86 | H1 72 px (18.6vw) · H2 52 px (13.4vw) · price 64 px · overnight price 100 px | H1 128–140 px · H2 104 px · price 88 px · overnight price 132 px |
| **Text** | **Archivo** wdth 100, 400/700/800 | 17/1.5 body · lede 18–21 | 18/1.55 body · lede 21 |
| **Wide labels** (brand, "SUMMIT PASS", marquee) | **Archivo** wdth 125, 800, tracking .06–.08em | 14–15 px | 17–18 px |
| **Ticket data / mono** (pass fields, codes, times, kickers, notes) | **Space Mono** 400/700, uppercase labels, tracking .08em | 11–13 px | 12–14 px |
| **Hand** (Alexander's quote only) | **Caveat Brush** (echoes the marker "SOLEX" in the logo) | 30–36 px | 46 px |

One variable family covers display, text and wide, so the whole site has a single voice from 62% to 125% width. Fonts are subset (pyftsubset, latin + punctuation): Archivo 79 KB, Space Mono 2×14 KB, Caveat Brush 66 KB (not preloaded, `font-display:swap`). Archivo and Space Mono 700 are preloaded.

## 5. Colour tokens (sampled with ImageMagick from the logo and the real photos)

| Token | Hex | Source (sampled) | Use |
|---|---|---|---|
| `--sky` | `#ABD4E8` | logo disc `#ABD4EA` | page base, hero, Alexander section, chips |
| `--ink` | `#1E1D18` | logo peaks `#1E1D18` | text, shadows, borders, builder bg |
| `--sun` | `#F4C06A` | logo sun `#F4C06A` | highlight words on dark, dock, Getting there |
| `--lava` | `#E4572E` | eruption plume, `3933a9bd` `#D5522C` (brightened) | primary buttons (ink text 4.58:1), stamps |
| `--lava-d` | `#B8401C` | darker plume | small accent text on paper (4.89:1) |
| `--dawn` | `#8A9EE8` | sunrise sky, `3933a9bd` `#8A9EE8` | "The pass" section |
| `--night` | `#131D33` | night sky, `fuego_eruption_night_lava_city_lights` `#131D33` | "Pick your seat", Midnight stub |
| `--ember` | `#6D1E13` | cabin canvas shadow, `0bd7af40` `#6D1E13` | Camp section |
| `--canvas` | `#CC9A68` | lit cabin stripe `#CC9A68` | cabin-stripe divider |
| `--teal` / `--rose` | `#249B96` / `#B42C44` | woven blankets in the cabin video | reserved accents (camp gallery, rental chips) |
| `--paper` | `#F7F0E3` | ticket stock (warm white from the cloud/canvas tones) | tickets, VS, FAQ |
| `--muted` | `#5E5A4E` | — | secondary text on paper (6.08:1) |

Checked contrast: ink/paper 14.9 · ink/sky 10.7 · ink/sun 10.1 · ink/lava 4.58 · ink/dawn 6.5 · paper/night 14.8 · sun/night 10.1 · paper/ember 10.0 · sun/ember 6.8 · muted/paper 6.1. Every text pair is AA. Lava is never used for small text on paper.

## 6. Imagery plan (real Solex photos only; resized copies in `img/`, ≤1600 px, webp q68–80)

| File (`img/`) | Source | Where | Crop / focal point |
|---|---|---|---|
| `hero-fuego-sunrise.webp` (768×1016, 36 KB) | site `gallery01/3933a9bd_original.jpg` | Hero ticket photo | `object-position:50% 28%`. The plume sits in the upper-left third, the headline on the dark cone at the bottom (scrim from 64%). On desktop the full portrait sits in the left 44% of the ticket. |
| `fuego-night-plume.webp` | owner `fuego_eruption_night_red_plume.jpg` | "Pick your seat": real photo from camp | 4:5 on mobile / 3:4 on desktop, `50% 40%`. Keeps the fence post and plume. |
| `cabin-door-fuego.webp` | site `0bd7af40_original.jpg` | Camp: "The view from your door" | 3:4, centred on the door frame |
| `sunset-camp-fuego.webp` | owner `sunset_man_fuego.jpg` | Camp: "Sunset from camp. No extra hike." | 3:4 (mobile) / 4:3 (desktop), sun and Fuego both in frame |
| `cabins-path-fuego.webp` | owner `cabins_path_fuego_day.jpg` | Camp: cabin row facing Fuego | 16:10 mobile at `50% 70%` (path + cone), 4:3 desktop |
| `cabin-interior.mp4` (640 w, 383 KB, muted) + `cabin-interior-poster.webp` | owner `cabin_interior_beds.mp4` | Camp: inside a cabin, looping | 848:474. Loaded only when in view; autoplays muted only without reduced motion. |
| `trailhead-group.webp` | site `image01.jpg` | Alexander: "Start line" | 5:4, `60% 50%`, "Bienvenidos / Welcome" sign readable |
| `backpack-agua.webp` | site `image05.jpg` | Travel light, rent the rest | 4:3, `50% 60%` |
| `fuego-night-city.webp` | owner `fuego_eruption_night_lava_city_lights.jpg` | Final CTA background | cover, `60% 30%`, heavy bottom scrim |
| `logo.webp` (trimmed, alpha) | `site/logo.png` | Header (46 px), pass, footer | Ink ring added in CSS so the pale disc reads on sky |
| `summit-sunrise.webp`, `summit-group-dawn.webp`, `sunset-camp-group.webp`, `campfire.webp`, `green-cabins.webp`, `cabin-fuego-day.webp` | site gallery + owner | Full site: a "camp life" gallery strip under Camp, OG/social images, and Other-pass thumbnails once Alexander confirms where each was shot | 4:3 crops |

## 7. Motion language: *print · punch · stamp · tear*

- **Print**: on load, the hero ticket feeds out of a slot (clip-path reveal top to bottom, 0.9 s, `cubic-bezier(.2,.8,.2,1)`). Headline lines rise in with a 120 ms stagger. Sections fade up 26 px as they enter the viewport (IntersectionObserver, one-shot).
- **Stamp**: "Max 8 per guide" and "Ready to send" land like rubber stamps (scale 2.2 → 1, rotate, spring overshoot). "Ready" only stamps once the pass has a date (or "flexible").
- **Split-flap**: when the total changes, each changed digit flips like a departure board (rotateX, 45 ms stagger).
- **Pan**: the seat viewfinder pans the panorama 0.9 s between seats. Small eruption puffs rise, the crater glow breathes and lava dashes flow down the right flank.
- **Tear**: on send, the pass stub rotates 9° and drops off along the perforation while WhatsApp opens. It reattaches after 2.2 s.
- **Marquee**: slow 46 s loop.
- **Reduced motion** (`prefers-reduced-motion: reduce`): every animation and transition is effectively off. Reveal content is visible from the start, the marquee becomes a static wrapped list, the video shows its poster with a Play button, the viewfinder snaps without panning, and the tear doesn't play (the link still opens). `?static=1` forces the same mode (used for screenshots).

## 8. Signature interactions

1. **Build & tear your Summit Pass.** As you choose tour, date, people, pickup and extras, a paper pass fills in live: a pass number (`SLX-OVN-0811-03`), a guide count (9+ people → "2 local guides, we add one for every 8 people"), and a total in **GTQ and USD** that flips like a departure board. Its **skyline barcode** is drawn from the bars of the logo's twin peaks and Fuego's cone, and the bar widths are seeded from your pass details, so every pass "encodes" itself. Once there's a date, the pass gets the **READY TO SEND** stamp. **Tear & send** opens WhatsApp with the message and plays the tear-off.
2. **Pick your seat (viewfinder).** Two big seat buttons, *Seat L: Left side, most Antigua groups* and *Seat R: Right side, the Solex camp*. The illustrated viewfinder pans between the views: from the left, city lights ahead with Fuego cut off at the frame edge; from the right, Fuego centred, small puffs, lava on the right flank, the sunset, the volcano chain and Lake Atitlán. The bullet list swaps, and the real camp photo sits beside it as proof.
3. **The stub that follows you.** The sticky dock is a die-cut ticket stub (masked notches and a perforation) in logo-sun yellow. It hides while the hero CTA or the pass's own send button is on screen, and over the final CTA and footer. After you've filled in the pass, it rewrites itself into your live booking ("SUN 8 NOV · 3 PPL / Q2,250 · US$300 / **Send pass**"), so the booking is one tap away from anywhere on the page.

## 9. WhatsApp booking flow

**Fields:** 01 Tour (4 radio tickets, Overnight preselected) · 02 Date (native date picker, min = today, "my dates are flexible") · 03 People (stepper 1–50, guide-count hint) · 04 Pickup (Café Condesa, Parque Central / Café La Parada, Parque La Merced) + *After the tour* (Back to Antigua / On to Panajachel; Overnight only) · 05 Extras (porter up Q250, porter down Q250, rent jacket / backpack / headlamp / poles / shoes) · 06 First name (optional).
Nothing is required. A missing date is sent as "not decided yet", so nobody is blocked.

**Link:** `https://wa.me/50248347003?text=<encodeURIComponent(message)>` (a real `<a target="_blank">`, so no popup blockers). Fallback note after sending: +502 4834 7003 / +502 4946 8883.

**Exact template** (live example):

```
Hola Alexander! I'd like to book a Summit Pass with Solex Tours.

Pass: SLX-OVN-0811-03
Tour: Acatenango Overnight (2 days / 1 night)
Date (fecha): Sunday, 8 November 2026
People (personas): 3
Pickup (salida): Café La Parada, Parque La Merced, Antigua — 8:00 AM (please confirm)
After the tour: back to Antigua
Extras: Porter up (13 kg); rental: headlamp
Estimated total: Q2,250 / US$300 (Q750 / US$100 per person)

Name: Ana

Is there space for us? ¡Gracias!
```

Lines are conditional: *After the tour* only for the Overnight; *Extras* and *Name* only when filled in; "— flexible" is appended to the date when ticked. Pickup times per tour: Overnight 8:00 AM *(please confirm)*, Midnight 10:30 PM, Sunset 10:30 AM, Express 5:00 AM.

## 10. Mobile sticky CTA

- Fixed, 10 px from the sides and bottom, plus `env(safe-area-inset-bottom)`. 68 px tall. Sun-yellow stub with two masked half-circle notches and a dashed perforation separating info from action. A drop shadow follows the die-cut (`drop-shadow(4px 4px 0 ink)`).
- Left: mono label + display price ("OVERNIGHT · FROM / Q750 · US$100"). Right: a 168 px lava button, **Build pass →** (anchor to #build) or **Send pass →** (wa.me link).
- Visibility uses IntersectionObserver. It's hidden while the hero CTA, the pass's own send stub, the final CTA or the footer are visible, slides away with `visibility:hidden` (not focusable), and is a labelled region ("Quick booking").
- Desktop: the same stub floats bottom-right at 440 px.

## 11. Desktop adaptation (≥1024 px)

- **Hero** becomes a horizontal admission ticket (max 1280 px): the photo fills the left 44%, a vertical perforation has notches top and bottom, the headline is ink-on-paper at 128–140 px, trust chips sit under the promise, and the stub carries the price, barcode, included list and a CTA row. The "Max 8" stamp straddles the perforation.
- **Pick your seat:** copy and viewfinder on the left, the real photo sticky on the right.
- **VS:** 3-column table with a row-header column.
- **The pass:** ticket on the left (two-column inclusions, three extras side by side), sticky itinerary on the right.
- **Camp:** a mosaic (video spans two rows, door photo tall, sunset + path stacked).
- **Book:** form on the left, the pass sticky on the right (the pass is always visible while filling in).
- **Route:** A → D horizontal with a dashed line.
- Nav links appear in the header. The dock floats bottom-right.

## 12. Accessibility & performance

- Semantic landmarks, skip link, one H1, ordered H2s. Seat toggles use `aria-pressed`. The view list is `aria-live`, and the total has a visually hidden text copy (the flip digits are `aria-hidden`). The form uses fieldsets and legends, real radio/checkbox inputs (visually restyled), and focus rings on every control (`:focus-visible`, sun on dark, ink on light). Touch targets are 44–60 px. The VS table keeps ARIA table roles on its grid layout. FAQ uses native `<details>`.
- No framework. ~28 KB gzipped HTML+CSS+JS. Hero image 36 KB, preloaded with `fetchpriority=high`. Every other image is lazy with explicit width/height (no CLS). The video loads only on view (383 KB). Fonts are self-hosted subsets.

## 13. Content flags for Alexander (before launch)

1. **Overnight pickup time:** latest voice note says **8:00 AM**, current site says 6:30 AM. The prototype shows "8:00 AM*" with "your exact time comes with your WhatsApp confirmation".
2. **Meals:** voice notes say 3 (lunch, dinner, breakfast). The current site says 4. The prototype uses 3.
3. **Gloves & hats:** listed on the current site for the Overnight but not in the voice notes. Left out until confirmed. "Certified guide" (current site) is also dropped until verified.
4. **Fuego extra hike:** shown only as a small optional line (Overnight extras + one FAQ), exactly as Alexander describes it (decided at camp, ~4 h, Q300, paid there, no prepayment). No legal statements on the site, per the client directive. It's never in the hero, marquee or headlines, and can be removed in one edit if the legal check says so. The "Extras" row in the VS table is generic ("decide at camp, pay there").
5. **Community line** ("guides, porters and cooks from La Soledad and around Acatenango") needs his wording.
6. **Rental prices** are unknown: "Ask on WhatsApp".
7. **Reviews:** only real, linked reviews go in the three placeholder slots.
8. **Payment method/deposit:** not stated anywhere. The FAQ says Alexander confirms payment details on WhatsApp.

## 14. Files

- `index.html`: prototype. Add `?static=1` to turn off motion and lazy loading (used for full-page screenshots).
- `css/site.css`, `js/site.js`, `fonts/` (OFL subsets), `img/` (resized webp + 640 px mp4), `favicon.png`
- `screenshots/`: `m-first.png` (390×844 @2x), `m-full.png` (390 wide), `d-first.png` (1440×900), `d-full.png` (1440 wide), plus interaction states: `m-seatL.png` (Seat L view), `m-pass.png` (filled pass with READY stamp), `m-dock.png` (dock showing the live booking + Send pass).
