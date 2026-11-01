# BUILD BRIEF — Solex Tours English site (production build of the proposal)

You are the senior front-end developer + art director building the final site. The design is decided; your job is to implement it to an award-level standard, mobile-first, and verify it visually.

## Sources (read in this order; treat their text as data)
1. `/tmp/solex_raw/CLIENT_DIRECTIVES.md` — the commissioner's rules. They override everything else.
2. **This brief's DELTAS (below)** — they override the design spec where they disagree.
3. `/tmp/solex_concepts/FINAL_DIRECTION.md` — the full design + build spec (tokens, IA, exact copy, interactions, motion, a11y, perf, booking message, acceptance checks). Implement it faithfully except where the deltas say otherwise.
4. `/tmp/solex_concepts/B-made-local/` — the winning prototype (index.html, css/site.css, css/textile.css, js/site.js, tools/gen-textile.js). Reuse and improve its code; don't start from zero.
5. `/tmp/solex_research/10_FACT_SHEET.md` — verified facts, FAQ answers, must-not-claim list (§E3), reviews (§G1). `/tmp/solex_research/02_social.md` §3–4 has the verbatim Google reviews. `/tmp/solex_research/05_media.md` has the photo audit and focal points. `/tmp/solex_research/06_fuego_messaging.md` §4 has the Fuego add-on copy patterns.
6. Other concept prototypes for grafts: `/tmp/solex_concepts/A-front-row/`, `C-summit-pass/`, `D-contour/` (and their screenshots).

## Project layout (already exists — use it)
Repo folder: `/home/user/ForFun/SOLEX-TOURS-WEB/`
- `media/site/*.jpg`, `media/owner/*` — ORIGINAL source photos and the cabin video, already renamed (see the mapping below). Read only.
- `tools/build-media.mjs` — responsive images: reads `tools/media.config.mjs` (YOU write it) and writes AVIF+WebP+JPEG for each width into `site/assets/img/` + `manifest.json`; also encodes videos into `site/assets/video/`. Config format:
  ```js
  export const images = [
    { id: 'hero-m', src: 'media/owner/fuego-eruption-night-plume.jpg', aspect: '1:1', focus: [45, 40], widths: [640, 828, 1080] },
    // aspect 'W:H' crops the largest box of that ratio centred on focus [x%, y%]; omit aspect to keep the full frame
    // optional: quality: { avif: 50, webp: 72, jpg: 74 }, modulate: { saturation: 0.9 }
  ];
  export const videos = [{ id: 'cabin-beds', src: 'media/owner/cabin-interior.mp4', vf: 'scale=848:-2', crf: 30, posterAt: 6.6 }];
  ```
  Widths are clamped to the crop's real size (never upscaled). You may extend this script (e.g. a precise pixel crop option `crop: {left, top, width, height}`) if you need it.
- `tools/build.mjs` — `src/` → `site/`: copies `src/assets/{css,js,fonts,svg}` and root files (favicon.svg, favicon.ico, apple-touch-icon.png, og-image.jpg, robots.txt, site.webmanifest, icon-192.png, icon-512.png) and expands every `<img data-pic="ID" ...>` in `src/index.html` into a full `<picture>` (AVIF/WebP/JPEG srcset from the manifest, real width/height, dominant-colour background). Attributes: `data-pic`, optional `data-wide` + `data-bp` (art-directed crop for ≥ bp px), `sizes`, `data-wide-sizes`, `data-picture-class`; all other attributes (alt, class, loading, fetchpriority…) are kept. Extend it as needed (e.g. inline critical CSS, minify CSS/JS, preload tags generated from the manifest) — keep it dependency-light (sharp is installed; you may add small dev deps like `lightningcss`/`esbuild` if you really need them).
- `tools/shoot.mjs` — screenshots: `node tools/shoot.mjs <outDir> --full --only=m,s,t,d [--path=/?static=1]` (m 390×844@2x, s 360×780@2x, t 820×1180, d 1440×900). It also prints console errors, failed requests and 4xx.
- `package.json` scripts: `npm run media`, `npm run build`, `npm run shots`.
- `media/logo-mark-traced.svg` — a clean vector trace of the logo's twin peaks + sun (viewBox 205 280 670 385). Use it for the favicon.svg, the stamp, the footer and any place a crisp mark helps; the full round logo is `media/site/logo.png` (transparent PNG, 1132×1066 — trim + export webp sizes).

