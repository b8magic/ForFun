# Concept B: "Hecho en La Soledad" (Made by locals)

**Key:** `B-made-local`
**Prototype:** `index.html` (+ `css/site.css`, `css/textile.css`, `js/site.js`, `img/`, `video/`). Vanilla HTML, CSS and JS, about 30 KB gzipped before media.
**Screenshots:** `screenshots/` (m-first, m-full, d-first, d-full, plus interaction states: m-dock, m-sheet, m-sheet-preview, m-view-night, m-view-sunset, m-sight-usual, d-sheet). Add `?static=1` to the URL to turn off scroll reveals for captures.

---

## 1. The big idea

The website reads like a note Alexander hands you at his front door in La Soledad. It is sewn from the same woven blankets that are waiting in the cabins, and it is stamped with the family's own word.
Every claim on the page is something a real family at the trailhead can show you (the seat facing Fuego, eight hikers per guide, a bed already up there), and everything they can't promise is said out loud.

## 2. Why it converts

The buyer is an international traveller in Antigua, usually on a phone and often booking the night before. They are choosing between dozens of near-identical $90–120 listings resold by hostels. These are their fears: a herd of 40 people, overpromises, a bad camp spot, not knowing who they're dealing with, and a fiddly booking. The concept answers each one at the moment it comes up:

