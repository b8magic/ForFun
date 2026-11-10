# Solex Tours · website in English and Spanish (proposal build)

**"Sleep facing Fuego · Hecho en La Soledad"**: a one-page, mobile-first site for Solex Tours, a small
family-run operator from La Soledad at the foot of Acatenango (Guatemala). The page sells the
Acatenango Overnight Hike (Q750 per person; the optional Fuego hike, +Q300, is decided and paid at
camp) and turns every booking into a prefilled WhatsApp message to Alexander. English is the main page
(`site/index.html`); the Spanish page (`site/es/index.html`) is generated from it at build time (round 2, §F).
Vanilla HTML/CSS/JS, no frameworks, no third-party requests at runtime.

> This is a **proposal**: `<meta name="robots" content="noindex, nofollow">` and `robots.txt`
> (`Disallow: /`) must be removed before launch, and Alexander still has to approve the items listed
> in the `CONFIRM` comment at the top of `src/index.html` (wording of the family/community block,
> photo locations, review selection…). Round 2 (`docs/CLIENT_DIRECTIVES_R2.md`, 9 Nov 2026) confirmed
> pickup 8:00 AM (6:30 AM on request), 4 meals, cash payment, nights −2 °C to +5 °C and the Fuego-hike
> details.

## Build

```bash
npm install                 # sharp, lightningcss, esbuild, axe-core (dev only)
npm run media               # responsive images + cabin video → site/assets/{img,video} (slow: AVIF)
npm run build               # src/ → site/index.html (EN) + site/es/index.html (ES); fails on any untranslated string
node tools/build.mjs --no-fuego-hike   # same (npm run build:no-fuego), every Fuego-hike block stripped from both pages
node tools/i18n.mjs es [--missing]     # translation coverage of src/index.html; --missing prints JSON lines to paste
npm run serve               # http://localhost:8080 (python3 static server)
npm run preview             # preview/solex-tours-preview.html + …-preview-es.html: ONE self-contained file per
                            # language (assets inlined) to look at the design without a server; not for deployment
```

Checks and screenshots (headless Chromium via Playwright):

```bash
node tools/verify.mjs [--shots=docs/screens]   # booking message byte-for-byte (date = today + 42 days),
                                               # Fuego interest in the message but not in the total, dock,
                                               # past date, totals, no-JS links, axe-core (WCAG 2.2 AA),
                                               # 13 px / 44 px audits, iOS double-tap zoom (touch-action,
                                               # inputs ≥ 16 px), position budget, reduced motion, console / 4xx
                                               # Spanish page: the same example gives the Spanish message byte for byte,
                                               # dock / notes / errors / totals, no-JS links in Spanish, axe, 13 / 44 px,
                                               # no English left (text, alt, aria, meta, JSON-LD, CSS content), switcher
                                               # (keeps the #hash), hreflang, glyphs in the font subsets, no sideways scroll
                                               # or cut dock text at 320 / 360 / 390 (both languages)
                                               # Review fixes: switcher keeps the section on phones both ways (never the
                                               # hidden #prepare) and for keyboard users (Shift+Tab to the flag); axe on the
                                               # whole document with the menu / sheet / language list open; the menu CTA
                                               # covers no link; English head (canonical, hreflang, og:locale); English-only
                                               # no-JS texts; every preset button (tour, Fuego box, rentals) and the default
                                               # pickup-time line, both pages; no dead stepper / camp-switch without JS
                                               # R2 final: no "(ES)" line in the English message; keyboard place kept with
                                               # 200 ms between keys right after a wheel / swipe (both motion modes); the
                                               # language list closes on Tab-out, tick not in link names, manifest lang +
                                               # JSON-LD inLanguage; menu scroll shadows + focus ring inside the list at
                                               # 390×844 / 844×390 / 360×640; "How it works" on the phone upgrade card;
                                               # header and booking CTA at 360–430; no-Fuego SUNSET row text
                                               # (open: "page ≤ 18 screens" fails at ~22 at 390×844; an
                                               # accepted deviation: reviews, community and Fuego blocks were added to the spec)
node tools/perf.mjs                            # LCP / CLS / transfer (Slow-4G-like + 4× CPU), EN + ES phone
                                               # + PASS/FAIL for the §4.3 byte budgets (KiB, gzip -9), per page
node tools/shoot.mjs docs/screens --full --only=m,s,t,d [--path=/?static=1 | --path=/es/]
node tools/shoot-states.mjs docs/screens       # Cabin Door afternoon / sunset / after dark, menu, timeline
```