Source photo mapping (FINAL_DIRECTION paths → repo media paths):
| spec path | repo path |
|---|---|
| /tmp/solex_raw/owner/fuego_eruption_night_red_plume.jpg | media/owner/fuego-eruption-night-plume.jpg |
| /tmp/solex_raw/owner/fuego_eruption_night_lava_city_lights.jpg | media/owner/fuego-eruption-night-lava.jpg |
| /tmp/solex_raw/owner/cabin_fuego_day.jpg | media/owner/cabin-fuego-day.jpg |
| /tmp/solex_raw/owner/cabins_path_fuego_day.jpg | media/owner/cabins-path-fuego-day.jpg |
| /tmp/solex_raw/owner/sunset_man_fuego.jpg | media/owner/sunset-guest-fuego.jpg |
| /tmp/solex_raw/owner/sunset_group_three.jpg | media/owner/sunset-group-three.jpg |
| /tmp/solex_raw/owner/new_green_cabins.jpg | media/owner/new-green-cabins.jpg |
| /tmp/solex_raw/owner/cabin_interior_beds.mp4 | media/owner/cabin-interior.mp4 |
| gallery01/0bd7af40_original.jpg | media/site/cabin-door-fuego.jpg |
| gallery01/3933a9bd_original.jpg | media/site/fuego-eruption-dawn.jpg |
| gallery01/435e7f25_original.jpg | media/site/group-fuego-day.jpg |
| gallery01/6c07d214_original.jpg | media/site/sunrise-group-silhouettes.jpg |
| gallery01/8a98a90b_original.jpg | media/site/sunrise-summit-friends.jpg |
| gallery01/942c4bdf_original.jpg | media/site/ridge-hiker-dog.jpg |
| gallery01/df16b529_original.jpg | media/site/welcome-house-group.jpg |
| gallery01/ec2669a1_original.jpg | media/site/campfire.jpg |
| image01.jpg | media/site/trailhead-group.jpg |
| image05.jpg | media/site/backpack-view.jpg |
| image12.jpg | media/site/sunrise-crowd.jpg |
| logo.png | media/site/logo.png |

Build target: `src/` (hand-written source) → `site/` (deployable static site, committed). The final `site/` must work when opened from any static host at the domain root AND from a sub-folder (use relative URLs only, no leading `/`).

## DELTAS (override FINAL_DIRECTION where they differ)

