# Solex Tours · English website (proposal build)

**"Sleep facing Fuego · Hecho en La Soledad"**: a one-page, mobile-first site for Solex Tours, a small
family-run operator from La Soledad at the foot of Acatenango (Guatemala). The page sells the
Acatenango Overnight (Q750 per person) and turns every booking into a prefilled WhatsApp message to
Alexander. Vanilla HTML/CSS/JS, no frameworks, no third-party requests at runtime.

> This is a **proposal**: `<meta name="robots" content="noindex, nofollow">` and `robots.txt`
> (`Disallow: /`) must be removed before launch, and Alexander still has to approve the items listed
> in the `CONFIRM` comment at the top of `src/index.html` (pickup time, meals, payment, wording of the
> family/community block, photo locations, review selection…).

## Build

```bash
npm install                 # sharp, lightningcss, esbuild, axe-core (dev only)
npm run media               # responsive images + cabin video → site/assets/{img,video} (slow: AVIF)
npm run build               # src/ → site/
node tools/build.mjs --no-fuego-hike   # same, with every Fuego-hike block stripped from the HTML
npm run serve               # http://localhost:8080 (python3 static server)
npm run preview             # preview/solex-tours-preview.html: ONE self-contained file (assets inlined)
                            # to look at the design without a server; not for deployment
```

Checks and screenshots (headless Chromium via Playwright):

```bash
node tools/verify.mjs [--shots=docs/screens]   # booking message byte-for-byte, dock, past date, totals,
                                               # no-JS links, axe-core (WCAG 2.2 AA), 13 px / 44 px audits,
                                               # position budget, reduced motion, console errors / 4xx
                                               # (open: "page ≤ 18 screens" fails at ~21 at 390×844; an
                                               # accepted deviation: reviews, community and Fuego blocks were added to the spec)
node tools/perf.mjs                            # LCP / CLS / transfer (Slow-4G-like + 4× CPU) + size table
                                               # + PASS/FAIL for the §4.3 byte budgets (KiB, gzip -9)
node tools/shoot.mjs docs/screens --full --only=m,s,t,d [--path=/?static=1]
node tools/shoot-states.mjs docs/screens       # Cabin Door afternoon / sunset / after dark, menu, timeline
```

`site/` is the deployable folder. All URLs are relative, so it works at a domain root or in a
sub-folder of any static host.

## Folder layout

```
media/                 original photos + cabin video (read-only) and the traced logo mark
src/
  index.html           hand-written page; <img data-pic="ID"> and {{wa:KEY}} are expanded by the build
  assets/css/
    critical.css       fonts, tokens, base, header, hero (inlined into <head>)
    site.css           everything else (loaded without blocking first paint)
    textile*.css       generated woven motifs (tools/gen-textile.mjs)
  assets/js/site.js    the one deferred ES module (CONFIG at the top)
  assets/fonts/        self-hosted WOFF2 subsets (Fraunces, Figtree, Caveat Brush; SIL OFL)
  assets/brand/        logo roundels (webp)
  favicon.*, apple-touch-icon.png, icon-192/512.png, og-image.jpg, site.webmanifest, robots.txt
site/                  build output (commit this)
tools/
  media.config.mjs     which crops/widths to export (people-free crops, never upscaled)
  build-media.mjs      AVIF/WebP/JPEG + manifest.json; video MP4/WebM + poster
  build.mjs            src → site (pictures, wa.me links, critical CSS, minify, hashes, Fuego strip;
                       HTML comments such as the CONFIRM list stay in src only; the
                       "Proposal build — remove before launch" reminder is kept in site/index.html)
  gen-textile.mjs      stitch motifs (selvedge, fret, volcano band, rombo, icons) as data-URI SVG
  build-fonts.py       font subsetting/instancing (fontTools); hand-text.py lists the hand-font strings
                       (re-run `npm run fonts` after changing any `.hand` text)
  build-brand.mjs      favicon/apple-touch/PWA icons, logo webps and the share image
  verify.mjs · perf.mjs · shoot.mjs · shoot-states.mjs
docs/screens/          final screenshots
```

## CONFIG switches (`src/assets/js/site.js`)

| Switch | Default | Effect |
|---|---|---|
| `features.fuegoAddon` | `true` | The optional Fuego hike appears in exactly three places: the ticket's "Optional · paid on the day" card, one straight-talk line, FAQ "Can we get closer to Fuego?". `false` removes all three at runtime; `node tools/build.mjs --no-fuego-hike` removes them from the HTML itself (they are wrapped in `<!--fuego:start-->…<!--fuego:end-->`). Never in hero, legend, dock, builder, totals or the WhatsApp message. |
| `features.reviews` | `true` | The "In their words" Google-reviews section (verbatim quotes, Nov 2026). |
| `features.heroAnnotation` | `true` | The hand-written "the view from our cabins" note on the hero photo. |
| `features.community` · `familyRun` · `guidesHistory` | `true` | The "Hecho en La Soledad" block, the family-run line/legend cell and the guides' big-agency history. Wording to be approved by Alexander. |
| `features.portrait` | `false` | Reserved for a photo of Alexander at his door (none exists yet; no stand-in is used). |
| `features.faqTomorrow` | `false` | The "Can I book for tomorrow?" FAQ stays out until Alexander gives a cut-off. |
| `pickupOvernight` | `~8:00 AM` (no-break space) | Pickup time shown on the first screen. |
| `tours`, `porter`, `wa` | — | Prices (Q and posted US$), porter price, both WhatsApp numbers. |

The same values are mirrored in the HTML (and in the `{{wa:…}}` table in `tools/build.mjs`) so
every CTA is a working, prefilled `wa.me` link even without JavaScript.

## How it works (short)

- **Booking**: every "Check a date" button opens one form (`form#slip`) in a bottom sheet; the form
  writes the WhatsApp message live (English + a one-line Spanish summary for Alexander, with the
  website price and group total). Links marked `data-send-alt` send the same note to the second
  number (+502 4946 8883). Nothing is charged or stored beyond the tab (sessionStorage). Without JS
  the form is hidden and the Send link is the prefilled static message.
  On phones (< 600 px, with JS) the `#book` section shows a compact card (tour, people, live total
  and one button) that opens the same form in the sheet, and the packing list lives in the ticket's
  "What you bring" card; tablet and desktop keep the inline form and the `#prepare` section.
- **Sticky dock** (phones): appears after the hero CTA, turns into "Sun 8 Nov · 3 people · Q2,250 →
  Send" once the note has content, hides near the form/footer, under the keyboard and while the
  compact header is shown. A past or out-of-range date reads "Check your date" and its Send opens
  the sheet with the error instead of WhatsApp.
- **Motion is opt-in** (`prefers-reduced-motion: no-preference` and JS); `?static=1` forces the
  static layout for screenshots. Only opacity/transform/clip-path animate.
- **The Cabin Door**: one sticky stage, three photos crossfading afternoon → sunset → after dark while
  the sky behind changes colour; reduced motion / no JS shows the three framed photos stacked.
