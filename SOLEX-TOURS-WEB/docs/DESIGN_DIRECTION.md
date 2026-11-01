# FINAL DIRECTION: "Sleep Facing Fuego · Hecho en La Soledad"

**Solex Tours, Expedición Volcán Acatenango.** New English site, mobile-first, vanilla HTML/CSS/JS.
**Decision by:** design director, 2026-11-01.
**Base:** Concept B "Hecho en La Soledad". **Grafts:** A's light journey, D's first-screen logistics and group gauge, C's live booking dock.

This document is the build spec. If something isn't specified here, follow B's prototype (`/tmp/solex_concepts/B-made-local/`). Where this spec and B's prototype disagree, this spec wins.

Sources of truth, in priority order:
1. `/tmp/solex_raw/CLIENT_DIRECTIVES.md`
2. Alexander's words in `/tmp/solex_raw/transcript.txt` and `/tmp/solex_raw/about_owner_summary.txt`
3. `/tmp/solex_raw/site_text.txt`

Nothing on the site may go beyond these sources. Every item marked **[CONFIRM]** is listed in Appendix B.

---

## 1. Concept

### 1.1 Name and big idea

**Sleep Facing Fuego · Hecho en La Soledad**

> The site is a note Alexander hands you at his front door in La Soledad. It is woven from the same blankets already waiting in your cabin, and its one big picture is **your cabin door**: one view of Fuego, lit differently as the hours pass. Every claim on the page is something a real local operator can show you, and everything they can't promise is said out loud.

The site has two doors and one day:
- **Alexander's door in La Soledad**, where the trip and the page start: the "¡Hola! I'm Alexander" note, the letter, luggage that "doesn't go missing here".
- **Your cabin door facing Fuego**, where the trip pays off. A frame built from the cabin's red-and-cream curtain walls holds the same view at afternoon, sunset and after dark.
- **The 24 hours in between.** The two-day itinerary changes colour with the time of day (manta morning, sky midday, gold sunset, night, blue hour, lavender dawn). The logo's sun travels down the woven thread of the timeline.

Tone: warm, plain-spoken, honest, handmade. It should feel like a small local operator, not a slick agency, a film festival or a gear brand.

### 1.2 Why this wins (judges cited)

| Concept | Conversion | Art direction | Mobile UX | Mean |
|---|---|---|---|---|
| **B · Hecho en La Soledad** | **8.6 (winner)** | 7.8 | **8.0 (winner)** | **8.13** |
| D · Contour | 8.2 | 7.4 | 7.4 | 7.67 |
| A · Front Row | 7.2 | **8.3 (winner)** | 6.0 | 7.17 |
| C · Summit Pass | 7.8 | 7.1 | 6.6 | 7.17 |

**B wins two of the three lenses and has no structural weakness.**
- **Conversion judge:** B turns "the brand's real asset, a named local man who tells you the truth, into the conversion engine". It is the "clearest value proposition in five words" ("Sleep facing Fuego."). It has the best CTA wording for a night-before buyer ("Check a date on WhatsApp", white on red, 7.1:1). It wins on "trust without reviews": the "What we won't promise" card, the stamp, and "Real footage… no staging". The judge's conclusion: *"B's trust architecture cannot be grafted onto them without changing their voice."*
- **Mobile judge:** B is the concept "I'd trust to ship to a mid-range Android without a performance or legibility rescue". It has the best type scale and sunlight legibility, only 4 text nodes under 12 px, the best booking sheet for a phone, and a visual idea that "costs almost nothing to run" (about 1.7 KB of SVG textiles). Its weak spots "are content and config fixes, not structural ones."
- **Art judge:** B is "the most ownable brand system of the four". Its woven motifs come from real material, and it rebuilds the logo's twin peaks as stitches. The curtain-wall frame is "the best photo-framing idea in the round". The loom is "the most memorable infographic in the competition".

**B's gap is spectacle.** The client asked for "the maximum of creative fantasy". The art judge calls B "charming rather than spectacular… desktop is under-composed". A closes that gap: its time-of-day colour journey is "the best art direction of the real photography". The art judge's first graft is to put A's light into B's door frame. We do exactly that.

What we take from each concept, and why:

| From | Graft | Judge rationale |
|---|---|---|
| **A** | The light journey: the door frame's view changes from afternoon to sunset to after dark as you scroll, and the timeline's colour moves through the day | Art judge, grafts 1 and 6 |
| **A** | "Website price: Q750 per person = Q2,250 total" in the message; total on the Send button; "Nothing is charged here" | Conversion judge, graft 7; Mobile judge, graft 4 |
| **A** | Motion is opt-in (`prefers-reduced-motion: no-preference`), with a 2.5 s force-visible safety net | Mobile judge, graft 6 |
| **A** | A jump menu, labelled honestly "Menu" | Mobile judge, graft 5 |
| **D** | Kicker "Overnight from Antigua"; pickup cafés and "~8:00 AM" on the first screen | Mobile judge, graft 1; Conversion judge, graft 2 |
| **D** | 6-cell legend in place of B's 3-item ribbon | Mobile judge, graft 2 |
| **D** | The numeral "~~35–60~~ → **2–8** hikers per guide" heads the loom; "Ask for N people" uses shared state | Conversion judge, grafts 1 and 3 |
| **D** | Every `wa.me` link carries prefilled text, so booking works without JS | Conversion judge, graft 3 |
| **D** | FAQ order starts with "What time is pickup, and where?" and "How do I book?" | Conversion judge, graft 3 |
| **D** | The Fuego add-on sits behind a one-line flag | Art judge, graft 7; Mobile judge |
| **C** | The dock rewrites itself into the live booking ("Sun 8 Nov · 3 people · Q2,250 → Send") | All three judges |
| **C** | A soft "How Alexander used to guide / How Solex walks" comparison with the honest footnote (no extras or Fuego row) | Conversion judge, graft 5 |
| **C** | A brush face (Caveat Brush) for Alexander's voice, echoing the marker "SOLEX" in the logo | Art judge, graft 5 |
| **C** | Self-hosted, subset fonts | Mobile judge, graft 8 |

What we deliberately do **not** take:
- A's film vocabulary ("Cold open", "Box office", "Wardrobe department"), HUD clock times, blur reveals and backdrop-filter.
- C's "Summit Pass" jargon, pass numbers, neo-brutalist poster voice and "vs" combativeness.
- D's crosshair, topo masks, 10–11 px mono text, top route strip and fake-precise altimeter.

---

## 2. Design tokens

Put all tokens in `:root` in `css/tokens.css`, which is inlined into the critical CSS.

### 2.1 Colour