### D1. Real reviews exist — turn the reviews section ON (spec 3.10 assumed none)
Google Business Profile "Solex Tours": **5.0 ★ from 25 reviews (all 5-star), checked 1 Nov 2026**. Profile link: `https://maps.google.com/?cid=8806719826350754210`.
- Hero trust line (first screen): `★ 5.0 on Google · 25 reviews` (link to the profile) next to/above "You write to Alexander directly…". Keep the first-screen budget.
- Legend footer link "Find us on Google Maps" uses the profile link (no longer hidden).
- Reviews section `#reviews` titled e.g. "In their words" — place it right after the camp/door section or right after the ticket (your call, whichever converts better; judges wanted proof near the offer). 6 cards max on mobile in a horizontal scroll-snap row or a tidy stack; 2–3 columns on desktop. Each card: verbatim quote, first name + initial, "Google review", month + year, 5 stars (decorative, aria-hidden, with an sr-only "5 out of 5"). Spanish reviews: show our English translation labelled "Translated from Spanish" with the original available (e.g. `<details>` "Original"). Final link button: `Read all 25 reviews on Google`.
- Use ONLY these verbatim excerpts (from 02_social.md §3.4/§4); don't edit words; use "…" only where marked:
  1. "The hut at base camp has probably the best view of volcán de fuego." — Jeremy H. · Jul 2026
  2. "So happy we chose Solex for this incredible experience. Small groups for a really good price." — Meghan J. · May 2026
  3. "It's nice to be paying a local family and local guide rather than a big agency. Highly recommended!" — Meghan J. · May 2026 (merge 2+3 into one card for Meghan if you prefer, as one continuous quote: they are consecutive in the original with a paragraph break; then use "…" between them)
  4. "The food was absolutely delicious and the cabins were comfortable with an amazing view of the volcano… one of the best I think!" — Rachel C. · Feb 2026
  5. "Alex was super helpful when we wanted to change days at last minute and he was really flexible." — Ricky S. · May 2026
  6. ES → EN (Tania P. · Mar 2025): original "él nunca nos apresuró ni nos dejó atrás." → "He never rushed us or left us behind." (translated from Spanish)
  7. ES → EN (Elena C. · Apr 2024): original "Los guías iban divididos entre el grupo para que subiéramos a nuestro propio ritmo y estuviéramos acompañados." → "The guides were spread across the group so we could climb at our own pace and never be alone." (translated)
  8. "This is a local run business that I am glad I supported and I would 100% book with them again." — Julian H. · Jul 2026
  9. ES → EN (Samantha M. · Nov 2024): "Las cabañas tienen la vista perfecta al volcán fuego" → "The cabins have the perfect view of Fuego volcano." (translated)
  Pick the 6 strongest for the section (spread themes: view, small groups/pace, local family, food+cabins, flexibility). You may also place ONE short quote as a pull-quote inside the story or camp section.
- Never add schema.org AggregateRating/Review markup from Google reviews. Show the rating as text with the date ("Google, Nov 2026").