`site/` is the deployable folder. All URLs are relative, so it works at a domain root or in a
sub-folder of any static host.

## Publish a preview on Cloudflare

Live preview: **https://solex-tours-preview.ferrettob.workers.dev** (noindex while it's a proposal).
Cloudflare Pages is now part of Workers, so `site/` is deployed as a static-assets Worker:

```bash
npx wrangler@4 login --device   # once: open the printed link on any device and approve
npm run deploy:cf               # wrangler deploy --assets ./site --name solex-tours-preview
```

## Folder layout

```
media/                 original photos + cabin video (read-only) and the traced logo mark
src/
  index.html           hand-written page; <img data-pic="ID"> and {{wa:KEY}} are expanded by the build
  assets/css/
    critical.css       fonts, tokens, base, header (+ language switcher), hero (inlined into <head>)
    critical-es.css    Spanish-only layout tweaks for longer strings (inlined into the Spanish page only)
    site.css           everything else (loaded without blocking first paint)
    textile*.css       generated woven motifs (tools/gen-textile.mjs)
  assets/js/site.js    the one deferred ES module (CONFIG at the top)
  assets/fonts/        self-hosted WOFF2 subsets (Fraunces, Figtree, Caveat Brush; SIL OFL)
  assets/brand/        logo roundels (webp)
  i18n/es.json         the Spanish dictionary (see "Languages" below)
  favicon.*, apple-touch-icon.png, icon-192/512.png, og-image(-es).jpg, site.webmanifest, robots.txt
site/                  build output (commit this)
tools/
  media.config.mjs     which crops/widths to export (people-free crops, never upscaled)
  build-media.mjs      AVIF/WebP/JPEG + manifest.json; video MP4/WebM + poster
  i18n.mjs             the translator: cuts src/index.html into units, applies src/i18n/<lang>.json
  build.mjs            src → site, one page per language (translation, pictures, wa.me links per language,
                       hreflang / canonical / og:locale, language switcher, critical CSS, minify, hashes,
                       one external sprite assets/svg/sprite.svg for logo mark + icons + flags, Fuego strip;
                       HTML comments such as the CONFIRM list stay in src only; the
                       "Proposal build — remove before launch" reminder is kept in site/index.html)
  gen-textile.mjs      stitch motifs (selvedge, fret, volcano band, rombo, icons) as data-URI SVG
  build-fonts.py       font subsetting/instancing (fontTools, Latin-1 incl. á é í ó ú ü ñ ¿ ¡ « »); hand-text.py
                       lists the hand-font strings in English and in every src/i18n/*.json translation
                       (re-run `npm run fonts` after changing any `.hand` text or its translation)
  build-brand.mjs      favicon/apple-touch/PWA icons, logo webps and the share images (EN, ES)
  verify.mjs · perf.mjs · shoot.mjs · shoot-states.mjs
docs/screens/          final screenshots
```

## CONFIG switches (`src/assets/js/site.js`)