Colours are sampled from the logo (`/tmp/solex_raw/site/logo.png`), the cabin video blankets and the camp photos (B's sampling, kept).

| Token | Hex | Source | Role |
|---|---|---|---|
| `--manta` | `#F7EFE4` | Blanket and wall cream | Page ground, with canvas weave |
| `--manta-2` | `#EFE3D2` | — | Alternate sections |
| `--paper` | `#FFFBF4` | — | Letter, ticket, booking slip, cards, inputs |
| `--ink` | `#1E1D18` | Logo peaks | Text, dock, footer, chips (checked) |
| `--ink-2` | `#5A4A44` | Cabin shadow brown | Secondary text |
| `--line` | `#D9C7B3` | — | Decorative rules only (never control borders) |
| `--control` | `#8A7A70` | — | Input and radio-card borders (non-text 3:1) |
| `--sky` | `#A8D1E6` | Logo circle | "Now" loom card, gear section, Afternoon phase |
| `--sky-pale` | `#DCEEF7` | Logo sky tint | Midday phase, info notes |
| `--sun` | `#F4C06A` | Logo sun | Accents on dark, focus halo, timeline sun |
| `--gold` | `#F3C46E` | Sunset band (`sunset_group_three.jpg`) | Sunset phase start |
| `--dusk` | `#E9A15B` | Sunset sky | Sunset phase end |
| `--red` | `#A8232B` | Cabin wall stripe | **Primary CTA**, kickers, stamp, selected border |
| `--red-deep` | `#7A1A21` | — | CTA pressed edge, hover |
| `--red-text` | `#9A1F27` | — | Error text, red text on manta (AA small) |
| `--selected` | `#FBE8E4` | — | Selected radio-card fill |
| `--pink` | `#D97F95` | Blanket pink | Rombo motif (decorative only) |
| `--teal` / `--teal-ink` | `#1F8F8B` / `#0F6461` | Sleeping bag | Check icons (decorative) / teal text |
| `--cobalt` | `#2F6F8F` | Sleeping bag | Lined-paper rules (decorative) |
| `--mauve` | `#5E3A40` | Fret blanket ground | "What we won't promise" card, fret band |
| `--stripe` | `#EFD9C6` | Curtain-wall cream | Door frame stripes |
| `--night` | `#0F1524` | Eruption sky | Camp night, Night phase, door "After dark" |
| `--night-2` | `#1A2440` | Night sky | Cards on night |
| `--bluehour` | `#22305A` | Pre-dawn sky | Before-dawn phase |
| `--dawn` | `#C8CEF3` | Sunrise lavender, lightened | Sunrise phase (ink text) |
| `--mist` | `#A9B4C8` | Night cloud | Secondary text on dark |
| `--lava` | `#F76852` | Red plume | Plume pixels and glints on dark only (never text on light) |
| `--bubble` | `#E2F7CB` | WhatsApp-like | Message preview bubble |
| `--bubble-bg` | `#E9DFD0` | — | Preview well |

**Contrast-checked pairs** (WCAG 2.x, computed). Use only these pairs for text.

| Text on background | Ratio | Allowed use |
|---|---|---|
| ink on manta / manta-2 / paper | 14.8 / 13.3 / 16.4 | All text |
| ink-2 on manta / manta-2 / paper | 7.4 / 6.6 / 8.2 | Secondary text, captions |
| white on red (`#FFF` / `#A8232B`) | 7.1 | CTA labels |
| paper on red | 6.9 | Stitch outline and label alternative |
| red on manta / paper | 6.3 / 6.9 | Kickers, prices, links |
| red-text on manta / paper | 7.1 / 7.8 | Error text |
| ink on sky / sky-pale | 10.4 / 14.2 | Text on sky sections |
| ink-2 on sky / sky-pale | 5.2 / 7.1 | Secondary on sky |
| ink on sun / gold / dusk | 10.1 / 10.4 / 7.8 | Sun chips, sunset phase |
| ink-2 on gold | 5.2 | Secondary on sunset phase |
| paper / sun / stripe on mauve | 9.5 / 5.8 / 7.2 | Honest card |
| paper / mist / sun on night | 17.7 / 8.7 / 10.9 | Night sections |
| lava on night | 6.1 | Accent text on night (≥ 15 px) |
| paper / mist / sun on bluehour | 12.4 / 6.1 / 7.7 | Before-dawn phase |
| ink / ink-2 on dawn | 10.9 / 5.4 | Sunrise phase |
| paper / sun / mist on ink | 16.4 / 10.1 / 8.1 | Dock, footer |
| ink / ink-2 / red on selected | 14.3 / 7.1 / 6.0 | Selected radio card |
| teal-ink on manta / sky-pale | 6.1 / 5.8 | Guide-count helper text |
| ink on bubble | 14.8 | Message preview |
| control border on paper / manta | 4.0 / 3.6 | Input borders (≥ 3:1 non-text) |

**Forbidden pairs:**
- red on sky (4.4): large text only, so avoid it entirely.
- sun on manta (1.5).
- lava as text on light backgrounds.
- paper on lavender or periwinkle (C's 2.28:1 failure).
- Any text over the mid-point of a dark↔light gradient (see 3.7).

**Red CTA on ink (dock), 2.4:1 boundary.** The button must carry the 1.5 px dashed paper "running stitch" inset outline (paper on red 6.9:1), so it stays identifiable as a component (WCAG 1.4.11).

### 2.2 Typography

Families are from Google Fonts (all OFL). In production, self-host latin subsets (see 7.3).

| Role | Family and axes | Weights used | Use |
|---|---|---|---|
| Display | **Fraunces**: `opsz` auto (`font-optical-sizing:auto`), `SOFT` 100, `WONK` 0 | Roman 700 (H1–H3), 800 (prices); Italic 600 (emotional half-lines: "*Fuego.*", "*without being rushed.*") | Headlines, prices, pull quotes |
| Text / UI | **Figtree** (variable `wght` 400–800) | 400 body, 500 small and meta, 700 buttons and strong, 800 kickers and labels | Everything you read or tap |
| Hand | **Caveat Brush** 400 | 400 | Alexander's signature, margin notes and photo annotations **only**. Never for headings, labels, prices or anything you act on |

**Prototype `<link>`** (one request; check that it returns 200):
```
https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,700..800,100;1,9..144,600,100&family=Figtree:wght@400..800&family=Caveat+Brush&display=swap
```

**Type scale.** Mobile is 360–599 px, tablet 600–959 px, desktop ≥ 960 px. Use `font-variant-numeric: lining-nums tabular-nums` on prices, times and counters.

| Token | Family / weight | Mobile | Tablet | Desktop | Line-height | Tracking |
|---|---|---|---|---|---|---|
| `--t-h1` | Fraunces 700 (italic line 600) | `clamp(42px, 12.4vw, 56px)` | 64px | `clamp(80px, 7.2vw, 116px)` | 0.95 (desktop 0.92) | −0.025em |
| `--t-h2` | Fraunces 700 | `clamp(30px, 8.2vw, 38px)` | 44px | `clamp(48px, 3.9vw, 60px)` | 1.04 | −0.015em |
| `--t-h3` | Fraunces 700 | 22px | 24px | 26px | 1.2 | −0.005em |
| `--t-quote` | Fraunces 700 + italic 600 | 30px | 36px | 48px | 1.08 | −0.015em |
| `--t-price-xl` (ticket) | Fraunces 800 | 72px | 88px | 104px | 0.9 | −0.03em |
| `--t-price-m` (hero box) | Fraunces 800 | 48px | 52px | 56px | 0.95 | −0.03em |
| `--t-price-s` (dock, cards) | Fraunces 700 | 20px | 20px | 22px | 1.1 | −0.01em |
| `--t-lede` | Figtree 400 | 18px | 19px | 20px | 1.5 | 0 |
| `--t-body` | Figtree 400 | 17px | 17px | 18px | 1.6 | 0 |
| `--t-small` | Figtree 500 | 15px | 15px | 15px | 1.45 | 0 |
| `--t-meta` | Figtree 500 | 13.5px | 13.5px | 14px | 1.4 | 0.005em |
| `--t-kicker` | Figtree 800, uppercase | 13px | 13px | 13px | 1.2 | 0.12em |
| `--t-label` (form) | Figtree 800, uppercase | 13px | 13px | 13px | 1.2 | 0.08em |
| `--t-input` | Figtree 400 | 17px (≥ 16 avoids iOS zoom) | 17px | 17px | 1.3 | 0 |
| `--t-btn-l` / `--t-btn-m` | Figtree 700 | 17px / 16px | same | same | 1 | 0.005em |
| `--t-hand` | Caveat Brush 400 | 24px | 26px | 30px | 1.1 | 0.01em |
| `--t-signature` | Caveat Brush 400 | 36px | 40px | 44px | 1 | 0 |

Typography rules:
- The minimum visible text size is **13 px**, anywhere.
- Body measure is ≤ 62ch.
- Headings use `text-wrap: balance`; paragraphs use `text-wrap: pretty`.
- Italic in H1/H2 is always the emotional second half of the line.
- No mono font anywhere.

### 2.3 Spacing, layout, radii, shadows, texture

**Spacing scale (4-based):**

| Token | `--s-1` | `--s-2` | `--s-3` | `--s-4` | `--s-5` | `--s-6` | `--s-7` | `--s-8` | `--s-9` | `--s-10` | `--s-11` | `--s-12` | `--s-13` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Value | 4 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 | 80 | 96 | 112 |

**Layout:**
- Max content width is 1240 px.
- 12-column grid at ≥ 960 px (column gap 24 px).
- Outer gutters: 20 px (< 600), 28 px (600–959), 40 px (≥ 960).
- Section padding (block): 64 px mobile, 88 px tablet, 112 px desktop. Compact sections (legend, other tours) use 48/64/80.
- Breakpoints: 360 (minimum supported), 600, 960, 1280.

**Radii:**

| Token | Value | Use |
|---|---|---|
| `--r-xs` | 6px | Tags |
| `--r-md` | 14px | Inputs, radio cards, chips inner |
| `--r-lg` | 18px | Cards, dock, ticket |
| `--r-xl` | 28px | Sheet top corners, door frame, video frame |
| `--r-pill` | 999px | Chips, pill buttons |

**Arch** (hero photo, gear photo):
- Use `border-radius: 50cqi 50cqi 24px 24px / 50cqi 50cqi 24px 24px` with `container-type: inline-size` on the arch wrapper.
- Fallback for mobile: `calc(50vw - 20px)`.
- Do **not** use `999px` corners: browsers would scale down the 24 px bottom corners.

**Shadows** (never animated):

| Token | Value |
|---|---|
| `--sh-paper` | `0 1px 0 rgb(30 29 24 / .05), 0 6px 18px -10px rgb(30 29 24 / .28)` |
| `--sh-lift` | `0 18px 40px -18px rgb(30 29 24 / .38)` (photo "prints", ticket) |
| `--sh-cta` | `inset 0 -3px 0 var(--red-deep), 0 8px 18px -10px rgb(168 35 43 / .6)` |
| `--sh-dock` | `0 10px 30px -8px rgb(15 21 36 / .55)` |

**Texture: canvas weave on `--manta` sections only.**
- Value: `repeating-linear-gradient(0deg, rgb(94 58 64 / .028) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, same)`.
- No SVG noise, no grain overlay, never on photos or night sections.

**Textile system.** Copy B's generator `/tmp/solex_concepts/B-made-local/tools/gen-textile.js`, then run `node tools/gen-textile.js css/textile.css`. The output is data-URI SVG with `shape-rendering: crispEdges`, about 1.7 KB gz in total. All bands are `aria-hidden`, decorative `<div>`s.

| Motif | Source | Where | Height (mobile / desktop) |
|---|---|---|---|
| **Selvedge** stripe | Blanket edge | Top of header, dock, booking sheet, kickers (14 px swatch) | 4px |
| **Fret** band | Rolled blankets in cabin video | Divider hero → legend; frame of cabin video | 24 / 32px |
| **Volcano** band (logo twin peaks + sun as 1-px stairs) | Logo | Top of ticket, top of footer | 32 / 48px |
| **Rombo** chain | Huipil diamond | Top of Overnight block; "tape" on Alexander's notes | 26 / 39px |
| **Zigzag** | — | Dividers on night | 8 / 12px |
| **Stitch figures** (hiker ink, guide red with sun hat) | — | Loom, booking stepper | 14 × 18 / 21 × 27px |
| **Stitch icons** (6 legend icons + sun/moon dial, 16 × 16 maps) | New, same generator | Legend, timeline dial | 32px |

Motif pixel size is 2 CSS px on mobile and 3 CSS px on desktop.

---

## 3. Information architecture, section by section

This is one page with anchors. The order below is the mobile order and the DOM order. Every section is a `<section aria-labelledby>`.

**Position budget** at 390×844, measured in screens from the top. These are acceptance criteria (see Appendix C).

| Item | Must start by |
|---|---|
| Price | 0.85 |
| Pickup cafés + ~8:00 AM | 1.0 |
| Bedding | 1.6 |
| Spanish/English honesty | 3.5 |
| Full ticket | 7.0 |
| Water/cold | 7.5 |
| Total page length | ≤ 18 |

### 3.0 Header and Menu

**Purpose:** identity, persistent access to booking and navigation.

**Mobile header:**
- 64 px tall, `--manta` background, 4 px selvedge on top.
- Left: logo patch (44 px roundel, `logo-96.webp`), then "Solex Tours" (Fraunces 700, 20 px) and "La Soledad · Acatenango" (`--t-kicker`, ink-2).
- Right: a **"Menu"** text button (44 px, Figtree 700 15 px, hamburger glyph and the word) and a 44 px ink round WhatsApp icon button (`aria-label="Book on WhatsApp"`). The icon button opens the booking sheet.
- Behaviour: the header is static at the top. After 600 px of scroll it becomes `position: sticky` in compact mode (56 px, no subtitle). It hides on scroll-down (`translateY(-100%)`, 250 ms) and shows on scroll-up (> 8 px delta).
- Never show both the sticky header and the dock covering more than 15% of the viewport.

**Desktop header (≥ 960):**
- Sticky, 72 px, solid `--manta` with a 1 px `--line` bottom border. No backdrop-filter.
- Nav links: The camp · The overnight · The two days · Getting there · Questions.
- Right: primary button "Book on WhatsApp" (M size).

**Menu (mobile):**
- A full-height `<dialog>` sliding from the top (300 ms).
- Links (each ≥ 48 px):
  1. Why Solex
  2. Alexander & small groups
  3. The camp facing Fuego
  4. The overnight: price & what's included
  5. The two days
  6. Inside a cabin
  7. Other tours
  8. Getting there
  9. Rent gear & porters
  10. What to bring
  11. Straight talk
  12. Questions
- Then the primary CTA, then both WhatsApp numbers.
- Esc and the close button dismiss it; focus returns to "Menu".

### 3.1 Hero (`#top`)

**Purpose:** sell the night, show the price and logistics, and start the booking, all on one screen. It must fit at **360×740** with no scroll: header, arch with H1, lede, price, CTA and pickup line.

**Content (exact copy):**
- Kicker, inside the arch above the H1, sun-coloured on the photo's dark slope: `OVERNIGHT FROM ANTIGUA · 2 DAYS, 1 NIGHT`
- H1: `Sleep facing` / *`Fuego.`* (italic line in `--sun` on the photo; `--red` on desktop manta)
- Lede (≤ 2 lines at 390): `Local guides from La Soledad, 2–8 hikers per guide, and a cabin that faces Fuego.`
- Price box (paper, `--r-lg`, 1 px `--line`): **Q750** (`--t-price-m`, red) on the left. On the right: `per person · ≈ US$100` (Figtree 700, 16 px) and `transport, guide, entry, cabin & 3 meals` (`--t-small`, ink-2).
- Primary CTA (L, full width on mobile): WhatsApp glyph + `Check a date on WhatsApp`. It opens the booking sheet. The no-JS href is in 6.6.
- Pickup line (`--t-small`, map-pin stitch icon): `Pickup ~8:00 AM · Café Condesa or Café La Parada, Antigua`. The time comes from the `PICKUP_OVERNIGHT` config **[CONFIRM pickup]**.
- Trust line (`--t-meta`, ink-2): `You write to Alexander directly. No booking office in between.`
- Desktop only: secondary text link `See what's included ↓` (jumps to `#overnight`).
- Hand annotation on the photo (Caveat Brush, `--sun`, text-shadow `0 1px 2px rgb(0 0 0 / .6)`) with a hand-drawn SVG arrow to the plume: `the view from our cabins`. **[CONFIRM photo-hero]** If unconfirmed, remove the annotation entirely.
- Photo tag, bottom-left inside the arch: `Real photo · Fuego at night` (`--t-meta`, paper on a 70% ink pill).

**Image:** `/tmp/solex_raw/owner/fuego_eruption_night_red_plume.jpg` (1200×1600). Plume at about (42%, 33%), crater (42%, 43%), dark slope from 55% down (this is where the H1 sits).
- **Mobile art direction:** a pre-cropped square from x 0–1200, y 120–1320. Use `object-position: 45% 28%`. Bottom gradient scrim inside the arch: `linear-gradient(to top, rgb(15 21 36 / .92) 0%, rgb(15 21 36 / .6) 38%, transparent 62%)`.
- **Desktop:** full 3:4 portrait, `object-position: 42% 38%`.

**Mobile layout:**
- Arch: full content width (viewport − 40 px), height `clamp(280px, 42svh, 360px)`, containing kicker + H1 at the bottom.
- Then the lede, the price box (64 px), the CTA (56 px), the pickup line and the trust line.
- **No logo patch on the arch below 600 px**, so the logo isn't duplicated.

**Desktop layout:**
- Height `min(100svh − 72px, 900px)`.
- Left (cols 1–6): Alexander's taped note (paper card, rotated −1.5°, rombo "tape"). Its copy: `¡Hola! I'm Alexander.` (Caveat Brush 34 px) and `I'll welcome you at my house at the trailhead, then my guides walk you up.` (Figtree 16 px). Wrap `¡Hola!` in `lang="es"`.
  - Below the note: kicker, H1 (italic line in `--red`), lede, price box, a CTA row (primary + "See what's included"), the pickup line and the trust line.
- Right (cols 8–12): tall arch, 640–780 px high, with the 160 px logo patch (`logo-patch-360.webp`) overlapping its top-right shoulder, rotated 8°.
- **[CONFIRM portrait]** Once a photo of Alexander at his door exists, a 72 px round portrait sits on the note's left edge. Until then, the note has no portrait. Never use a stand-in.

**Motion:**
- The LCP image and H1 render immediately: no entrance animation, no opacity 0.
- Only the hand-drawn arrow draws (`stroke-dashoffset`, 900 ms, `--ease-out`, 400 ms delay).
- No push-in, no parallax.

### 3.2 Proof strip: the legend (`#why`)

**Purpose:** six reasons in five seconds, plus third-party proof.

**Content:** six cells, each with a stitch icon (32 px), a title (Figtree 800, 16 px) and a line (`--t-small`, ink-2):
1. **Fuego straight ahead**: `Our camp is on the right side.`
2. **Sunset from camp**: `No extra hike.`
3. **2–8 per guide**: `Nine of you? Two guides go.`
4. **Your bed is already up there**: `Mattress, sleeping bag, pillow.`
5. **Sunrise summit**: `About 1 hour above camp.`
6. **Local, from La Soledad**: `You start at Alexander's house.`

Under the grid (`--t-meta`): `Real photos from our camp, no stock.` · `Find us on Google Maps` · `Instagram @solextours_acatenango`. These links are ≥ 44 px tall. The Google URL is **[CONFIRM google-url]**; hide that link until it is provided.

**Layout:**
- Mobile: a paper card with a 2-column, 3-row grid, cells separated by `--line` rules, with the fret band directly above.
- Desktop: one row of 6 cells, max width 1240.

**Motion:** the fret band weaves in (see 4.2); the cells settle with a 60 ms stagger.

### 3.3 The story: Alexander and small groups (`#alexander`)

**Purpose:** trust. A named local person, why he went independent, small groups, and the honest truth about English.

**Content blocks, in order:**

1. **Kicker** `A NOTE FROM ALEXANDER`, then a pull quote (`--t-quote`): `"If you pay for a tour, you should enjoy it` *`without being rushed."`*

2. **The letter** (paper card with lined-paper rules in `--cobalt` at 12% opacity, a red margin rule, rombo tape on top):
   > I started out as a guide on Acatenango. They used to send us up with groups of 35, 40, sometimes 60 people, and very few guides. The slow walkers got hurried along. The fast ones got frustrated.
   >
   > So we went out on our own: a local agency at the main entrance to the volcano, with guides from the area and small groups, so people can really enjoy Acatenango.
   >
   > What we tell you is included is what we give you. If you need anything, write to me. I'm here.

   Signature: `Alexander` (`--t-signature`), then `La Soledad, main entrance to Acatenango`. Meta line: `Translated from Alexander's voice notes (Spanish).`

3. **Trailhead print** (desktop and tablet only, rotated +2°, 8 px paper border, `--sh-lift`). Caption: `The start line: the main entrance in La Soledad.`
   - Image: `/tmp/solex_raw/site/assets/images/image01.jpg` (1408×1301), group under the "Bienvenidos / Welcome" sign, `object-position: 50% 58%`, 4:3 crop.

4. **The loom card** (signature 2, see 4.1):
   - Headline numerals: `35–60` (Fraunces 800, ink-2, struck through with a 4 px `--red` line) → `2–8` (Fraunces 800, ink), then `hikers per guide`.
   - H3: `Nine of you? Two guides go.`
   - Then the 60 ghost figures (label `How Alexander used to guide`) and 8 figures plus one red guide on a `--sky` panel (label `How Solex walks: 2–8 people with one local guide, at your group's pace`).
   - Then the stepper `How many of you?` (− n +, default 2), a live line `2 people · 1 local guide` (teal-ink) and a secondary button `Ask for 2 people` that opens the booking sheet with that count.
   - Under the stepper, a soft comparison, 4 rows, 2 columns, no table borders, just `--line` row rules. Use a real `<table>` with a caption.

     | | How Alexander used to guide | How Solex walks |
     |---|---|---|
     | Group | 35–60 people, few guides | 2–8 per guide |
     | Pace | Slow walkers hurried along | Your group's pace |
     | Camp | Left side, Fuego off to one side | Right side, Fuego straight ahead |
     | Sunset | Often a separate walk | From camp, no extra hike |

   - Footnote (`--t-meta`): `Left column: what Alexander saw in his years guiding for big agencies. Not every agency works like this.`

5. **Guides card** (`--manta-2`, `--r-lg`):
   > **Our guides are from the area. They speak mainly Spanish and a little English.** Alexander wants you to know that before you book.
   >
   > What they do have: they know this mountain, they're warm, good-hearted and very entertaining, and they've been told one thing above all: make sure people leave happy.

6. **"Hecho en La Soledad" community stamp** (red circular stamp SVG with the logo peaks, then a short paragraph). **[CONFIRM community]** Shown in the proposal; Alexander approves the wording before public launch.
   - `lang="es"` on "Hecho en La Soledad". `Made in La Soledad. Solex is a small local company: guides from La Soledad and the villages around Acatenango, so the money from your tour stays on the mountain.`
   - Optional sentence, rendered only if confirmed: `Many of our guides worked for years for the big agencies before doing it our own way.` **[CONFIRM guides-history]**
   - The word "family-run" may only appear here, behind `data-confirm="family"`. Never in the hero, legend or meta.

**Mobile layout:** quote → letter → loom card (with comparison) → guides card → stamp. The trailhead print is hidden below 600 px to protect the position budget.

**Desktop layout:** row 1 has the quote and letter (cols 1–6) and the print (cols 8–12). Row 2 has the loom card (cols 1–7) and the guides card plus stamp (cols 8–12).

**Motion:**
- Letter settles in.
- Loom: ghost figures fade in as one block (300 ms); the 8 hikers appear one by one (40 ms stagger), the red guide last.
- The strike-through line draws left to right (`scaleX`, 400 ms) after the numerals settle.
- Stepper changes animate figures in and out (150 ms, opacity + 4 px translate).

### 3.4 The camp facing Fuego (`#camp`)

This section is the core differentiator and holds signature 1. It runs on dark backgrounds that change per state.

**Purpose:** prove "right side, Fuego straight ahead". It covers sunset from camp with no extra hike, plus the volcano chain and Lake Atitlán.

**Blocks:**

**A. Intro** (on `--night`):
- Kicker `WHERE YOU SLEEP MATTERS` in `--sun`.
- H2: `We camp on the right side.` / *`Fuego is straight ahead.`* (italic in `--sun`).
- Body (paper/mist): `Most groups from Antigua camp on the left-hand side, looking toward Antigua and Guatemala City with Fuego off to one side. From there you catch the big eruptions but can miss the small ones, because most of the lava runs down the side we face.`

**B. Sightline toggle** (redrawn in stitch style):
- Inline SVG, 360×300 mobile, 560×420 desktop.
- Elements: Acatenango's twin summits (the logo peaks), Fuego with a pixel plume (`--lava`), "Most camps" and "Our camp" as tiny stitched cabins, and dashed "running stitch" sightline cones.
- Labels: `Antigua & Guatemala City`, `Fuego`, `Volcano chain & Lake Atitlán`, `Sunset`.
- Two toggle buttons (`aria-pressed`, ≥ 48 px): `Most camps · left side` / `Our camp · right side`. Default is "Our camp".
- Caption (`aria-live="polite"`) for Our camp: `From our camp: Fuego head-on, small eruptions and big ones, plus the chain of volcanoes and Lake Atitlán on clear days.` For Most camps: `From the left side: views toward Antigua and Guatemala City, with Fuego off to one side.`
- Footer: `Schematic, not a map. Views need clear skies.`
- First time in view (motion allowed): it starts on "Most camps" and swings to "Our camp" after 1.2 s, once.

**C. The Cabin Door: "One view, three shows."** (signature 1, full spec in 4.1)
- H3 (Fraunces 700 italic, **not** the hand font): `One view, three shows.` *`No extra hike.`*

| State | Background | Image | Crop | Caption |
|---|---|---|---|---|
| **Afternoon** | `--sky` | `/tmp/solex_raw/owner/cabin_fuego_day.jpg` (1200×1600; Fuego peak at 70% 46%, cabin at left) | 4:5, `object-position: 60% 52%` | `"Fuego is right in front of us."` (Caveat Brush) + `When the sky is clear, it's there all afternoon.` |
| **Sunset** | `--gold` → `--dusk` | `/tmp/solex_raw/owner/sunset_man_fuego.jpg` (768×1024; Fuego at left 10% 58%, sun at 85% 55%) | 4:5, `object-position: 45% 66%` | `"We don't need to walk anywhere else."` + `Sunset from camp, as long as it isn't cloudy.` |
| **After dark** | `--night` | `/tmp/solex_raw/owner/fuego_eruption_night_lava_city_lights.jpg` (1536×2048; plume at 51% 27%, crater 52% 42%, lava on the right flank) | 4:5, `object-position: 52% 34%` | `Small eruptions as well as the big ones, on clear nights.` |

- The sunset photo source is only 768 px wide. Never serve it larger than 768w.
- Below the door, a line (`--t-small`): `On clear days you also see the chain of volcanoes and Lake Atitlán.`
- **[CONFIRM photo-door]** All three photos must have been taken at the Solex camp.

**D. "Our honest bit"** card (`--night-2`, 1 px `--mist` at 30%):
- `Our honest bit:` in `--sun`, then: `we can't promise clear skies or eruptions. The clouds and the volcano decide. What we can promise is the seat facing Fuego.`

**Layout:**
- Mobile: A → B → C (sticky track) → D.
- Desktop: A (cols 1–6) + B (cols 7–12) in one row. Then C as a two-column sticky stage: frame in cols 1–6 (max 520×650), state copy in cols 8–12 at `--t-quote` size. Then D centred, max 760 px.

### 3.5 The Overnight in detail (`#overnight`)

This block contains, in order: 3.5a the ticket, 3.5b straight talk (honest notes), 3.5c the two days, and 3.5d inside a cabin.

**Block-level note.** The rombo band opens the block. Background is `--manta-2`.

#### 3.5a The ticket: "Our word" (`#overnight`)

**Purpose:** the offer, fully itemised, with the stamp.

**Content:**
- Ticket card (paper, `--r-lg`, `--sh-lift`, volcano band on top, perforation under the price made with radial-gradient half-circle notches at both edges plus a dashed `--line` rule).
- Badge `OUR MOST POPULAR TOUR` (ink pill, paper text, `--t-kicker` 13 px).
- H2: `The Acatenango Overnight`. Sub (`--t-small`): `2 days · 1 night in a cabin facing Fuego · sunrise on the 3,976 m summit`.
- Price: **Q750** (`--t-price-xl`, red), `per person · ≈ US$100`.
- **Stamp** (SVG, red ink, 120 px mobile, 168 px desktop): circular text `WHAT WE TELL YOU IS WHAT WE GIVE YOU · SOLEX · LA SOLEDAD` around the logo peaks, rotated −12°.
- `WHAT'S INCLUDED` (kicker), 8 rows. Each row has a teal check icon (decorative), a bold title and a detail line:
  1. **Transport from Antigua and back**: `Pickup at Café Condesa (Parque Central) or Café La Parada (Parque La Merced). Same place on the way back.`
  2. **A local guide**: `2–8 people per guide. Nine of you? Two guides go.`
  3. **Acatenango entrance fee**
  4. **A night in a cabin facing Fuego**: `Mattress, sleeping bag and pillow are already up there. Cabins sleep six and are shared.`
  5. **3 meals**: `Lunch and dinner on day 1, breakfast on day 2.` **[CONFIRM meals]**
  6. **Hot chocolate at night, coffee in the morning**
  7. **Sunrise summit hike**: `About 1 hour from camp to the 3,976 m summit.`
  8. **Somewhere safe for your luggage**: `Leave your suitcase at Alexander's house in La Soledad while you hike.`
- `OPTIONAL · PAID ON THE DAY` (kicker, ink-2), with small rows:
  - `Porter for up to 13 kg: Q250 up · Q250 down`
  - `Rent a jacket, backpack, headlamp, poles or shoes · prices on WhatsApp`
  - `[FLAG fuegoAddon]` `Extra hike from camp toward Fuego to get closer, back to the same camp to sleep: about 4 hours (sometimes more), +Q300 per person. Decide and pay at camp, if you feel fit and the weather is right. Nothing to prepay.` (`--t-small`, ink-2: never bold, never a headline)
- Primary CTA (L): `Check a date on WhatsApp`.
- Microcopy: `Pickup around 8:00 AM. Alexander confirms the exact time on WhatsApp. Nothing is charged on this website.`

**Beside the ticket:**
- **"What you bring"** card (`--sky`, `--r-lg`):
  - `4 litres of water per person.` `Our golden rule. Not optional.`
  - `Extra warm clothes.` `Nights at camp are cold.`
  - `A day pack.` `No gear? Rent it from us.`
  - Link `Full packing list ↓` to `#prepare`.

**Layout:**
- Mobile: ticket → straight-talk card (3.5b) → what-you-bring card.
- Desktop: ticket in cols 1–7 (included list in 2 columns). Right column, cols 8–12: straight talk on top, what-you-bring below.

**Motion:**
- Stamp press (4.2) when the ticket is 40% visible.
- The included rows settle with a 40 ms stagger, max 8 rows.

#### 3.5b Straight talk: honest notes (`#honest`)

**Purpose:** say the weak points out loud. This is a mauve card (`--mauve`, paper text).
- H3: `What we won't promise`.
- Hand line (Caveat Brush, `--sun`): `"Some agencies promise everything, then it's different on the day."`
- Rows (bold lead + text):
  - **Clear skies and eruptions.** `Views depend on the clouds and the volcano. We promise the seat, not the show.`
  - **Fluent English.** `Our guides speak mainly Spanish and a little English.`
  - **A private cabin.** `Cabins sleep six and are shared. On a quiet night, two of you may get one to yourselves; Alexander tells you closer to the date.`
  - **An exact pickup time today.** `It's around 8:00 AM; Alexander confirms it on WhatsApp.`
  - `[FLAG fuegoAddon]` **The extra Fuego hike.** `It only happens if you feel fit and the weather is right. You decide at camp.` (Links to FAQ `#faq-fuego`. No price here.)

#### 3.5c The two days, hour by hour (`#two-days`)

This holds signature 4, "The day in light".

**Purpose:** remove logistics uncertainty with an ordered itinerary.

**Time policy.** Only sourced times appear as clock times (~8:00 AM pickup, ~1 h drive, so ~9:00 AM, "about 1 h" to the summit). All other rows use phase words. Times live in `ITINERARY` config, so Alexander's real times can replace the phase words later **[CONFIRM schedule]**. Never invent clock times.

- Kicker `HOW THE TWO DAYS GO`.
- H2: `From a café in Antigua to the summit at sunrise.`

**Rows.** Each row has a time/phase label (Figtree 800, 14 px uppercase), a title (Fraunces 700, 22 px) and a body (`--t-body`).

| Seg. | Phase bg / text | Label | Title | Body |
|---|---|---|---|---|
| Day 1 | `--manta` / ink | `~8:00 AM · ANTIGUA` | Pickup at the café | `Café Condesa (Parque Central) or Café La Parada (Parque La Merced). Bring your suitcase; it rides with us.` |
| | `--manta` | `~9:00 AM · LA SOLEDAD` | Alexander opens his door | `About an hour's drive. Bathroom, instructions, rent gear if you need it, meet your guide. Leave your luggage: "Things don't go missing here."` |
| | `--sky-pale` / ink | `MIDDAY` | The climb | `At your group's pace, with lunch on the way. Nobody gets hurried along.` |
| | `--sky` / ink | `AFTERNOON` | Camp, right side | `Your cabin is ready: mattress, sleeping bag, pillow. Fuego is straight ahead.` |
| | `--gold`→`--dusk` / ink | `SUNSET` | Sunset from camp | `No extra hike, as long as it isn't cloudy.` |
| | `--night` / paper, mist | `NIGHT` | Dinner, hot chocolate, and Fuego | `On clear nights you see the small eruptions as well as the big ones. It gets cold: layers on.` |
| Day 2 | `--bluehour` / paper | `BEFORE DAWN` | About an hour to 3,976 m | `Leave your things at camp and climb by headlamp to the summit of Acatenango.` |
| | `--dawn` / ink | `SUNRISE` | First light from the top | `The volcanoes line up along the horizon on clear mornings.` |
| | `--manta` / ink | `MORNING` | Back to camp | `Coffee, breakfast, pack up.` |
| | `--manta` | `DESCENT` | Down to La Soledad | `Collect your luggage at Alexander's house.` |
| | `--manta` | `RETURN` | Same café in Antigua | `Or ask about heading on toward Panajachel: it can save you about 40 minutes.` |

**Day markers:** `Day 1` and `Day 2` are Fraunces 700 italic 28 px with a red stitched dot on the thread. This replaces B's hand font.

**Phase transitions** (3.7 rule):
- Between segments of different luminance, insert a 96 px gradient spacer that contains only the thread. **No text sits on a gradient.**
- The sunset segment is a gradient from gold to dusk. Ink text passes on both ends (10.4 / 7.8).

**The thread and the sun dial:**
- The left rail is a 3 px dashed "running stitch" (ink at 35%; mist at 50% on dark).
- The travelled part fills solid `--red` (`--sun` on dark). Use CSS scroll-driven `animation-timeline: view()` on a `::before` with `transform: scaleY()` inside `@supports`; otherwise there is no fill.
- A 28 px stitched icon, `position: sticky; top: 50svh` in the rail, swaps sun → low sun → moon → rising sun at segment boundaries (IntersectionObserver, 300 ms crossfade). It uses the logo sun colours.

**Images:**
- **Mobile:** two 2-up photo pairs only, to protect page length. Both pairs are 4:5, 8 px gap, with captions in `--t-meta`.
  - After the Day 1 NIGHT row: `/tmp/solex_raw/owner/sunset_group_three.jpg` (focal 55% 50%, caption `Sunset at camp`) + `/tmp/solex_raw/site/assets/images/gallery01/ec2669a1_original.jpg` (campfire, focal 45% 55%, caption `Evenings at camp`).
  - After the SUNRISE row: `/tmp/solex_raw/site/assets/images/gallery01/435e7f25_original.jpg` (summit group, blue hour; focal 50% 62%; caption `Summit, before sunrise`) + `/tmp/solex_raw/site/assets/images/gallery01/6c07d214_original.jpg` (silhouettes at sunrise; focal 45% 62%; caption `Sunrise, day 2`).
- **Desktop:** rows in cols 1–7. Cols 8–12 hold a **sticky photo panel** (top 96 px, 4:5, `--r-xl`, max 520×650) that crossfades (500 ms) to the photo of the active segment:

| Segment | Photo | Focal |
|---|---|---|
| Morning | `/tmp/solex_raw/site/assets/images/image01.jpg` | 50% 58% |
| Midday | `/tmp/solex_raw/site/assets/images/gallery01/942c4bdf_original.jpg` (hiker + dog on the ash trail) | 45% 62% |
| Afternoon | `/tmp/solex_raw/owner/cabins_path_fuego_day.jpg` | 72% 62% |
| Sunset | `/tmp/solex_raw/owner/sunset_group_three.jpg` | 55% 50% |
| Night | `/tmp/solex_raw/site/assets/images/gallery01/ec2669a1_original.jpg` | 45% 55% |
| Before dawn | `/tmp/solex_raw/site/assets/images/gallery01/435e7f25_original.jpg` | 50% 62% |
| Sunrise | `/tmp/solex_raw/site/assets/images/gallery01/6c07d214_original.jpg` | 45% 62% |
| Morning day 2 | `/tmp/solex_raw/site/assets/images/gallery01/3933a9bd_original.jpg` (morning plume; cabin edge visible) | 38% 38% |

Notes on these images:
- **[CONFIRM photo-camp]**: the campfire and morning-plume photos must have been taken at the Solex camp.
- On desktop the panel image is `loading="lazy"` and loads its next image only when the segment is within 1 viewport.

#### 3.5d Inside a cabin (`#cabin`)

**Purpose:** make "your bed is already up there" tangible.

**Content:**
- Kicker `INSIDE A CABIN`.
- H2: `Your bed is` *`already up there.`*
- Body: `Mattress, sleeping bag and pillow, under the same woven blankets that inspired this page. You carry a day pack, not a tent. Cabins sleep six and are shared.`
- Facts row, 3 chips: `Sleeps 6, shared` · `Bedding already at camp` · `0 tents to carry`.
- **Video:** `/tmp/solex_raw/owner/cabin_interior_beds.mp4` (10 s, 848×474).
  - Shown at native resolution or smaller (**max display width 640 px**; full column width on mobile ≈ 350 px).
  - Wrapped in the fret-band frame (`--r-xl`).
  - Muted, `playsinline`, `loop`, no audio track, `preload="none"`, with a poster.
  - 44 px play/pause button bottom-right (`aria-pressed`, label "Pause cabin video" / "Play cabin video").
  - Caption: `Real footage from one of our cabins. No staging, no filter.`
- Photo trio:
  - `/tmp/solex_raw/site/assets/images/gallery01/0bd7af40_original.jpg`: the cabin door framing Fuego, 3:4, focal 32% 40%, caption `The view from your door`. This is a desktop "print" rotated −2°; on mobile it's the first of the trio.
  - `/tmp/solex_raw/owner/cabins_path_fuego_day.jpg`: 3:4, focal 72% 62%, caption `The cabin row, facing Fuego`.
  - `/tmp/solex_raw/owner/new_green_cabins.jpg`: 4:3, focal 50% 55%, caption `Our newest cabins`.

**Layout:**
- Mobile: header → video → chips → a horizontal scroll-snap row of the three photos (each 78% width, snap start, visible scroll hint "Swipe →" in `--t-meta` the first time).
- Desktop: text and chips in cols 1–5; video in cols 6–12 at max 640 px; the photo trio below as a 3-column row.

**Motion:** the video autoplays only when ≥ 50% visible and motion is allowed, and pauses off-screen. With reduced motion or Save-Data, show the poster plus a play button and never autoplay.

### 3.6 Other tours (`#other-tours`)

**Purpose:** catch time-poor travellers without diluting the hero product.
- Kicker `SHORT ON TIME?`
- H2: `Other ways up Acatenango`.
- Three paper cards. Each has an H3, a red line (`--t-small`, `--red`) with start time and price, a body and an "Includes" line (`--t-meta`), and a **button** (M, secondary outline, ≥ 48 px): `Ask about this tour`. The button opens the sheet with the tour preselected.

| Tour | Red line | Body | Includes |
|---|---|---|---|
| Midnight sunrise | `Leaves Antigua 10:30 PM · Q750 · ≈ US$100` | `Hike through the night to reach the summit for sunrise.` | `Transport, local guide, 1 meal, gloves & hat, entry.` |
| Sunset tour | `Leaves Antigua 10:30 AM · Q750 · ≈ US$100` | `Up in the day to watch the sunset from high on the volcano.` | `Transport, local guide, lunch, gloves & hat, entry.` |
| One-day express | `Leaves Antigua 5:00 AM · Q675 · ≈ US$90` | `For people with little time and a lot of energy.` | `Transport, local guide, lunch, entry.` |

Do not say "certified guide": it's on the current site but unverified.

**Layout:** cards are stacked on mobile; 3 columns on desktop. A moon or sun stitch icon sits top-right of each card.

### 3.7 Getting there (`#getting-there`)

**Purpose:** logistics trust: meeting points, drive, luggage, onward travel.
- Kicker `GETTING THERE`.
- H2: `Two meeting points in Antigua. One house at the trailhead.`
- **Two pin cards** (paper; red stitched pin with A / B):
  - `Café Condesa`, `Parque Central, Antigua`, link `Open in Maps`: `https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Condesa%20Parque%20Central%20Antigua%20Guatemala`
  - `Café La Parada`, `Parque La Merced, Antigua`, link `Open in Maps`: `https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20La%20Parada%20Parque%20La%20Merced%20Antigua%20Guatemala`
  - Links are ≥ 44 px tall. Do not invent street addresses.
- **Route strip** (C's A→D, stitched dashed line, vertical on mobile, horizontal on desktop):
  1. `~8:00 AM` **Pickup in Antigua**: `at your café.`
  2. `~1 hour` **Drive to La Soledad**: `the main entrance to Acatenango.`
  3. **Alexander's house**: `bathroom, instructions, gear, meet your guide. Leave your suitcase: "Things don't go missing here."`
  4. **Next day**: `collect your luggage, back to the same café, or head on toward Panajachel.`
- Panajachel note (sky-pale card): `Going to Lake Atitlán next? On the way back you don't have to go all the way into Antigua: it can save you about 40 minutes. Ask Alexander how it works for your plans.` Who provides onward transport is not stated **[CONFIRM panajachel]**.

### 3.8 Rent gear and porters (`#gear`)

**Purpose:** remove "I don't have gear" and offer porters. The section is on `--sky`.
- Kicker `TRAVEL LIGHT`.
- H2: `Don't buy gear you'll use once.`
- Chips (static): `Jackets` · `Backpacks` · `Headlamps` · `Hiking poles` · `Shoes`.
- Porter line: **Porter** `carries up to 13 kg for you: Q250 up, Q250 down.`
- Note: `Ask for rental prices when you book; we'll have it ready at the trailhead.` Rental prices are unknown **[CONFIRM rental-prices]**.
- Button (secondary): `Add gear to my note`. It opens the sheet with the "Rent gear" chips visible.
- Image: `/tmp/solex_raw/site/assets/images/image05.jpg` (673×884, backpack facing Agua), arch crop, `object-position: 50% 62%`. Display width is capped at 440 px (low-res source).
- Layout: mobile has text, then the arch at 100% up to 440 px. Desktop has text in cols 1–6 and the arch in cols 8–11.

### 3.9 What to bring, weather and fitness (`#prepare`)

**Purpose:** set expectations honestly.
- Kicker `BEFORE YOU GO`.
- H2: `What to bring, and how hard it is.`
- Three cards:
  1. **Pack** (paper):
     - `4 litres of water per person: the volcano's golden rule.`
     - `Extra warm clothes: hat, gloves, a warm layer. Nights at camp are cold.`
     - `A day pack for your things.`
     - `Headlamp and good shoes (or rent them).`
     - `Your suitcase can stay at Alexander's house.`
  2. **Weather** (sky-pale): `Views need clear skies, and clouds come and go. Sunset, eruptions and the summit view all depend on the weather on the day. We can promise the seat facing Fuego, not the show.`
  3. **Fitness** (manta-2): `It's a steep climb at altitude, up to the 3,976 m summit. You walk at your group's pace with 2–8 people per guide, so nobody gets rushed. Not sure? Ask Alexander on WhatsApp before you book.` Hike durations are not stated, so don't invent them **[CONFIRM difficulty]**.
- Layout: cards are stacked on mobile; 3 columns on desktop.

### 3.10 Reviews (`#reviews`): hidden until real

- Only render when `REVIEWS.length ≥ 1`. Each card is a real quote with first name, country, month/year and a source link (Google/Instagram).
- **Never ship visible placeholder cards or the word "PLACEHOLDER".** Placeholders live in an HTML comment or `<template>` only.
- When hidden, the third-party links in the legend (3.2) carry social proof.

### 3.11 Honest answers: FAQ (`#faq`)

**Purpose:** objection handling. Use native `<details>/<summary>`, one H2, each summary ≥ 56 px. Every item has an id, so `#faq-pickup` opens and scrolls to that item.

| # | id | Question | Answer (exact) |
|---|---|---|---|
| 1 | `faq-pickup` | What time is pickup, and where? | `Around 8:00 AM at Café Condesa (Parque Central) or Café La Parada (Parque La Merced) in Antigua. Alexander confirms the exact time on WhatsApp.` **[CONFIRM pickup]** |
| 2 | `faq-book` | How do I book? | `Tap "Check a date on WhatsApp", fill in what you know, and send the message. Alexander replies personally and confirms your spot. Nothing is booked or charged on this website.` |
| 3 | `faq-pay` | How do I pay? | **[CONFIRM payment]** Until confirmed: `Alexander confirms how to pay when he confirms your spot on WhatsApp. Nothing is charged on this website.` Replace this with the real method (cash at pickup or at the trailhead, deposit, transfer). |
| 4 | `faq-tomorrow` | Can I book for tomorrow? | **[CONFIRM cutoff]** Hidden until Alexander gives his cut-off. Do not render it. |
| 5 | `faq-english` | Do the guides speak English? | `Mainly Spanish and a little English. They're from the area, warm and very entertaining, and their job is to make sure you leave happy.` |
| 6 | `faq-eruptions` | Will we see Fuego erupt? | `From our camp Fuego is straight ahead, so on clear nights you can see small eruptions as well as big ones. But the clouds and the volcano decide; nobody can promise a show.` |
| 7 | `faq-cabin` | Will we get a private cabin? | `Cabins sleep six and are shared. If it's a quiet night, two of you may get one to yourselves. Alexander tells you closer to the date.` |
| 8 | `faq-cloudy` | What if it's cloudy? | `You still sleep in a cabin facing Fuego and climb to the summit, but views depend on the weather.` A cancellation/weather policy will be added **[CONFIRM cancellation]**. |
| 9 | `faq-luggage` | Can I leave my suitcase? | `Yes. Bring it on the shuttle and leave it at Alexander's house at the main entrance while you hike. "Things don't go missing here."` |
| 10 | `faq-hard` | How hard is the hike? | Same as the fitness card (3.9). |
| 11 | `faq-bring` | What should I bring? | `4 litres of water per person and extra warm clothes. Everything else you can rent from us.` Link to `#prepare`. |
| 12 | `faq-atitlan` | Can I go straight on to Lake Atitlán? | `Yes, ask about heading on toward Panajachel on the way back; it can save you about 40 minutes compared with going into Antigua.` |
| 13 | `faq-fuego` | Can we get closer to Fuego? | `[FLAG fuegoAddon]` `Yes, if you want to. From camp there's an optional extra hike toward Fuego, then back to the same camp to sleep. It adds about 4 hours, sometimes more, and costs Q300 per person. You decide at camp, if you feel fit and the weather is right, and pay there. Nothing is charged in advance, so you lose nothing if you don't go.` |
| 14 | `faq-write` | Can I write in English? | `Yes, write in English or Spanish. The message our form writes adds a short Spanish summary for Alexander.` |

**Layout:** single column on mobile. On desktop, a sticky heading column (cols 1–4) plus the list (cols 5–12).

### 3.12 Booking: "Write a note to Alexander." (`#book`)

Full spec in section 6.

- Kicker `BOOK`.
- H2: `Write a note to Alexander.`
- Intro: `Fill in what you know. We turn it into a WhatsApp message you can edit before sending. Nothing is booked until Alexander confirms.`
- The slip form lives here inline. It is the same DOM node that moves into the sheet.
- Under it: `Just a question? Chat without the form` and `Second number: +502 4946 8883`.
- **Mobile:** single column; the dock hides while this section is in view.
- **Desktop:** heading and reassurance in cols 1–4 (sticky), the form card in cols 5–12 with fields (cols 5–9) and the live preview (cols 10–12, sticky).

### 3.13 Footer

- Volcano band on top, then an `--ink` background.
- Logo patch (96 px), `Solex Tours · Expedición Volcán Acatenango` (Fraunces 700, paper), `La Soledad, main entrance to Acatenango volcano, Guatemala.`
- Hand line (Caveat Brush, `--sun`): `Gracias for supporting community guides.` (from the current site).
- Links (each ≥ 44 px tall, paper, underlined):
  - `WhatsApp +502 4834 7003` → `https://wa.me/50248347003?text=Hi%20Alexander%21`
  - `WhatsApp +502 4946 8883` → `https://wa.me/50249468883?text=Hi%20Alexander%21`
  - `Instagram @solextours_acatenango` → `https://www.instagram.com/solextours_acatenango/`
  - `Facebook · Solex Tours` and `Google · Solex Tours`: URLs **[CONFIRM social-urls]**; hide until given.
- Meta: `Photos and video: Solex Tours and guests.` · `© 2026 Solex Tours.`
- Body gets `padding-bottom: calc(96px + env(safe-area-inset-bottom))` on mobile while the dock exists, so the footer is never covered.

### 3.14 Sticky dock (mobile < 960 only)

- A floating `--ink` card, 10 px from the left, right and bottom edges (`bottom: calc(10px + env(safe-area-inset-bottom))`), 68 px tall, `--r-lg`, `--sh-dock`, 4 px selvedge on top.
- **Default state:**
  - Left: `Overnight · Q750` (Fraunces 700, 20 px, paper) and `per person · ≈ US$100` (`--t-meta`, mist).
  - Right: red button (M, 52 px tall, stitched paper inset outline) with glyph + `Check a date`. It opens the sheet.
- **Live state** (after any builder field changes, C's graft):
  - Left: `Sun 8 Nov · 3 people` (Figtree 700, 15 px, paper) and `Q2,250 ≈ US$300` (Fraunces 700, 18 px, sun). With no date it shows `Date flexible · 3 people`.
  - Right: `Send` + arrow, a real `<a href="https://wa.me/…">` with the current message.
  - Tapping the left half reopens the sheet.
- **Visibility:**
  - Appears when the hero CTA leaves the viewport (IntersectionObserver).
  - Hides when `#book` or the footer intersects, while the sheet or menu is open, and while the on-screen keyboard is open (`visualViewport.height < innerHeight − 150`).
  - When hidden it uses `visibility: hidden` and `inert`.
  - Slides 450 ms, `--ease-out`; instant with reduced motion.

### 3.15 Booking sheet (`<dialog id="note">`)

- Mobile: a bottom sheet, max height 92svh, `--r-xl` top corners, selvedge on top, decorative grab handle.
- Header: title `Note to Alexander` (Fraunces 700, 22 px; **not** the hand font) and a 44 px close button.
- The form scrolls inside. The **Send bar is sticky** at the bottom: full-width red L button `Send on WhatsApp · Q1,500`, with `Nothing is charged here.` (`--t-meta`) under it.
- Desktop: a centred dialog, 960 px wide, max 88vh, with two columns (fields | sticky preview).
- Native `showModal()`. Esc, backdrop click and × close it. Focus moves to the first unset field (or the heading) and returns to the opener on close.

---

## 4. Signature interactions, motion and performance budget

### 4.1 Signature interactions

**1. The Cabin Door: "One view, three shows."** (camp section, 3.4C)
- **Markup:** `section.door > .door__track > .door__stage`. The stage holds a `.door__chips` group of 3 buttons, plus a `.door__frame` (CSS curtain-wall frame: a 14 px border built from `repeating-linear-gradient(180deg, var(--red) 0 18px, var(--stripe) 18px 30px)` on the left and right posts, a red lintel and an `--ink-2` sill) holding three stacked `<figure data-i="1|2|3">`, each with a `<picture>` and a `<figcaption>`.
- **Mobile behaviour:**
  - `.door__track` height is `calc(100svh + 2 * 60svh)`.
  - `.door__stage` is `position: sticky; top: 12px` (or `top: 68px` while the compact header is shown), height `min(86svh, 720px)`.
  - Three zero-height sentinels at 0%, 33% and 66% of the track are observed with `rootMargin: "-50% 0px -50% 0px"`. The active sentinel sets `data-state` on the section.
  - CSS crossfades the figures (opacity, 700 ms, `--ease-in-out`) and transitions the section background through `--sky` → `--gold` → `--night` (700 ms). Text colour switches with the background.
  - Chips show the state (`aria-current="true"` on the active one). Tapping a chip scrolls to its sentinel (`scrollIntoView({block:"center"})`, smooth only with motion allowed).
- **Desktop:** same mechanics. The frame sits in cols 1–6; the active caption is set large in cols 8–12 (`--t-quote` with the Caveat Brush quote above it).
- **Enhancement:** where `@supports (animation-timeline: view())`, the figure crossfade can be driven by CSS scroll-driven animations. The IntersectionObserver version is the baseline.
- **Reduced motion or no JS:** the track height is `auto`, the stage is not sticky, and all three figures render stacked as normal 4:5 captioned figures (16 px gap). Chips are hidden.
- **Accessibility:** inactive figures are visually transparent but stay in the accessibility tree, in DOM order. The chips are a `role="group"` labelled "Time of day". Do not trap scroll; no scroll-jacking. Native scroll only.

**2. The Loom** (3.3)
- An SVG or CSS grid of stitch figures: 60 ghosts (ink at 18% opacity, 15 × 4) against 8 hikers plus 1 red guide.
- The stepper shares **one global state** (`state.people`) with the builder and the dock. `Ask for N people` opens the sheet with N set.
- At 9+ a second red guide stitches in and the line reads `9 people · 2 local guides go (max 8 hikers per guide)`.
- At > 24 the figures cap and show `×N`, with the line `Big group of friends? Tell Alexander in your note.`

**3. Note to Alexander → WhatsApp** (section 6)
- Live WhatsApp-style bubble preview, a total on the Send button, the stamped slip and a self-rewriting dock.
- After Send: the button reads `WhatsApp opened ✓` for 6 s, and a line appears: `Didn't open? Copy the message` (copy-to-clipboard button + `role="status"` toast "Message copied").

**4. The day in light** (3.5c)
- Phase-coloured timeline segments, the stitched thread that fills as you read, and the logo sun that travels down the thread and turns into the moon at night.

**Supporting moments:**
- Sightline swing (3.4B).
- Stamp press on the ticket (3.5a).
- Weave-in bands.
- Hand-drawn arrow on the hero.

### 4.2 Motion spec

**Tokens:**

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` |
| `--d-fast` | 160ms |
| `--d-base` | 300ms |
| `--d-slow` | 600ms |
| `--d-scene` | 700ms |

| Motion | Trigger | Properties | Duration / easing | Stagger / delay | Reduced motion |
|---|---|---|---|---|---|
| Weave-in (bands) | 20% in view, once | `clip-path: inset(0 100% 0 0)` → `inset(0)` | 600 ms `steps(18, end)` | — | Shown complete |
| Settle (cards, photos, text blocks) | 15% in view, once | `opacity 0→1`, `translateY(16px→0)` | 600 ms `--ease-out` | 60 ms sibling stagger, max 6 | Visible, static |
| Hero arrow draw | load + 400 ms | `stroke-dashoffset` | 900 ms `--ease-out` | — | Drawn |
| Stamp press | ticket 40% in view | `scale(1.8)→1`, `rotate(−30°)→(−12°)`, opacity | 550 ms `--ease-spring` | 300 ms delay | Placed |
| Strike-through | numerals in view | `scaleX(0→1)`, origin left | 400 ms `--ease-out` | 200 ms after settle | Drawn |
| Loom fill | loom 30% in view | figure opacity | 150 ms each | 40 ms stagger, guide last | All shown |
| Stepper change | click | figure opacity + 4 px translateY | 150 ms `--ease-out` | — | Instant |
| Sightline swing | first view / toggle | cone `rotate` (transform-origin at camp) | 600 ms `--ease-in-out` | auto-swing after 1.2 s, once | Static on "Our camp" |
| Plume flicker (SVG) | while in view | pixel opacity | 1.2 s loop, `steps(3)` | paused off-screen | Single frame |
| Door crossfade + background | sentinel change | figure opacity; section `background-color` | 700 ms `--ease-in-out` | — | Stacked, no transition |
| Timeline sun dial | segment change | icon opacity crossfade | 300 ms | — | Instant swap |
| Thread fill | scroll (CSS scroll-driven only) | `transform: scaleY` | linear to scroll | — | No fill |
| Desktop photo panel | segment change | opacity | 500 ms `--ease-in-out` | — | Instant swap |
| Dock in/out | IntersectionObserver | `translateY(120%)→0`, opacity | 450 ms `--ease-out` | — | Instant |
| Sticky header hide/show | scroll direction | `translateY(−100%)→0` | 250 ms `--ease-out` | — | Instant |
| Sheet open/close | click | `translateY(40px)→0`, opacity; backdrop opacity | 380 ms / 200 ms `--ease-out` | — | Instant |
| Menu open | click | `translateY(−16px)→0`, opacity | 300 ms | — | Instant |
| Button press | `:active` | `translateY(2px)`, shadow inset reduces | 160 ms | — | Same (not motion) |
| Chip / radio select | change | background, border-color | 160 ms | — | Instant |
| Video | ≥ 50% in view | play/pause | — | — | Never autoplays |
| Smooth scroll | anchor | `scroll-behavior: smooth` | — | — | `auto` |

Motion rules:
- **Opt-in motion.** All reveal-initial styles (opacity 0 or translate) live inside `@media (prefers-reduced-motion: no-preference)` **and** behind `html.js` (JS adds the class).
- A **2.5 s safety net** adds `.is-visible` to every pending reveal.
- `?static=1` forces the reduced-motion mode (for screenshots and QA).
- **Animate only `opacity`, `transform` and `clip-path`.** Background-colour transitions are allowed only on the door section and the timeline (2 elements).
- **Banned:** `filter: blur()`, `backdrop-filter`, `mix-blend-mode` animation, scroll listeners that write layout, parallax, and infinite loops when off-screen.
- One passive rAF-throttled `scroll` listener is allowed, for header direction only.

### 4.3 Performance budget

Measured on Lighthouse mobile (Moto G Power class, Slow 4G, 4× CPU) and on a real mid-range Android over 4G.

| Metric / asset | Budget |
|---|---|
| LCP (hero image) | ≤ 2.5 s (target 1.8 s) |
| CLS | ≤ 0.05 (every img and video has `width`/`height` or `aspect-ratio`) |
| INP | ≤ 200 ms |
| TBT | ≤ 150 ms |
| Transfer until LCP | ≤ 200 KB |
| HTML (gz) | ≤ 20 KB |
| Critical CSS inlined (gz) | ≤ 12 KB; total CSS ≤ 22 KB gz |
| JS total (min + gz) | ≤ 14 KB, one deferred ES module, no third-party scripts, no frameworks |
| Fonts | ≤ 100 KB total; ≤ 64 KB preloaded (Fraunces roman + Figtree) |
| Hero image (mobile) | ≤ 80 KB AVIF at 1080w (≤ 110 KB WebP fallback) |
| Below-fold images | lazy, each ≤ 70 KB AVIF at the served size |
| Video | ≤ 400 KB MP4 (H.264), loaded only when within 1 viewport; not at all with Save-Data |
| Full scroll, excluding video | ≤ 900 KB |
| Lighthouse scores (mobile) | Performance ≥ 90, Accessibility 100, Best Practices ≥ 95, SEO ≥ 95 |

---

## 5. Components and states

Every interactive element has a **≥ 44 × 44 px** hit area and a visible `:focus-visible` ring.

**Focus ring** (global token `--focus`):
- On light: `box-shadow: 0 0 0 2px var(--ink), 0 0 0 5px var(--sun)`.
- On dark: `0 0 0 2px var(--night), 0 0 0 5px var(--sun)`.
- `outline: 2px solid transparent` for forced-colors mode.

| Component | Anatomy | States |
|---|---|---|
| **Button: primary** (L 56 px / M 48 px, radius 14 px) | Red background, white label (Figtree 700), WhatsApp glyph 22 px left, 1.5 px dashed paper inset "stitch" outline (inset 5 px, radius 10 px), `--sh-cta` | default · hover (bg `--red-deep`) · focus-visible (ring) · active (`translateY(2px)`, shadow edge 1 px) · "sent" (label `WhatsApp opened ✓`, 6 s) · never disabled |
| **Button: secondary** | Transparent, 2 px `--ink` border, ink label (on dark: paper border and label) | default · hover (bg `--manta-2` / `--night-2`) · focus · active |
| **Text link** | Underline 2 px, offset 4 px, `currentColor` | default · hover (thickness 3 px) · focus (ring) · visited (same) |
| **Icon button** (menu, close, play/pause, header WhatsApp) | 44 px circle; ink background with paper icon, or transparent | default · hover · focus · pressed (`aria-pressed` for play/pause) |
| **Chip: static** | Pill, paper background, 1 px `--line`, Figtree 600, 15 px | — |
| **Chip: toggle** (extras, rentals) | `<label>` + visually hidden checkbox; pill 44 px | unchecked (paper, `--control` border) · hover · focus (ring on pill) · checked (ink bg, paper text, ✓ glyph) |
| **Radio card** (tour, pickup, after-tour) | `<label>` + hidden radio; `--r-md`, 1 px `--control`; title (Figtree 700, 16 px) + sub (`--t-small` ink-2) | unchecked · hover (border ink) · focus (ring) · checked (2 px `--red` border, `--selected` fill, red radio dot) |
| **Stepper** | − / value / +; buttons 48 × 48, 2 px ink border, radius 12 px; value in Fraunces 700, 32 px; `<output aria-live="polite">` | default · hover · focus · at min/max (`aria-disabled="true"`, 40% opacity, still focusable, announces "Minimum 1 person") |
| **Text input / date input** | Label above (`--t-label`), 52 px field, paper, 1.5 px `--control`, radius 14 px, `--t-input` | default · hover (border ink-2) · focus (ring + border ink) · filled · error (2 px `--red-text` border, error text below with an icon, `aria-invalid="true"`, `aria-describedby`) |
| **Checkbox** ("My dates are flexible") | 24 px box inside a 44 px label row | unchecked · focus · checked (ink fill, paper ✓) |
| **Card** | Paper, `--r-lg`, 1 px `--line`, `--sh-paper`, padding 20 px mobile / 28 px desktop | static |
| **Photo print** | 8 px paper border, `--sh-lift`, rotation ±2° (desktop only) | static |
| **Ticket** | Paper, volcano band, perforation notches, stamp slot | static + stamp animation |
| **Stamp** | Inline SVG, `--red`, `aria-hidden` (its text is repeated in visible copy elsewhere) | idle · pressed (animated once) |
| **Legend cell** | Stitch icon 32 px + title + line | static |
| **Timeline row** | Rail (thread + node) · label · title · body | upcoming · active (node filled `--red` / `--sun`; for the sun dial only) |
| **Door frame** | Posts, lintel, sill, 3 figures, chips | state 1 / 2 / 3 · static (reduced motion) |
| **Sightline** | SVG + 2 toggle buttons + live caption | "most camps" · "our camp" (default) |
| **Loom** | Ghost grid + group grid + stepper + "Ask for N" | n = 1…60 (guides = ceil(n / 8)) |
| **Accordion** (FAQ) | `<details>`; summary row ≥ 56 px, Figtree 700, 17 px; red `+` rotates to `−` | closed · hover · focus · open · target (`:target` opens and highlights for 1.2 s) |
| **Sticky dock** | See 3.14 | hidden · default · live (summary) · hidden-for-keyboard |
| **Booking sheet / dialog** | See 3.15 | closed · opening · open · sending (button "sent") · closed (focus returned) |
| **Header** | See 3.0 | static · compact-sticky shown · compact-sticky hidden · menu open |
| **Menu** | `<dialog>`, link list, CTA, numbers | closed · open |
| **Video player** | Poster, play/pause, caption | poster · playing · paused · Save-Data (poster + "Play video (≈ 0.4 MB)") |
| **Pin card** | Pin, name, park, "Open in Maps" | static; link states |
| **Toast** | `role="status"`, ink pill, paper text, bottom 96 px above the dock | hidden · shown 2.5 s |
| **Message preview** | `--bubble-bg` well, `--bubble` bubble (radius 14 px, tail), Figtree 15 px / 1.45, `white-space: pre-wrap`, double tick in teal | live-updating (`aria-live="off"`; the preview is a visual duplicate, the form is the source) |

---

## 6. Booking builder: "Note to Alexander"

### 6.1 Principles

- One form DOM node (`form#slip`). It lives inline in `#book` and is moved into `dialog#note` when opened from any other CTA, then moved back on close (B's pattern).
- Single source of truth is a `state` object, mirrored to `sessionStorage` (never `localStorage`; no personal data persists beyond the tab).
- **Send is never disabled.** The only blocking error is an invalid or past date. On Send with an error, focus the field and announce the message.
- All entry points open the builder:
  - header WhatsApp button
  - hero CTA
  - dock
  - ticket CTA
  - "Ask for N people"
  - "Ask about this tour" (preselects the tour)
  - "Add gear to my note"

### 6.2 Fields (in this order)

| # | Field | Control | Default | Validation / behaviour |
|---|---|---|---|---|
| 1 | Tour | 4 radio cards, 2 × 2 grid on mobile: `Overnight` `2 days, 1 night · Q750` / `Midnight sunrise` `Leaves 10:30 PM · Q750` / `Sunset tour` `Leaves 10:30 AM · Q750` / `One-day express` `Leaves 5:00 AM · Q675` | Overnight (or the preselected tour) | Always valid |
| 2 | Date | `<input type="date">`, `min` = today in `America/Guatemala`, `max` = today + 18 months; plus checkbox `My dates are flexible` | Empty | Past or invalid → error `Please pick today or a later date.` (blocks Send). Today → info note (sky-pale, not an error): `Today? Message Alexander right away; he'll tell you if there's still space.` Empty → message says `not fixed yet` |
| 3 | How many of you? | Stepper 1–60 + stitch figures + helper `N people · 1 local guide` / `9 people · 2 local guides go` | 2 (or the loom value) | Integer clamp 1–60; > 24 shows `Big group of friends? Tell Alexander in your note.` |
| 4 | Pickup in Antigua | 2 radio cards: `Café Condesa` `Parque Central` / `Café La Parada` `Parque La Merced` | None | Optional; unset → `not sure yet` |
| 5 | After the tour *(Overnight only; hidden otherwise)* | 2 radio cards: `Back to Antigua` `same café` / `On toward Panajachel` `can save ~40 min` | Back to Antigua | — |
| 6 | Extras (optional) | Toggle chips: `Porter up · Q250`, `Porter down · Q250`, `Rent a jacket`, `Rent a backpack`, `Rent a headlamp`, `Rent poles`, `Rent shoes`. Helper: `Paid on the day. Rental prices on WhatsApp.` | None | — |
| 7 | Your name (optional) | `<input type="text" autocomplete="given-name" maxlength="40">` | Empty | Trimmed; line breaks stripped; omitted if empty |

**Live total**, shown under the stepper, in the preview, on the Send button and in the dock:
- `total = tour.priceQ × people`, formatted `Q1,500` (en-US grouping).
- `≈ US$` uses the **posted per-person USD price** (100 / 100 / 100 / 90) × people. Never a live FX rate.
- Porter and rental costs are **not** added. Note under the total: `Tour total · extras paid on the day`.

**The Fuego add-on is not in the builder or the message.** It is decided at camp.

### 6.3 Exact WhatsApp message template

Lines in `[brackets]` are only included when that field has a value. `{…}` are substitutions. Use `\n` line breaks.

```
Hi Alexander! I found Solex Tours on your website and I'd like to book.

Tour: {tourNameEN}
Date: {dateEN | "not fixed yet"}[ (my dates are flexible)]
People: {n}
Pickup: {pickupEN | "not sure yet (Café Condesa or Café La Parada)"}
[After the tour: heading on toward Panajachel]
[Extras: {extrasEN, comma-separated}]
[Name: {name}]

Website price: Q{priceQ} per person = Q{totalQ} total (≈ US${totalUSD}).
Is there space? Could you confirm the pickup time? Thank you!

(ES) Hola Alexander: {tourES} · {dateES | "fecha por confirmar"}[ (fechas flexibles)] · {n} personas · {pickupES | "recogida por confirmar"} · Total Q{totalQ}[ · después: Panajachel][ · extras: {extrasES}]
```

**Substitution tables:**

| Key | tourNameEN | tourES | priceQ / USD |
|---|---|---|---|
| overnight | `Acatenango Overnight (2 days / 1 night)` | `Tour 2D/1N (acampar)` | 750 / 100 |
| midnight | `Midnight sunrise tour (leaves 10:30 PM)` | `Tour de media noche` | 750 / 100 |
| sunset | `Sunset tour (leaves 10:30 AM)` | `Tour de atardecer` | 750 / 100 |
| express | `One-day express (leaves 5:00 AM)` | `Tour de un día` | 675 / 90 |

| Field | EN | ES |
|---|---|---|
| Pickup Condesa | `Café Condesa, Parque Central (Antigua)` | `Café Condesa` |
| Pickup La Parada | `Café La Parada, Parque La Merced (Antigua)` | `Café La Parada` |
| Porter up / down | `porter up (13 kg)` / `porter down (13 kg)` | `porteador subida` / `porteador bajada` |
| Rentals | `rent: jacket, backpack, headlamp, poles, shoes` (only the selected items) | `alquiler: chaqueta, mochila, linterna, bastones, zapatos` |

**Date formats.** Parse the `yyyy-mm-dd` string and format in UTC to avoid timezone shift.
- `dateEN`: `Intl.DateTimeFormat('en-GB', {weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'UTC'})` gives `Sun 8 Nov 2026`.
- `dateES`: `es` locale, weekday short + `dd/mm/yyyy`, gives `dom 08/11/2026`.

**Rendered example** (3 people, 8 Nov 2026, Condesa, Panajachel, porter up, headlamp, name Maria):

```
Hi Alexander! I found Solex Tours on your website and I'd like to book.

Tour: Acatenango Overnight (2 days / 1 night)
Date: Sun 8 Nov 2026
People: 3
Pickup: Café Condesa, Parque Central (Antigua)
After the tour: heading on toward Panajachel
Extras: porter up (13 kg), rent: headlamp
Name: Maria

Website price: Q750 per person = Q2,250 total (≈ US$300).
Is there space? Could you confirm the pickup time? Thank you!

(ES) Hola Alexander: Tour 2D/1N (acampar) · dom 08/11/2026 · 3 personas · Café Condesa · Total Q2,250 · después: Panajachel · extras: porteador subida, alquiler: linterna
```

Keep the encoded URL under 2,000 characters. The template is about 700 characters at most.

### 6.4 Numbers and links

- **Primary (Send):** `https://wa.me/50248347003?text={encodeURIComponent(message)}`, a real `<a target="_blank" rel="noopener">`. It is updated on every state change, so no popup blockers apply.
- **Secondary:** `Second number: +502 4946 8883` → `https://wa.me/50249468883?text={same}`.
- **Chat without the form:** `https://wa.me/50248347003?text=Hi%20Alexander%21%20I%20have%20a%20question%20about%20Acatenango.`

### 6.5 Fallbacks

1. **No JS:** every CTA is a plain `wa.me` link with prefilled text (6.6). The `#book` section shows a short `<noscript>` note with both numbers.
2. **WhatsApp didn't open, or desktop without the app:** `wa.me` redirects to WhatsApp Web. After Send, show `Didn't open? Copy the message` (Clipboard API; fallback: select the preview text) and `Or call / text +502 4834 7003` (`tel:` link).
3. **Clipboard denied:** the preview text becomes selectable and the toast reads `Press and hold to copy`.

### 6.6 No-JS / prefilled `href`s

| Entry | Text |
|---|---|
| Hero, header, dock, ticket | `Hi Alexander! I'd like to check a date for the Acatenango Overnight (2 days / 1 night, Q750 per person).\nDate: \nPeople: \nPickup: Café Condesa or Café La Parada` |
| Midnight / Sunset / Express cards | Same pattern with the tour name and price: `…for the Midnight sunrise tour (leaves 10:30 PM, Q750 per person)…` |

Exact encoded hero href:
```
https://wa.me/50248347003?text=Hi%20Alexander%21%20I%27d%20like%20to%20check%20a%20date%20for%20the%20Acatenango%20Overnight%20%282%20days%20%2F%201%20night%2C%20Q750%20per%20person%29.%0ADate%3A%20%0APeople%3A%20%0APickup%3A%20Caf%C3%A9%20Condesa%20or%20Caf%C3%A9%20La%20Parada
```

---

## 7. Accessibility and performance requirements

### 7.1 Accessibility (WCAG 2.2 AA; target Lighthouse 100)

- `<html lang="en">`. Spanish phrases get `lang="es"`: `¡Hola!`, `Hecho en La Soledad`, the (ES) preview line, `Gracias`.
- Skip link ("Skip to booking", plus "Skip to content"), landmarks (`header`, `main`, `footer`, `nav`), one H1, ordered headings, `aria-labelledby` on sections.
- Contrast: only the pairs in 2.1. Hand-font notes on photos sit only over dark areas (≥ 3:1 for large text, with a text-shadow). Their information is always repeated in real text.
- **Targets** ≥ 44 × 44 px everywhere, including footer links and "Ask about this tour" (B's 20 px links are fixed). Minimum text 13 px. Inputs ≥ 16 px.
- **Focus:** the double ring (5); the focus order follows the DOM; the dialog and menu trap focus natively and return it; the dock and hidden UI are `inert`.
- **Forms:** `fieldset` + `legend` per group; real inputs under styled labels; errors via `aria-invalid` + `aria-describedby` + `role="alert"` on the first error on Send; stepper buttons labelled "Remove one person" / "Add one person"; totals in `<output aria-live="polite">`.
- **Sightline:** `role="img"` with `<title>`/`<desc>`, a live text caption and toggle buttons with `aria-pressed`.
- **Door:** described in 4.1; figures have real `alt` text, for example `Fuego at sunset seen from the Solex camp, a guest in the foreground`.
- **Video:** no audio track, muted, `playsinline`, visible pause control, never autoplays with reduced motion or Save-Data, `aria-label="Inside a cabin: mattresses, sleeping bags and woven blankets"`.
- **Reduced motion:** see 4.2. Also honour `navigator.connection.saveData` (no video preload, no desktop photo-panel prefetch).
- Usable at **200% zoom** and 320 px width without horizontal scroll (except the cabin photo snap row, which is a deliberate carousel with its own scrollbar and a keyboard-scrollable `tabindex="0"` region labelled "Cabin photos").
- Forced colors: borders and focus remain visible (`forced-color-adjust` is untouched; the transparent outline is in place).
- Alt text: describe every real photo and say where it is from, for example `Cabins on the ridge path at the Solex camp, Fuego volcano straight ahead in daylight`. Decorative textiles are `aria-hidden`.
- Plain English: no puns in navigation or labels.

### 7.2 Image strategy

**LCP hero:**
- Hero `<img>` (never a CSS background) inside `<picture>` with art direction:
  - `<source media="(max-width: 959px)" type="image/avif" srcset="hero-m-640.avif 640w, hero-m-828.avif 828w, hero-m-1080.avif 1080w" sizes="calc(100vw - 40px)">`
  - The same for WebP.
  - Desktop sources `hero-d-900` / `hero-d-1200` (3:4) with `sizes="(min-width: 960px) 40vw"`, capped by the 520 px column.
  - JPEG fallback `hero-d-1200.jpg`.
- Attributes: `fetchpriority="high"`, `loading="eager"`, `decoding="async"`, explicit `width`/`height`.
- `<link rel="preload" as="image" type="image/avif" imagesrcset="…" imagesizes="…" media="(max-width: 959px)">`, **identical** to the mobile `<source>`, plus one for desktop.
- **srcset descriptors must match real pixel widths** (D's bug).
- Mobile hero ≤ 80 KB AVIF at 1080w.

**All other images:**
- `loading="lazy"`, `decoding="async"`, explicit `width`/`height` (or `aspect-ratio` + `object-fit: cover`).
- AVIF + WebP, widths 480 / 800 / 1200, **never larger than the source**.
- `sizes` that match the layout, for example `(min-width: 960px) 520px, calc(100vw - 40px)`.

**Encoding:**
- AVIF (libaom, `--min 0 --max 63 -a end-usage=q -a cq-level=30`, speed 6) and WebP q 72.
- **Strip all EXIF/GPS** (privacy).
- sRGB.

**Asset table:**

| Output | Source | Crop / focal | Widths |
|---|---|---|---|
| `hero-m` (1:1) | `/tmp/solex_raw/owner/fuego_eruption_night_red_plume.jpg` | x 0–1200, y 120–1320 | 640 / 828 / 1080 |
| `hero-d` (3:4) | same | full; 42% 38% | 900 / 1200 |
| `door-afternoon` (4:5) | `/tmp/solex_raw/owner/cabin_fuego_day.jpg` | 60% 52% | 480 / 800 / 1080 |
| `door-sunset` (4:5) | `/tmp/solex_raw/owner/sunset_man_fuego.jpg` | 45% 66% | 480 / 768 |
| `door-night` (4:5) | `/tmp/solex_raw/owner/fuego_eruption_night_lava_city_lights.jpg` | 52% 34% | 480 / 800 / 1080 |
| `trailhead` (4:3) | `/tmp/solex_raw/site/assets/images/image01.jpg` | 50% 58% | 480 / 800 / 1200 |
| `trail` (4:5) | `/tmp/solex_raw/site/assets/images/gallery01/942c4bdf_original.jpg` | 45% 62% | 480 / 800 |
| `cabins-path` (3:4 / 4:5) | `/tmp/solex_raw/owner/cabins_path_fuego_day.jpg` | 72% 62% | 480 / 800 |
| `sunset-group` (4:5) | `/tmp/solex_raw/owner/sunset_group_three.jpg` | 55% 50% | 480 / 768 |
| `campfire` (4:5) | `/tmp/solex_raw/site/assets/images/gallery01/ec2669a1_original.jpg` | 45% 55% | 480 / 800 |
| `summit-bluehour` (4:5) | `/tmp/solex_raw/site/assets/images/gallery01/435e7f25_original.jpg` | 50% 62% | 480 / 800 |
| `summit-sunrise` (4:5) | `/tmp/solex_raw/site/assets/images/gallery01/6c07d214_original.jpg` | 45% 62% | 480 / 736 |
| `morning-plume` (4:5) | `/tmp/solex_raw/site/assets/images/gallery01/3933a9bd_original.jpg` | 38% 38% | 480 / 768 |
| `door-fuego` (3:4) | `/tmp/solex_raw/site/assets/images/gallery01/0bd7af40_original.jpg` | 32% 40% | 480 / 800 |
| `green-cabins` (4:3) | `/tmp/solex_raw/owner/new_green_cabins.jpg` | 50% 55% | 480 / 800 |
| `backpack-agua` (arch) | `/tmp/solex_raw/site/assets/images/image05.jpg` | 50% 62% | 440 / 673 |
| `cabin-beds.mp4` + poster | `/tmp/solex_raw/owner/cabin_interior_beds.mp4` | native 848×474 | see 7.4 |
| `logo-96.webp`, `logo-patch-360.webp`, `favicon-32.png`, `apple-touch-icon-180.png` | `/tmp/solex_raw/site/logo.png` (trim the transparent margin) | — | — |
| `og-1200x630.jpg` | `/tmp/solex_raw/owner/fuego_eruption_night_red_plume.jpg` | crop y centred at 36% | 1200 |

**Reserve (unused in v1):** `/tmp/solex_raw/site/assets/images/gallery01/8a98a90b_original.jpg` (sunrise friends), `2ed1028f_original.jpg` (sunset ridge), `df16b529_original.jpg` (group indoors: use only if Alexander confirms it is his house), `/tmp/solex_raw/site/assets/images/image12.jpg`, `image03.jpg`. **To commission:** a portrait of Alexander at his door.

### 7.3 Font loading

- **Production:** self-host WOFF2 subsets (`pyftsubset`, Latin-1 + `– — ‘ ’ “ ” · ≈ × ✓ → ↓ ¡ ¿`, plus `á é í ó ú ñ Á É Í Ó Ú Ñ`). Files:
  - `fraunces-roman.woff2`: instanced with `fontTools.varLib.instancer` to `SOFT=100 WONK=0 wght=700:800 opsz=24:144`, ≤ 36 KB, **preload**.
  - `fraunces-italic-600.woff2`: static, `opsz=96 SOFT=100`, ≤ 22 KB.
  - `figtree-var.woff2`: `wght 400:800`, ≤ 26 KB, **preload**.
  - `caveat-brush.woff2`: subset to `A–Z a–z 0–9 . , ' " ! ? ¡ - ’ “ ”` only, ≤ 16 KB, `font-display: optional`, not preloaded.
- `font-display: swap` for Fraunces and Figtree, with metric-matched fallbacks to avoid CLS:
  - `@font-face { font-family: "Fraunces Fallback"; src: local("Georgia"); size-adjust: …; ascent-override: …; }`
  - `@font-face { font-family: "Figtree Fallback"; src: local("Arial"); … }`
  - Compute the overrides with Capsize or Fontaine.
- The prototype may use the Google Fonts link in 2.2 with `preconnect` to `fonts.gstatic.com`.

### 7.4 Video

```
ffmpeg -i /tmp/solex_raw/owner/cabin_interior_beds.mp4 -an -vf "scale=848:-2,fps=24" -c:v libx264 -profile:v main -pix_fmt yuv420p -crf 30 -preset slow -movflags +faststart video/cabin-beds.mp4
```

- Target ≤ 400 KB. Optional `cabin-beds.webm` (VP9, CRF 40) listed first.
- Poster: the sharpest frame (highest Laplacian variance), WebP, 848w, ≤ 30 KB. B's `/tmp/solex_concepts/B-made-local/img/cabin-beds-poster.webp` (22 KB) is acceptable.
- Use `<video muted playsinline loop preload="none" poster="…" width="848" height="474">`. Attach `src` only when within 1 viewport.

### 7.5 JavaScript

- One `js/site.js` ES module (`type="module"`, deferred), ≤ 14 KB min+gz.
- Modules (all in one file):
  - state / builder / message
  - dialog / menu
  - dock
  - reveal observer + safety net
  - door sentinels
  - timeline dial
  - sightline
  - loom
  - video in-view
  - header direction
- IntersectionObserver for everything scroll-related. No scroll-driven layout reads.
- Content and prices come from a single `CONFIG` object at the top (Appendix A).

### 7.6 SEO and meta

- `<title>`: `Acatenango Overnight from Antigua · Camp facing Fuego · Solex Tours`
- Description: `Local guides from La Soledad, 2–8 hikers per guide, a cabin facing Fuego with bedding already up there. Q750 (≈US$100) with transport, entry and 3 meals.`
- Open Graph and Twitter tags with `og-1200x630.jpg`.
- JSON-LD `TravelAgency` (name, telephone `+50248347003`, `addressLocality: "La Soledad"`, `addressCountry: "GT"`, `sameAs: [Instagram]`) and a `TouristTrip` with `offers` (`price: 750`, `priceCurrency: "GTQ"`).
- **No `aggregateRating` and no reviews markup** until real reviews exist.

---

## 8. Things to avoid (from the judges' must-fix lists and the client directives)

**Honesty and content**
1. **No statements about laws, bans, permits, authorities or prohibitions.** This is a client directive and it overrides the conversion judge's "rules stated" suggestion; B's and A's FAQ wording is deleted. Present the Fuego extra hike exactly as Alexander offers it: optional, from camp and back to the same camp, ~4 h (sometimes more), +Q300 pp, decided and paid at camp if you feel fit and the weather is right, nothing prepaid.
2. **The Fuego add-on is never a headline.** It never appears in the hero, legend, dock, comparison table, camp section, builder, total or WhatsApp message. Never "Adrenaline", never "climb Fuego" or "summit Fuego": say "toward Fuego". It is allowed only in three places: the ticket's optional line, the straight-talk line (no price) and FAQ #13. All three sit behind `CONFIG.features.fuegoAddon`. If that flag is false, nothing else may change or break.
3. **No visible placeholders.** No "PLACEHOLDER", no "Reviews go here", no empty review cards. Hide sections without real content.
4. **No invented facts:**
   - no reviews, ratings or counts
   - no clock times other than ~8:00 / ~9:00 / "about 1 h" (no A-style 17:45 / 04:30)
   - no altitudes other than 3,976 m (no camp altitude, no altimeter, no coordinates)
   - no hike durations, no street addresses
   - no "certified guide"
   - no gloves/hats in the Overnight included list
   - no "4 meals"
5. "**Family-run**", the guides' big-agency history and the community/money line appear only in the community block, behind `data-confirm`, until Alexander approves them. They never appear in the hero, legend or meta.
6. "The view from our cabins" and "Real photo · from our camp" captions only on photos Alexander confirms were taken at the Solex camp.
7. Pickup must not be vague ("Morning pickup"). Show "~8:00 AM, confirmed on WhatsApp" from config.
8. Don't leave "How do I pay?" as a non-answer at launch. Get the method; until then, use the interim line in 3.11.

**Voice and labels**

9. No film puns, ticket-booth or survey jargon in navigation, labels or CTAs ("Cold open", "Box office", "Wardrobe department", "Summit Pass", "Build", "Tear & send", "WP 03", "Book your seat"). No pass or reference numbers in the message.
10. No combative "Big Antigua tour vs Solex" framing. Use "How Alexander used to guide / How Solex walks" with the footnote.
11. **Caveat Brush** only for signatures, margin notes and photo annotations. Never for headings ("One view, three shows", the sheet title, "Day 1/Day 2"), labels or prices.

**Visual**

12. No duplicated logo on the mobile first screen (no patch over the arch below 600 px).
13. No crosshair or reticle on the volcano. No topo or contour masks. No neo-brutalist hard offset shadows. No seven-colour patchwork: section backgrounds come only from the token list, and the phase colours appear only in the door and timeline.
14. Never blow the 848×474 cabin video beyond 640 px wide. Never upscale the 768 px sources.
15. No text over dark↔light gradient midpoints. No paper text on lavender. No sun-yellow text on manta. No red text on sky.

**Mobile UX and performance**

16. The hero CTA must open the sheet in place. It never anchors 10 screens down (C's failure).
17. No top sticky strip on mobile (D's 113 px route strip). Mid-page fixed UI is dock-only (≤ 10% of the viewport), plus the compact header only on scroll-up.
18. No text under 13 px. No mono labels. No 20 px-tall links: all targets ≥ 44 px.
19. No `filter: blur()` reveals, no `backdrop-filter`, no `mix-blend-mode` animations, no animated grain, no perpetual loops off-screen, no parallax or push-in on the LCP image.
20. No third-party font CSS in production (the measured 231 KB). No `sizes="94vw"` hero mistakes. No srcset descriptors that don't match file widths. No unsized images.
21. Don't hide navigation behind an unlabelled clock pill. The menu is labelled "Menu".
22. Don't ship a native `<select>` for the tour. Use radio cards with times and prices.
23. Don't let any CTA depend on JS. Every booking link is a working prefilled `wa.me` href.
24. Don't send a message without the group total and the website-price line, or without the (ES) summary line.

---

## Appendix A: `CONFIG` (single source, top of `js/site.js`, mirrored in HTML for no-JS)

```js
const CONFIG = {
  wa: { primary: "50248347003", secondary: "50249468883" },
  pickupOvernight: "~8:00 AM",            // [CONFIRM pickup] latest voice note 8:00; old site 6:30
  tours: {
    overnight: { q: 750, usd: 100, start: null },
    midnight:  { q: 750, usd: 100, start: "10:30 PM" },
    sunset:    { q: 750, usd: 100, start: "10:30 AM" },
    express:   { q: 675, usd: 90,  start: "5:00 AM" },
  },
  porter: { kg: 13, up: 250, down: 250 },
  features: {
    fuegoAddon: true,      // client directive: show as Alexander offers it; one switch removes all 3 mentions
    reviews: false,        // true only with real reviews in REVIEWS[]
    portrait: false,       // true when the photo of Alexander exists
    heroAnnotation: true,  // false if the hero photo isn't confirmed as taken at the Solex camp
    community: true,       // proposal: shown; Alexander approves wording before public launch
    familyRun: false, guidesHistory: false, faqTomorrow: false,
  },
  itinerary: { /* phase rows; replace phase words with real times when Alexander provides them */ },
};
```

## Appendix B: Confirm with Alexander before public launch

| Tag | Question |
|---|---|
| pickup | 8:00 AM (voice note, 31 Oct) or 6:30 AM (old site)? Is it the same for both cafés? |
| meals | 3 meals (voice notes) or 4 (old site)? Are gloves and hats included on the Overnight? |
| payment | Cash at pickup or trailhead? Deposit? Transfer? Cards? |
| cancellation | What happens on a weather day or if the traveller cancels? |
| cutoff | Latest time to book for the next day. Same-day bookings? |
| rental-prices | Rental prices for jacket, backpack, headlamp, poles, shoes |
| panajachel | Who provides the onward ride, and where do you leave the Antigua road? |
| schedule | Real times: hike start, camp arrival, summit start, descent, return |
| difficulty | Typical hike time to camp. Who is it not suitable for? |
| photo-hero / photo-door / photo-camp | Were the plume, lava, sunset, campfire and morning-plume photos taken at the Solex camp? |
| community / family / guides-history | Approve the "Hecho en La Soledad" wording, "family-run", and whether the guides also worked for big agencies |
| portrait | A photo of Alexander at his door (commission it) |
| google-url / social-urls | Google Maps listing, Facebook page |
| fuegoAddon | The commissioner confirms the add-on stays listed (the flag stays on) |
| reviews | 3+ real reviews with name, country, month and source link |

## Appendix C: Acceptance checks (run before handoff)

1. **First screen, 360×740 and 390×844:** H1, Q750, CTA and the pickup line are visible without scroll. Logo appears once.
2. **Position budget (section 3 intro) at 390×844:** price ≤ 0.85; pickup ≤ 1.0; bedding ≤ 1.6; English honesty ≤ 3.5; ticket ≤ 7.0; water/cold ≤ 7.5; page ≤ 18 screens.
3. **Automated audit:** zero visible text nodes < 13 px; zero non-inline targets < 44 px; fixed UI mid-page ≤ 10%.
4. **Reduced motion and `?static=1`:** no running animations, all content visible, video paused, door figures stacked.
5. **No-JS:** every CTA opens WhatsApp with prefilled text.
6. **Builder:** the totals are correct for each tour × {1, 8, 9, 60}. A past date blocks with an error. Today shows the note. The message matches 6.3 byte-for-byte for the example. The (ES) line is present. The dock live state matches the builder.
7. **`fuegoAddon=false`:** all three mentions disappear and the layout is intact. `reviews=false`: no review section in the DOM.
8. **Lighthouse mobile:** Performance ≥ 90, Accessibility 100. LCP ≤ 2.5 s, CLS ≤ 0.05. Transfer until LCP ≤ 200 KB. JS ≤ 14 KB gz.
9. **Contrast:** spot-check every text/background pair against 2.1, including all door and timeline phases.
10. **Keyboard-only and VoiceOver/TalkBack pass:** menu, sightline, door chips, loom stepper, sheet (focus in and out), FAQ deep link `#faq-pickup`.
11. **Grep the built HTML for forbidden strings:** `authorit`, `permit`, `prohib`, `illegal`, `PLACEHOLDER`, `certified`, `Summit Pass`, `Cold open`, `family-run` (outside the community block).