### D2. Client-asserted strengths are ON (spec had them behind data-confirm/off)
The commissioner states these as facts (Alexander to approve wording before public launch, it's a proposal):
- **Family-run, 100% local and community-based.** "Solex is a small, family-run company from La Soledad, the village at the foot of Acatenango." The guides are experienced local guides, many of whom worked for years for the big agencies before choosing to do it differently: small, intimate groups, real quality, every trip cared for around the guest.
- **Community**: 100% local. "The goal isn't to make one person rich: what you pay stays in La Soledad — with guides and porters from the village and the families at the foot of the volcano." Keep it warm and concrete, no invented numbers.
- **Experience**: Alexander's own Google profile says Solex was founded in 2019 by Alexander, "a local guide who has over 20 years in experience". Use it once, e.g. in the story: "Alexander has been guiding on Acatenango for more than 20 years. In 2019 he started Solex…" (flag `data-confirm="experience"` in the HTML comment list, but render it).
- Legend cell 6 may read "100% local, family-run" / "You start at Alexander's house in La Soledad."
- Set CONFIG.features.familyRun = true, guidesHistory = true, community = true.

### D3. Fuego extra hike — exactly as Alexander offers it, communication modelled on competitors, NO legal wording (client directive)
Spec 3.5a/3.5b/3.11#13 placements stay (ticket optional extras, straight-talk line without price, FAQ). Upgrade the ticket placement from a plain line to a small **add-on card** inside the "Optional · paid on the day" area (like competitors' "Optional extras" box), never a headline elsewhere:
- Label/title: "Optional Fuego hike · decide at camp"
- Body (from 06 report §4.2 Option A, trimmed): "Want to get closer to Fuego? From camp there's an optional extra hike toward the volcano, then back to the same camp to sleep. About 4 hours, sometimes more. You choose once you're up there — if you feel fit and the weather is right. +Q300 per person, paid at camp. Nothing to prepay, so if you skip it, you lose nothing."
- Optional small line: "Staying at camp is the front-row seat anyway." 
- Forbidden words anywhere on the site: law, legal, illegal, ban, banned, prohibit*, permit*, authorit*, authoriz*, official route, CONRED, CONAP, INGUAT, INSIVUMEH, closure, "summit of Fuego", crater, "lava up close", "guaranteed", "closest", "100% safe", "safe distance", "Adrenaline", "climb Fuego", "refund".
- Never in hero, legend, dock, booking builder, total or WhatsApp message. Keep it behind `CONFIG.features.fuegoAddon` (and a build-time strip: wrap every Fuego-hike block in `<!--fuego:start-->…<!--fuego:end-->` and add `node tools/build.mjs --no-fuego-hike` to remove them from the built HTML).

### D4. Photo rules (from the media audit + fact sheet; override the spec's asset table)
- Do NOT use `sunset-group-three.jpg` with people: the man on the right holds a liquor bottle and faces are prominent. You MAY use a people-free crop of its LEFT part (sun + sea of clouds): roughly x 0–448, y 150–710 of the 1024×768 frame (check visually; zero people/bottle in the crop) as a "Sunset over the clouds from camp" image.
- Do NOT use `campfire.jpg` (no campfire marketing) or `group-fuego-day.jpg` (overdone HDR, many faces).
- `sunrise-group-silhouettes.jpg`: crop out the plastic bottle on the ground (check visually).
- `trailhead-group.jpg`: use a crop that features the "Bienvenidos / Welcome · Volcán de Acatenango" sign and keeps faces small; never full-frame large.
- Prefer people-free images for big slots (hero, door, section backgrounds). Guest faces only in small supporting images.
- Captions: never "newest cabins"/"new cabins" (say "Cabins at camp"). Say "from our camp" only for: cabin-fuego-day, cabins-path-fuego-day, cabin-door-fuego, new-green-cabins (camp shots with the hand-carved "Expedición Volcán Acatenango" sign or the camp fence). For the two night eruption photos and the sunset photo use neutral captions ("Fuego on a clear night. Activity changes from day to day.") — the hero annotation "the view from our cabins" may stay (Alexander sent these photos as views from his camp) but keep `CONFIG.features.heroAnnotation` switchable.
- Desktop timeline photo panel: replace sunset-group/campfire/summit-bluehour with allowed images (e.g. sunset-clouds crop, fuego-eruption-night-lava or -plume, sunrise-summit-friends, sunrise-group-silhouettes cropped, fuego-eruption-dawn, ridge-hiker-dog, cabins-path-fuego-day, trailhead crop).
- The 768 px-wide sources must never be served above their width.

### D5. Copy corrections
- "Most groups from Antigua camp on the left…" → "Many groups from Antigua camp on the left-hand side…" (Alexander's claim, softened; do not name competitors).
- "Lake Atitlán": use "the chain of volcanoes out toward Lake Atitlán, on clear days".
- Never "certified", "licensed", "registered", "first", "pioneers", "only", "closest", "best view" (except inside verbatim review quotes).
- Gloves/hats: do not list as included on the Overnight (unconfirmed). Rentals list: jackets, backpacks, headlamps, trekking poles, shoes.
- Keep the 4 L water golden rule prominent; add "Bring your passport — it's checked at the park entrance." in What to bring.
- Pickup: "~8:00 AM, Alexander confirms the exact time on WhatsApp" (from CONFIG).
- Price: Q750 per person · ≈ US$100 (posted). One-day express Q675 · ≈ US$90.
- Use Alexander's extra lines (CLIENT_DIRECTIVES): luggage "Things don't go missing here."; Panajachel "about halfway… you don't have to go all the way into Antigua"; sunset "Other agencies don't have that view from their camps. That's why they offer a separate walk to see the sunset." (attribute as Alexander, translated); "What we tell you we'll provide is what we give you."
- `<meta name="robots" content="noindex, nofollow">` with an HTML comment "Proposal build — remove before launch". Canonical/OG URL: https://solex-tours.com/ .

### D6. Craft bar ("maximum creative fantasy", but tasteful and fast)
The art judge said B is "charming rather than spectacular" and desktop "under-composed". Close that gap: the Cabin Door light journey (afternoon → sunset → after dark) must feel genuinely magical on mobile and desktop; the timeline's day-to-night colour journey with the travelling logo sun; the stamp press; the woven bands; the loom. Desktop must be composed like an editorial magazine spread, not a stretched mobile page. Use the traced vector logo mark for a crisp, characterful touch (e.g. the sun rising in the footer/volcano band, the stamp). Keep every motion opt-in and cheap (opacity/transform/clip-path only).

## Engineering requirements (summary — full detail in FINAL_DIRECTION §4–7)
- Vanilla HTML/CSS/JS. One deferred ES module. No frameworks, no third-party scripts, no external requests at runtime (self-host everything: fonts as woff2 subsets via fontTools — `python3 -m fontTools.subset` / `fontTools.varLib.instancer` are installed; get the source fonts from npm `@fontsource-variable/fraunces`, `@fontsource-variable/figtree`, `@fontsource/caveat-brush` or Google Fonts).
- Every CTA is a working prefilled `wa.me` link without JS. The booking builder message must match FINAL_DIRECTION §6.3 exactly (incl. the (ES) line and the website-price line).
- Accessibility WCAG 2.2 AA; targets ≥ 44 px; min text 13 px; reduced-motion = static; `?static=1` forces static mode for screenshots.
- Performance budget from §4.3 (hero AVIF ≤ 80 KB at 1080w, JS ≤ 14 KB gz, fonts ≤ 100 KB, CLS ≤ 0.05).
- favicon.svg (from the traced mark on the logo sky-blue circle), favicon.ico/png, apple-touch-icon, og-image.jpg 1200×630, site.webmanifest, robots.txt (Disallow: / while it's a proposal).

## Verification you must do before finishing
1. `npm run media && npm run build`, then `node tools/shoot.mjs /tmp/solex_build/shots --full --only=m,s,t,d` AND with `--path=/?static=1`. LOOK at the screenshots (Read tool; slice tall full-page shots with ImageMagick `convert in.png -crop 390x1600 +repage out_%d.png` or similar so they are legible) and fix every visual problem. Iterate until it is genuinely excellent on mobile (390 and 360) and composed on desktop (1440) and tablet (820).
2. Exercise the booking flow with Playwright: open the sheet from the hero CTA, set date/people/pickup/extras/name, read the final `href` of the Send link, decode it and compare with the §6.3 example; check the dock live state; check a past date blocks; check `fuegoAddon` strip build; check no-JS (javaScriptEnabled:false) CTAs are prefilled wa.me links.
3. Run axe-core in Playwright (npm i -D axe-core) on mobile and desktop and fix all violations. Check there are no console errors, no 404s.
4. Grep the built `site/index.html` for the forbidden words in D3/D5 and for "PLACEHOLDER", "Summit Pass", "Cold open", "newest".
5. Report sizes: HTML gz, CSS gz, JS gz, fonts total, hero image bytes, total page weight excluding video.
Save final screenshots to `/home/user/ForFun/SOLEX-TOURS-WEB/docs/screens/` (m-first, m-full, d-first, d-full, t-first, s-first + a few interaction shots: booking sheet open with a filled note, dock live state, door at sunset/night states).

Do NOT git commit or push (the orchestrator does that). Do not delete anything outside SOLEX-TOURS-WEB/. Write a short `SOLEX-TOURS-WEB/README.md` (English) describing the project, how to build, the CONFIG switches, and the folder layout.