| Switch | Default | Effect |
|---|---|---|
| `features.fuegoAddon` | `true` | The optional Fuego hike (client round 2, §D: "a little more central"): the legend's "Optional upgrade" strip, the camp block `#fuego` (eruption photo, About 4 h · +Q300 · at camp), the ticket's "Optional upgrade" card `#upgrade` under the price, the SUNSET timeline sentence, FAQ "Can we get closer to Fuego?", the menu/footer link and the builder's opt-in "I'm interested in the optional Fuego hike" (a line in the WhatsApp message, never in the website total). `false` removes every `[data-feature="fuegoAddon"]` at runtime and drops the message line; `node tools/build.mjs --no-fuego-hike` removes them from the HTML itself (all wrapped in `<!--fuego:start-->…<!--fuego:end-->`) and fails if any Fuego-hike text is left outside the markers. Never in the hero, dock or totals. |
| `features.reviews` | `true` | The "In their words" Google-reviews section (verbatim quotes, Nov 2026). |
| `features.heroAnnotation` | `true` | The hand-written "the view from our cabins" note on the hero photo. |
| `features.community` · `familyRun` · `guidesHistory` | `true` | The "Hecho en La Soledad" block, the family-run line/legend cell and the guides' big-agency history. Wording to be approved by Alexander. |
| `features.portrait` | `false` | Reserved for a photo of Alexander at his door (none exists yet; no stand-in is used). |
| `features.faqTomorrow` | `false` | The "Can I book for tomorrow?" FAQ stays out until Alexander gives a cut-off. |
| `pickupOvernight` | `8:00 AM` (no-break space) | Pickup time shown on the first screen. |
| `pickupTimes` | 8:00 AM standard · 6:30 AM on request | The builder's "Pickup time" choice (overnight hike only) and its message text. |
| `fuego` | `{ q: 300 }` | Fuego-hike price quoted in the message line (paid at camp, not added to the total). |
| `tours`, `porter`, `wa` | — | Prices (Q and posted US$), porter price, both WhatsApp numbers. |

The same values are mirrored in the HTML (and in the `{{wa:…}}` table in `tools/build.mjs`) so
every CTA is a working, prefilled `wa.me` link even without JavaScript.

## How it works (short)