| Fear | Answer on the page |
|---|---|
| "Is this another reseller?" | A named person and a real place. "¡Hola! I'm Alexander", the trailhead house, the note from Alexander, a CTA that says "You write to Alexander directly". |
| "Will it be a herd?" | **The loom:** 60 ghosted stitch figures (Alexander's old groups) set against 8 hikers and one red guide. Headline: "Eight hikers per guide. Nine of you? Two guides go." |
| "Is the view really better?" | **Sightline schematic** (left-side camps vs. our camp) plus **"One view, three shows"** in a cabin-door frame (afternoon, sunset, after dark), all real camp photos. |
| "Will they overpromise?" | The **"Our word" ticket** with a stamp, then a **"What we won't promise"** card (clear skies, private cabin, fluent English). Being honest about weak points makes the strong points believable. |
| "What does it cost, really?" | The price (Q750, ≈ US$100 per person) and what it covers are on the first mobile screen. The full included list is on the ticket. |
| "Booking is a hassle" | **"Note to Alexander":** about 20 seconds of taps builds a polite, complete WhatsApp message with a Spanish summary line, so Alexander can confirm without the usual back-and-forth. |

Conversion mechanics: one primary action everywhere (red, stitched "Check a date on WhatsApp"); a sticky dock that appears once the hero CTA scrolls away and hides at the booking section; every "book" link opens the same pre-filled slip; a "Just a question? Chat without the form" escape hatch for people who don't want a form.

## 3. Information architecture (whole site, one page plus anchors)

| # | Section | Purpose | Content intent |
|---|---|---|---|
| 0 | Header | Identity and an always-visible booking action | Logo patch, "Solex Tours · La Soledad · Acatenango", WhatsApp button (icon on mobile, "Book on WhatsApp" on desktop). Desktop nav: The camp / Overnight tour / The two days / Getting there / Questions. Selvedge stripe on top. |
| 1 | **Hero** | Sell the experience, show the price, start the booking | Arched night photo of Fuego erupting (real, from camp), hand note "the view from our cabins" with an arrow to the plume, H1 "Sleep facing *Fuego.*", one-line promise, **Q750 per person ≈ US$100** with what it covers, CTA, "You write to Alexander directly". Desktop adds Alexander's taped "¡Hola!" note. |
| 2 | Woven label ribbon | Three proof points at a glance | 2–8 hikers per guide · Camp facing Fuego · Family-run at the trailhead, with pixel-stitch icons. |
| 3 | Story / Note from Alexander | Trust: the founder's reason for existing | Pull quote: "If you pay for a tour, you should enjoy it *without being rushed.*" A lined-paper letter (groups of 35–60 → went independent → local guides, small groups), signed and marked "translated from his voice notes". Photo of the cabin door framing Fuego. |
| 4 | **The camp (right side)**, dark night section | Main differentiator | H2 "We camp on the right side. *Fuego is straight ahead.*" Left-vs-right **sightline toggle** (marked "schematic, not a map"). **Door-frame view switcher**: Afternoon / Sunset / After dark, with Alexander's quotes. "Our honest bit": we can't promise clear skies or eruptions, only the seat. |
| 5 | Small groups, local guides | The second differentiator, plus honesty about language | The loom (60 then, 8 + guide now). Guides are from the area and speak mainly Spanish and a little English, stated plainly. Warm, good-hearted, entertaining; "make sure people leave happy". |
| 6 | **The Overnight (ticket)** | The offer | Badge "Our most popular tour", title, 2 days/1 night · cabin facing Fuego · sunrise on the 3,976 m summit, **Q750 + stamp**, perforation, 7 included items, CTA, "Morning pickup; exact time confirmed when you book". Beside it: "What we won't promise" and "What you bring" (4 L water is the golden rule, warm clothes, day pack → rent). |
| 7 | The two days (thread timeline) | Remove uncertainty about logistics | Woven-thread timeline: Day 1 Antigua café → ~1 h → Alexander's house (bathroom, instructions, luggage, meet guide) → climb (lunch) → camp → sunset & night. Day 2: ~1 h to the summit for sunrise → coffee & breakfast → descent → drop-off or toward Panajachel. Two real photos. |
| 8 | Inside a cabin (video) | Make "bed already up there" tangible | Real 10 s loop of the cabin beds and Guatemalan blankets in a fret frame, play/pause button. Cabin row and new green cabins. "Cabins sleep six and are shared." |
| 9 | Travel light (gear + porter) | Upsell and anxiety relief | Rentals: jackets, backpacks, headlamps, poles, shoes. Porter: 13 kg, Q250 up / Q250 down. "Ask for rental prices." |
| 10 | Getting there | Logistics trust | Pins: Café Condesa (Parque Central), Café La Parada (Parque La Merced), each opening Maps. ~1 h to La Soledad. Luggage stays at the house ("Things don't go missing here"). Panajachel onward option saves ~40 min. |
| 11 | Other ways up | Catch people with less time | Midnight sunrise (10:30 PM, Q750), Sunset (10:30 AM, Q750), One-day express (5:00 AM, Q675). Each has "Ask about this tour", which pre-selects the tour in the slip. |
| 12 | In their words | Social proof, never invented | Three **clearly labelled placeholder** slots for real Google/TripAdvisor reviews (name, country, month, source link). |
| 13 | Honest answers (FAQ) | Answer objections | English level, private cabin, clouds, suitcase, difficulty, Fuego (conditional, see below), payment ("Alexander explains when he confirms"). Native `<details>`. |
| 14 | **Write a note to Alexander** | Booking | The slip form inline (desktop: two columns with a live preview). The same DOM node moves into the bottom sheet on mobile. |
| 15 | Footer | Contacts | Patch, name, La Soledad address, both WhatsApp numbers, Instagram @solextours_acatenango, Facebook/Google "Solex Tours", "Gracias for supporting community guides" (from the current site). |
| — | Sticky dock (mobile) | Persistent CTA | See §10. |

**Fuego extension:** this is deliberately *not* a product, price or headline. It appears only as one FAQ answer: "Access to Fuego is set by the authorities and the rules change, so we only offer what's allowed at the time. If anything is possible, you decide at camp and pay there. Never in advance." There is no price and nothing to book online until the legal status is confirmed.

## 4. Typography (Google Fonts, all SIL OFL)

| Role | Family | Use | Mobile | Desktop |
|---|---|---|---|---|
| Display | **Fraunces** (variable; `SOFT` 100, `opsz` 9–144, wght 500–800, italic 400–600) | H1/H2, prices, pull quote. The soft, inky, slightly wonky serif reads as letterpress or hand-carved: warm and premium, not "adventure-bro". Italic carries the emotional second line ("*Fuego.*", "*without being rushed.*"). | H1 48–64 px / 0.94 (13.4vw); H2 32–40 px / 1.02; price 46–76 px | H1 76–118 px / 0.9; H2 up to 60 px; ticket price 104 px |
| Text / UI | **Figtree** (400–800) | Body, buttons, labels, kickers. Friendly geometric that stays legible at 14 px on cheap Android screens. | Body 17–17.5 / 1.5; small 14; kicker 12.5 caps +0.14em | Body 18–20 |
| Hand | **Caveat** (500–700) | Alexander's voice only: margin notes, signature, "Note to Alexander", the thread's "Day 1 / Day 2". It's the human layer, and never used for information you need to act on. | 22–30 px | 30–38 px |

Payload: one CSS request, `display=swap`, latin subsets only. For production, self-host the woff2 subsets and preload Fraunces 700 + Figtree 400.

## 5. Colour tokens (sampled with ImageMagick from the logo, the cabin video and the camp photos)

| Token | Hex | Source (sampled) | Use |
|---|---|---|---|
| `--manta` | `#F7EFE4` | Cream of blanket and wall stripes (`#E7B3A4`/`#E2DDDB` lightened) | Page ground, with a fine 3 px canvas weave |
| `--manta-2` | `#EFE3D2` | — | Alternate sections |
| `--paper` | `#FFFBF4` | — | Note, ticket, slip |
| `--ink` | `#1E1D18` | Logo peaks `#1E1D18` | Text, dock |
| `--ink-2` | `#5A4A44` | Cabin shadow brown `#5C4B47` | Secondary text (7.4:1 on manta) |
| `--sky` | `#A8D1E6` | Logo circle `#A8D1E6` | "Now" loom card, "What you bring", gear section |
| `--sun` | `#F4C06A` | Logo sun `#F4C06A` | Accents on night, selected tab, hand notes on photos |
| `--red` | `#A8232B` | Cabin wall stripe `#A52425` / `#9E171E` | Primary CTA (white text 7.1:1), kickers, stamp |
| `--red-deep` | `#7A1A21` | — | CTA pressed edge |
| `--pink` | `#D97F95` | Blanket pink `#BF7388` | Rombo motif |
| `--teal` / `--teal-ink` | `#1F8F8B` / `#0F6461` | Sleeping bag `#219B98` | Check marks (decorative); teal text 6.1:1 |
| `--cobalt` | `#2F6F8F` | Sleeping bag `#2F7492` | Lined-paper rules |
| `--mauve` | `#5E3A40` | Fret blanket ground `#5F343B`/`#574650` | Fret band, "What we won't promise" card |
| `--stripe` | `#EFD9C6` | Cream stripe of cabin walls | Door frame |
| `--night` / `--night-2` | `#0F1524` / `#1A2440` | Eruption sky `#06080B`, `#1D3052` | Camp section |
| `--mist` | `#A9B4C8` | Night cloud `#B7BAC0` | Secondary text on night (8.7:1) |
| `--lava` | `#F76852` | Red plume `#F76852` / `#FC876E` | Plume pixels, glints (6.1:1 on night) |

All text pairs meet WCAG AA, most meet AAA. Teal, pink and sun are never used for small text on cream.

## 6. Graphic language: the woven system

The motifs are drawn as pixel "stitch" maps (`tools/gen-textile.js` → `css/textile.css`, run `node tools/gen-textile.js css/textile.css`, data-URI SVGs at about 1.7 KB gzipped). Each one is lifted from something real:

- **Fret band**: the interlocking key on the rolled blankets in the cabin video, cream on mauve between red selvedges. It separates the hero from the story.
- **Volcano band**: the logo's twin jagged peaks and sun, re-woven as 1-pixel stairs. It tops the ticket and the footer.
- **Rombo band**: huipil-style diamond chain in red, pink and sun. It opens the cabin section and doubles as "tape" on Alexander's notes.
- **Selvedge**: a multicolour edge stripe used on the header, the dock, kickers and the slip.
- **Door stripes**: the red/cream striped curtain walls in the cabin-door photo, rebuilt in CSS as the frame of the view switcher.
- **Stitch figures**: a hiker in ink, a guide in red with a sun-coloured hat. They fill the loom and the group stepper.
- **Stitched details**: dashed inner outline on buttons (a running stitch), on the hero arch and on chips. The logo appears as a sewn-on **patch** that overlaps the arch.
- The **arch** frame quotes Antigua's colonial arches. It's where every traveller starts.

## 7. Imagery plan (real photos only; copies in `img/`, ≤1600 px, q78 WebP)

| Placement | Source file | Output | Crop / focal point |
|---|---|---|---|
| Hero arch | `owner/fuego_eruption_night_red_plume.jpg` | `night-plume-{800,1200,1600}.webp` (600/900/1200 w), preloaded | `object-position: 43% 34%` (plume). Arch keeps the plume in the upper third and the dark slope under the H1. |
| Story | `gallery01/0bd7af40_original.jpg` (cabin door framing Fuego) | `door-fuego-{800,1280}` | Full frame, rotated +2° as a print |
| View: Afternoon | `owner/cabin_fuego_day.jpg` | `cabin-fuego-day-{800,1200}` | `70% 50%` (cabin + cone) |
| View: Sunset | `owner/sunset_man_fuego.jpg` | `sunset-fuego-{800,1024}` | center; sun and Fuego both in frame |
| View: After dark | `owner/fuego_eruption_night_lava_city_lights.jpg` | `night-lava-{800,1200}` | center (lava + ash) |
| Two days | `owner/sunset_group_three.jpg`, `gallery01/6c07d214_original.jpg` | `sunset-group-*`, `summit-sunrise-*` | 4:5 and 3:4.6 |
| Cabin | `owner/cabin_interior_beds.mp4` → `video/cabin-beds.mp4` (720 w, H.264 CRF 32, no audio, faststart, 372 KB) + poster `cabin-beds-poster.webp` | — | Loops only when visible and motion is allowed |
| Cabin pair | `owner/cabins_path_fuego_day.jpg`, `owner/new_green_cabins.jpg` | `cabins-path-800`, `green-cabins-800` | 3:4 / 4:3.4 |
| Gear | `site/assets/images/image05.jpg` (backpack facing Agua) | `backpack-agua-884` | Arch, `50% 80%` (backpack) |
| Logo patch | `site/logo.png` (transparent ring) | `logo-patch-360.webp`, `favicon-64.png` | Trimmed |

Reserve for a full build: `3933a9bd` (Fuego at dawn), `435e7f25` / `8a98a90b` (summit groups), `ec2669a1` (camp fire), `942c4bdf` (ash trail with dog), `df16b529` (group before the hike). One photo is missing and should be **commissioned**: Alexander at his house, for the note.

Total images in the prototype: about 1.2 MB, but only about 130 KB loads on the first mobile view. Everything below the fold is `loading="lazy"` with `srcset`/`sizes`.

## 8. Motion language: "woven, not flashy"

| Motion | Where | Spec | Reduced motion |
|---|---|---|---|
| **Weave-in** | Every band | `clip-path` reveals left→right in `steps(18)`, like a shuttle passing a row | Shown complete |
| **Settle** | Cards, photos | 18 px rise + fade, 0.7 s, `cubic-bezier(.2,.7,.2,1)` | Static |
| **Stamp press** | Ticket stamp | scale 1.8 → 1, rotate −30° → −14°, overshoot ease, 0.55 s, 0.5 s delay | Stamp already placed |
| **Loom fill** | "Now" figures | Figures appear one by one (40 ms stagger), the guide last | All shown |
| **Crossfade** | View switcher | 0.7 s opacity; swipe or arrow keys | Instant swap |
| **Plume flicker** | Sightline Fuego | Pixel opacity `steps(3)` loop | Single frame |
| **Sheet rise** | Booking dialog | 40 px rise + fade, 0.38 s | Instant |
| **Dock** | Sticky CTA | Slides up 0.45 s after the hero CTA leaves the viewport | Instant |
| Video | Cabin loop | Autoplays muted only in view; pauses off-screen | Never autoplays (poster + play button) |

## 9. Signature interactions

1. **"From the cabin door": the right-side camp proof.** A sightline toggle ("Usual camps" / "Our camp") swings a view cone from Antigua's city lights to Fuego. Next to it, a frame built from the cabin's own red-and-cream curtain walls holds three real photos of the same view: **Afternoon → Sunset → After dark**, each captioned with Alexander's words ("We don't need to walk anywhere else"). Implemented as accessible ARIA tabs with arrow keys and swipe. It closes with the honest line: *we can't promise clear skies, we can promise the seat.*
2. **"Our word": the stamped ticket.** The offer is a paper ticket topped with the volcano band and perforated under the price. When it scrolls into view, a red-ink stamp ("WHAT WE TELL YOU IS WHAT WE GIVE YOU · SOLEX · LA SOLEDAD", with the twin peaks) presses on beside Q750. The reverse side is a mauve card titled **"What we won't promise"**. The stamp makes Alexander's sentence "What we tell you is included is what we give you" into something physical.
3. **"Note to Alexander": the slip with the guide loom.** Booking feels like writing a note, not filling in a form. The group stepper weaves stitch figures as you tap, and at 9 people a **second red guide appears**, with "2 local guides go. Max 8 hikers per guide." A WhatsApp bubble builds the message live. On mobile the same form moves into a bottom sheet with the Send button always visible. On desktop it splits into fields and a sticky preview.

(Supporting moment: the **loom** in the groups section, 60 ghost figures against 8 + 1, turns Alexander's story into a picture you take in at a glance.)

## 10. WhatsApp booking flow

**Entry points:** hero CTA, header button, ticket CTA, the three "Ask about this tour" links (they pre-select the tour) and the mobile dock. All open the slip. Without JS they are plain `wa.me` links, so booking still works.

**Fields** (only the tour is set by default; everything else is optional or one tap):
1. Tour: select (Overnight default / Midnight sunrise / Sunset / One-day express)
2. Date: native date picker, `min` = today, plus a "My dates are flexible" checkbox
3. How many: − / + stepper (1–24), with stitch figures and a guide count (`ceil(n/8)`)
4. Pickup: two radio cards (Café Condesa, Parque Central / Café La Parada, Parque La Merced)
5. Extras: toggles for Rent gear · Porter (Q250 each way) · Going on to Panajachel
6. Name (optional)

**Send:** `https://wa.me/50248347003?text=<encoded>` (new tab). Secondary links: "Chat without the form" (`?text=Hi Alexander! I have a question about Acatenango.`) and the second number +502 4946 8883.

**Exact pre-filled template (English, with a one-line Spanish summary for Alexander):**

```
Hi Alexander! I found Solex Tours on your website and I'd like to book.

Tour: {Acatenango Overnight (2 days / 1 night, Q750 pp) | Midnight sunrise tour (leaves 10:30 PM, Q750 pp) | Sunset tour (leaves 10:30 AM, Q750 pp) | One-day express (leaves 5:00 AM, Q675 pp)}
Date: {Sunday, 8 November 2026 | not fixed yet}{ (my dates are flexible)}
People: {n}
Pickup: {Café Condesa, Parque Central | Café La Parada, Parque La Merced}
[Extras: {gear rental (please send prices)}, {a porter (Q250 up / Q250 down)}]
[After the tour: I'm going on to Panajachel]

Could you confirm availability and the pickup time? Thank you!
[{Name}]

(ES) {Tour 2D/1N | Tour de media noche | Tour de atardecer | Tour de un día} · {08/11/2026 | fecha por confirmar} · {n} personas · {Café Condesa | Café La Parada}
```

`screenshots/m-sheet-preview.png` shows the live bubble for 4 people on 8 Nov 2026 with a porter.

## 11. Mobile sticky CTA (the "dock")

- A floating ink card, 10 px from the screen edges, radius 18, with a woven selvedge along its top edge. It sits above `env(safe-area-inset-bottom)`.
- Left: **"Overnight · Q750"** (Fraunces 19) / "per person · ≈ US$100" (mist). Right: the red stitched button **"Check a date"** with the WhatsApp glyph, at least 52 px tall.
- Appears after the hero CTA leaves the viewport, and hides while the booking section is on screen (no duplicate CTAs). While hidden it is `aria-hidden` and has `tabindex=-1`.
- Tap → the bottom-sheet `<dialog>` ("Note to Alexander"), with a native focus trap, Esc/backdrop to close, and focus returned to the opener. The sheet has its own sticky Send bar, so the action is always one thumb-reach away.

## 12. Desktop adaptation (≥ 960 px)

- Sticky, translucent header with nav and a "Book on WhatsApp" button. The dock is removed and the sheet becomes a centred two-column dialog (fields left, live preview + Send right, sticky).
- **Hero:** split grid. Left: Alexander's taped "¡Hola!" note, kicker, a huge H1 (up to 118 px) with "*Fuego.*" in red on its own line, lede, price, CTAs. Right: a tall arch (640–780 px) with a 150 px patch overlapping its shoulder.
- Story: the quote and note on the left, the door print on the right. Camp: the sightline panel is sticky while the door switcher sits beside it. Groups: the loom left, guides' honesty right. Ticket: the included list in two columns with a 168 px stamp. The timeline's photos are sticky. Video beside the cabin copy. FAQ and booking each use a sticky heading column.
- Max width 1240 px, 40 px gutters, section rhythm of 110 px.

## 13. Accessibility & performance

- Skip link. Semantic sections, each labelled by its heading. A double focus ring (ink + sun) that's visible on cream and on night. All targets ≥ 44 px. Tabs follow the ARIA pattern (roving tabindex, ←/→/Home/End). The sightline is `role="img"` with title/desc and a live caption. The stepper output is `aria-live`. The video has a label and a play/pause button.
- `prefers-reduced-motion` turns off reveals, the stamp animation, the plume loop and video autoplay.
- No framework. The first view is about 310 KB including fonts (HTML 11 KB, CSS 13 KB, JS 4 KB gzipped, hero 111 KB, patch 20 KB). Images are responsive and lazy, the hero is preloaded with `fetchpriority="high"`, and the video is `preload="none"` until visible.

## 14. Copy and facts to confirm with Alexander before launch

1. **Pickup time:** the latest voice note says 8:00 AM, the current site says 6:30 AM. The page says "Morning pickup; Alexander confirms the exact time".
2. **Meals:** 3 meals (voice notes) vs "4 tiempos" (site). The page uses 3: lunch + dinner on day 1, breakfast on day 2.
3. **Gloves & hats:** listed on the current site for the overnight, but not in the voice notes. Left out of "What's included" until confirmed.
4. **Fuego extension:** legal status (authorities restrict ascents). Kept as one conditional FAQ line with no price.
5. Confirm the hero night photo was taken at the Solex camp (the caption claims "the view from our cabins").
6. Rental prices, payment and deposit method, cancellation and weather policy, and who provides the onward transport to Panajachel.
7. Real reviews (three slots), a portrait of Alexander at his house, and guide names/photos if they agree.