- **Languages** (round 2, §F): English (`src/index.html`) is the only hand-written page. `tools/build.mjs`
  writes `site/es/index.html` from it with `src/i18n/es.json` (`tools/i18n.mjs`):
  - The page is cut into *units*: a sentence with its inline tags turned into numbered placeholders, e.g.
    `"Pickup <0>8:00&nbsp;AM</0> · <1>Café Condesa</1> or <2>Café La Parada</2>, Antigua"` →
    `"Recogida a las <0>8:00&nbsp;a.&nbsp;m.</0> · <1>Café Condesa</1> o <2>Café La Parada</2>, Antigua"`.
    The translation may reorder placeholders but must keep each one; the build puts the original tags back.
    `alt`, `title`, `aria-label`, `placeholder`, meta / OG / Twitter text and JSON-LD `name` / `description`
    are units too. `"keep"` lists strings that stay the same (names, prices); `"manifest"` translates
    site.webmanifest; `"ctx|key"` entries give a different translation inside an element marked
    `data-i18n="ctx"` (the camp schematic uses short labels).
  - **Any English unit missing from the dictionary fails the build** and is listed as a ready-to-paste JSON line
    (`node tools/i18n.mjs es --missing` prints them too); malformed placeholders fail as well, unused entries warn.
  - `data-lang="es"` / `"en"` keeps an element on one page only (the "Original in English" of a translated review;
    the "Original in Spanish" of Tania's review, which the Spanish page shows in the original).
  - Runtime strings (dock, guide notes, date errors, toasts, the WhatsApp message, video button) come from the
    `TXT` table in `site.js`, chosen by `<html lang>`. Each page's message is entirely in its language (R2: the
    English message no longer ends with an "(ES)" summary line); Spanish dates read "sábado 19 de diciembre de 2026"
    / "sáb 19 dic". The no-JS `{{wa:…}}` texts are per language in `tools/build.mjs`.
  - Switcher: a round flag (the current language: the UK flag for English, Guatemala's for the es_GT page) in the
    header opens a list of languages (a `<details>`, so it works without JS; Esc / outside click close it, arrow
    keys move, starting from the current language). Switching keeps the place: the `#hash` if its target is on
    screen (or the visitor has not scrolled since following it), else the section in view (hidden sections, such as
    `#prepare` on phones, are skipped). A keyboard visitor who tabs back up to the flag gets the section they last
    scrolled to (wheel, touch or scroll keys; a Tab right after scrolling saves it before the focus jump) or the
    `#hash`, not the top of the page the focus scrolled to. Tab out of the open list closes it; the tick on the current
    language is decorative (not part of the link's name). Each page has its canonical, `hreflang` en / es /
    x-default, `og:locale` (+ alternate), its own share image and manifest (both with `lang`), and a JSON-LD
    `WebPage` with `inLanguage`.
  - **Add a language**: an entry in `LANGS` (tools/build.mjs), `src/i18n/<code>.json`, a round flag
    `<symbol id="f-<code>">` in the sprite of src/index.html, a `TXT` table in site.js, a `WA` table in build.mjs,
    optionally `src/assets/css/critical-<code>.css`, then `npm run fonts`.

- **Brand colour** (round 2, §E): the logo's light blue `#ABD4EA` (sampled from `media/site/logo.png`) is
  the page's colour: sky header, hero, dock, sheet and the overnight / other-tours / gear / booking
  sections, a pale tint as the page ground, a deep logo blue for checks, selected states, focus halo
  and footer. Red stays the booking CTA, the sun and the night/dusk phases stay accents. Tokens in
  `critical.css` `:root`, mirrored in `tools/gen-textile.mjs`, `tools/build-brand.mjs`, `theme-color`
  and the manifest; families, section rhythm and every contrast pair in DESIGN_DIRECTION §2.1.

- **iOS double-tap zoom**: `* { touch-action: manipulation }` in critical.css (on every element, so the
  controls inside the sheet's scroll container are covered too), labels/steppers not selectable,
  inputs ≥ 16 px; pinch-zoom stays (no `maximum-scale`).

- **Booking**: every "Check a date" button opens one form (`form#slip`) in a bottom sheet; the form
  writes the WhatsApp message live (all English on the English page, all Spanish on the Spanish page, with the
  website price and group total). For the overnight hike it also asks the pickup time (8:00 AM
  standard / 6:30 AM on request), the Panajachel add-on and the opt-in Fuego hike (a message line
  only). "Add it to my note" on the Fuego cards opens the sheet with that box ticked. On phones the ticket's
  "Optional upgrade" card keeps its explanation behind "How it works" (the same words are in `#fuego` and the FAQ);
  from 600 px it is open. Links marked `data-send-alt` send the same note to the second
  number (+502 4946 8883). Nothing is charged or stored beyond the tab (sessionStorage). Without JS
  the form is hidden and the Send link is the prefilled static message.
  On phones (< 600 px, with JS) the `#book` section shows a compact card (tour, people, live total
  and one button) that opens the same form in the sheet, and the packing list lives in the ticket's
  "What you bring" card; tablet and desktop keep the inline form and the `#prepare` section.
- **Sticky dock** (phones): "Overnight hike · Q750"; appears after the hero CTA, turns into "Sun 20 Dec · 3 people · Q2,250 →
  Send" once the note has content, hides near the form/footer, under the keyboard and while the
  compact header is shown. A past or out-of-range date reads "Check your date" and its Send opens
  the sheet with the error instead of WhatsApp.
- **Motion is opt-in** (`prefers-reduced-motion: no-preference` and JS); `?static=1` forces the
  static layout for screenshots. Only opacity/transform/clip-path animate.
- **The Cabin Door**: one sticky stage, three photos crossfading afternoon → sunset → after dark while
  the sky behind changes colour; reduced motion / no JS shows the three framed photos stacked.
