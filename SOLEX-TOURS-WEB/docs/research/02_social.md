# 02 · Brand voice, social proof and reputation: Solex Tours (Expedición Volcán Acatenango)

Researched: 2026-11-01. Read-only; nothing was posted, messaged, submitted or signed up for.
Every external fact below has its source URL and the date it refers to. **UNVERIFIED** marks anything I could not confirm.

---

## 0. Summary

- **Google Business Profile is the only social proof I could verify, and it is strong:** "Solex Tours", Travel agency, G4R7+6M Aldea La Soledad, **rating 5 from 25 Google reviews**. The rating distribution in the payload is `[0,0,0,0,25]`, meaning all 25 are 5-star. 9 reviews were readable in full: 5 in English, 4 in Spanish, dated 2024-02-07 to 2026-07-16.
- **Facebook:** blocked (login wall or "browser not supported" on www, m. and mbasic.). There is no Wayback snapshot. Only the page title and a paraphrased search snippet were available: about 2,366 likes and "guías certificados por INGUAT, comida y cabañas". The snippet is UNVERIFIED.
- **Instagram @solextours_acatenango:** blocked (login redirect, 429, viewer sites 403, API 401, no Wayback, not indexed). Nothing is verifiable.
- **TripAdvisor, GetYourGuide, Viator, Civitatis, Booking, Hostelworld, Reddit, YouTube, TikTok:** no listing or mention of the Guatemalan Solex Tours found (2026-11-01).
- **Brand voice:** "local agency / local guides", small groups, "what we tell you is what we give you" honesty, and "the best view of Fuego from the cabins". Guest reviews independently repeat these points, which makes them good website copy.

---

## 1. Access log (what was tried, 2026-11-01)

| Platform | URL(s) tried | Result |
|---|---|---|
| Facebook | https://www.facebook.com/p/Solex-Tours-Expedici%C3%B3n-Volc%C3%A1n-Acatenango-100063545829926/ | Login wall ("Log into Facebook"). No page data. |
| Facebook | https://www.facebook.com/people/Solex-Tours-Expedici%C3%B3n-Volc%C3%A1n-Acatenango/100063545829926/ | Only the `<title>` was returned: **"Solex Tours - Expedición Volcán Acatenango \| Acatenango"** |
| Facebook | https://m.facebook.com/100063545829926/ , https://mbasic.facebook.com/100063545829926/ | "Facebook is not available on this browser" error page |
| Facebook | https://www.facebook.com/100063545829926/ (plain browser request) | Redirect to /login/, HTTP 400 |
| Facebook / Instagram / website | archive.org `wayback/available` for all FB URLs, the IG URL and solex-tours.com | No snapshots exist (`archived_snapshots: {}`) |
| Instagram | https://www.instagram.com/solextours_acatenango/ | Redirect to /accounts/login; WebFetch got HTTP 429 |
| Instagram viewers | imginn.com (403), picuki.com → tikvib.com (403), IG web_profile_info API (401) | Blocked. I did not try to get around this. |
| Google Maps | https://www.google.com/maps/search/Solex+Tours/@14.52,-90.88,13z?hl=en and `?hl=es` | **Accessible.** Profile, 9 reviews, topics and owner replies captured (section 3). |
| Google reviews list | https://search.google.com/local/reviews?placeid=ChIJX1b6FbeZuCcRoskGpgXBN3o | HTTP 404 to our fetcher. I did not use Google's internal review-list endpoint because the session's policy blocked it. Result: 16 of the 25 reviews were not read. |
| Web search | Many queries: "Solex Tours" Acatenango / La Soledad / INGUAT / reviews / reddit / tiktok / youtube; phone numbers 4834 7003 and 4946 8883; the handle | Only the FB page snippet plus unrelated "Solex" businesses |
| Bing / DuckDuckGo SERP | bing.com/search?q="Solex Tours" Acatenango ; html.duckduckgo.com | Bing: only unrelated Solex companies. DDG: bot-check page. |
| YouTube | https://www.youtube.com/results?search_query=%22Solex+Tours%22+Acatenango (+ "Solex Tours", "solextours") | Only Dutch/French Solex-moped tour videos and other Acatenango operators. Nothing about this company. |
| TikTok | https://www.tiktok.com/search?q=solex%20tours%20acatenango | JS shell only, no content |

---

## 2. Facebook: "Solex Tours - Expedición Volcán Acatenango" (id 100063545829926)

| Field | Value | Source / date | Status |
|---|---|---|---|
| Page name | "Solex Tours - Expedición Volcán Acatenango" (title tag also appends "\| Acatenango") | https://www.facebook.com/people/Solex-Tours-Expedici%C3%B3n-Volc%C3%A1n-Acatenango/100063545829926/ (title tag, fetched 2026-11-01) | Verified (title only) |
| Link to Google profile | Google Business Profile lists `https://www.facebook.com/profile.php?id=100063545829926` as its website | Google Maps result (section 3), 2026-11-01 | Verified |
| Location | La Soledad, Guatemala | Web-search snippet for the FB URL above, 2026-11-01 | UNVERIFIED (snippet) |
| Likes | about **2,366 likes** | Same snippet. It appeared in 3 separate searches with the same number, 2026-11-01. The date of the count is unknown. | UNVERIFIED (snippet, undated) |
| Intro / bio | Paraphrased by the search engine as "Equipo dedicado para una experiencia única, guías certificados por INGUAT, comida y cabañas" | Same snippet, 2026-11-01 | **UNVERIFIED, not verbatim.** Ask Alexander to copy his FB intro text. |
| Category | not visible | — | UNVERIFIED |
| Followers, rating, recommendations, review text | not visible | — | UNVERIFIED. No FB recommendations were captured. |
| Post themes, recurring phrases, photo subjects, activity dates | not visible | — | UNVERIFIED |

Note on name collision: a separate Belgian business uses **facebook.com/solextours** ("Solex tours", moped rentals in Brugge, solextours.be). Search engines also return Paris and Dutch "Solex tours" (vintage mopeds). The new site should always say **"Solex Tours Acatenango"** or **"Solex Tours · Expedición Volcán Acatenango"** and use the full FB URL with the id. Sources: WebSearch "Solex Tours" Guatemala, 2026-11-01. YouTube results page as above, 2026-11-01.

---

## 3. Google Business Profile (verified; the main source of social proof)

Sources (all retrieved 2026-11-01; the data describes the live listing on that date):
- EN: https://www.google.com/maps/search/Solex+Tours/@14.52,-90.88,13z?hl=en
- ES: https://www.google.com/maps/search/Solex+Tours/@14.52,-90.88,13z?hl=es
- Stable profile link for the website: **https://maps.google.com/?cid=8806719826350754210**. This is the decimal of the feature id `0x27b899b715fa565f:0x7a37c105a606c9a2`. Place ID: `ChIJX1b6FbeZuCcRoskGpgXBN3o`.

| Field | Value |
|---|---|
| Name | Solex Tours |
| Category | Travel agency / Agencia de viajes |
| Address | **G4R7+6M, Aldea La Soledad, Guatemala** (Acatenango municipality, Chimaltenango Department) |
| Coordinates | 14.5409828, -90.8859711 |
| Phone | **+502 4834 7003** (`tel:+50248347003`). The second number +502 4946 8883 is not on Google. |
| Website field | Points to the Facebook page `profile.php?id=100063545829926`, **not** solex-tours.com |
| Hours | "Open 24 hours", every day (Google also showed "All Saints' Day might affect these hours") |
| Rating | **5** (shown as 5) from **25 reviews**. Distribution array `[0,0,0,0,25]` means all 25 are 5-star. |
| Photos | 14 photos. The newest are attached to reviews dated 2026-07-16 and 2026-02-01. Some are labelled "Solex Tours (Owner)". |
| Owner activity | The owner writes a business description and replies to reviews (3 replies seen; see below) |

### 3.1 Owner-written business description (verbatim, English, as on Google)
> "Solex Tours is Acatenango's first local agency. We are situated in La Soledad, the village that sits directly under the volcano.
> The agency was founded in 2019 by Alexander Morales, a local guide who has over 20 years in experience.
> Our local expertise ensures that you will have the best experience discovering Acatenango and the views it gives on El Fuego, one of Guatemala's few remaining active volcanoes."

The following facts are self-reported. They appear only here, so confirm each with Alexander before using it on the site:
- founding year **2019**
- surname **Morales**
- **"over 20 years"** of experience
- **"Acatenango's first local agency"**

The "first" claim is unverifiable. Other operators also run base camps from La Soledad, e.g. a SoyTour basecamp trail listing: https://www.loc.wiki/hiking-trails/la-soledad-soytour-basecamp-volcano-of-fire-soytour-basecamp-acatenango-summit-la-soledad-145621164 (seen 2026-11-01).

### 3.2 Review topics Google extracted (chips; the number is reviews mentioning the topic)
- EN (hl=en): caring guides **6** · small group **4** · acatenango 3 · private tour 3 · personalized contact 3 · rental options 3 · helpful staff 3 · view of the fuego volcano 2 · guide Diego 2 · local run business 2
- ES (hl=es, no counts captured): ritmo · cabañas · colchón · senderos · día de la ascensión · mantas · comer · elección

### 3.3 Owner replies (verbatim; these show his voice)
- On Rachel C.'s review: "Gracias a ustedes por la confianza en nuestra agencia local solex tours" (Google's translation: "Thank you for your trust in our local agency, Solex Tours.")
- On Samantha M.'s review: "Gracias por confiar en nuestra agencia local Solex tours"
- On Theo B.'s review: "Muchas gracias ati amigo por confiar en nuestra agencia local Solex tours"
→ The recurring phrase is **"nuestra agencia local"** ("our local agency").

### 3.4 All 9 reviews read in full (all 5★, Google)
Dates were computed from Google's UTC timestamps and match the relative dates Google shows. Names are as published. The site should show only first name + initial.

| # | Reviewer (as published) | Display as | Date | Lang | Full text (verbatim) |
|---|---|---|---|---|---|
| R1 | Jeremy Horniblow (7 reviews) | Jeremy H. | 2026-07-16 | EN | "In a group of 6 we had an amazing tour with Sergio and Selina. They were both so kind and so much fun, we had so many laughs and saw some of the most breathtaking nature we’ve ever seen. I would 100% recommend them. The hut at base camp has probably the best view of volcán de fuego." |
| R2 | Julian Horniblow (10 reviews) | Julian H. | 2026-07-16 | EN | "Did Acatenango / Fuego with 5 of my friends and Sergio (+ his wife Selina!) and had a fantastic experience. Sergio was an excellent guide, he’s great at keeping the positive vibes up and makes sure to consistently check in on every member during the tough parts. Epic view from their base camp huts too 🌋. / This is a local run business that I am glad I supported and I would 100% book with them again. Gracias Sergio ¡Ah siiiii!" |
| R3 | Meghan Joyce (10 reviews) | Meghan J. | 2026-05-11 | EN | "So happy we chose Solex for this incredible experience. Small groups for a really good price. Very professional and helpful, we borrowed all the equipment we needed which was of good quality. The cabins had one of the best views out of them all at base camp and our guide took really good care of us. / It’s nice to be paying a local family and local guide rather than a big agency. Highly recommended!" |
| R4 | ricky schwarzin (4 reviews) | Ricky S. | 2026-05-11 | EN | "Solex tour are a great choice when booking this hike, Alex was super helpful when we wanted to change days at last minute and he was really flexible. We ended up being the only ones on the day we went so it was a private tour for a great price. The tour guide was a super nice guy and took great care of us. The hut we stayed in had one of if not the best view of fuego and we had it all to ourselves. Would highly recommend using these guys!" |
| R5 | Rachel Clissold (Local Guide, 22 reviews) | Rachel C. | 2026-02-01 | EN | "An amazing local tour agency. Alex and Herman were so helpful, friendly and professional! The food was absolutely delicious and the cabins were comfortable with an amazing view of the volcano… one of the best I think! We were in a private group - best value for money… I think Solex are the best you can go with for this tour!!" |
| R6 | tania pereira (Local Guide, 28 reviews) | Tania P. | 2025-03-11 | ES | "Hicimos la subida al volcán Acatenango con Solex Tours y tuvimos la suerte de contar con el Sr. Custodio como guía. Desde el principio, mostró una gran paciencia, profesionalismo y atención al detalle, asegurándose de que la experiencia fuera segura y cómoda para nosotros. Como tengo bronquitis, la caminata podría haber sido un gran desafío, pero él nunca nos apresuró ni nos dejó atrás. Al contrario, fue extremadamente cuidadoso, asegurándose de que pudiera seguir el ritmo. / Nos encantó el hecho de ser solo dos personas con un guía, lo que hizo que la experiencia fuera mucho más personalizada. El Sr. Custodio no solo nos guió con total seguridad, sino que también preparó nuestra comida, encendió el fuego y se aseguró de que la cabaña estuviera en perfectas condiciones para recibirnos en el campamento. Además, era muy organizado y atento: siempre que tenía que llamarnos, éramos el número 2, demostrando que se preocupaba por cada detalle. / Fue una experiencia inolvidable, en gran parte gracias al cuidado y la dedicación del Sr. Custodio. Recomiendo totalmente a Solex Tours y, si es posible, pidan subir con él: ¡será garantía de un excelente acompañamiento y de una aventura memorable!" |
| R7 | Samantha Montezuma (Local Guide, 22 reviews) | Samantha M. | 2024-11-26 | ES | "Tuvimos una experiencia increíble en el Acatenango 🌋  la organización estuvo muy buena y Mario que fue nuestro guía siempre estuvo pendiente de todo y muy amable. Las cabañas tienen la vista perfecta al volcán fuego 👀" |
| R8 | Elena Cordero Jimenez (2 reviews) | Elena C. | 2024-04-16 | ES | "Excelente atención, éramos 17 personas y todos disfrutamos de la experiencia. / Los guías iban divididos entre el grupo para que subiéramos a nuestro propio ritmo y estuviéramos acompañados. / Kevin, Leonel, Neri y Diego fueron muy atentos y amables, iban verificando que nos sintiéramos bien y que nadie se separara del resto. / ¡Recomendados!" |
| R9 | Theo Brusa (Local Guide, 11 reviews) | Theo B. | 2024-02-07 | ES | "Tuvimos la mejor experiencia posible de la mano de alexander y de nuestro guía Kevin , nunca hubo un mal momento, todo muy bien organizado, las cabañas hermosas y la comida genial. Sin duda se lo recomendare a todas las personas que conozco que viajen a Guatemala. Muchisimas gracias Alexander y Kevin!!!" |

("/" marks a paragraph break in the original.) The other 16 of the 25 reviews: text UNVERIFIED (not retrieved).

Source for every row: https://www.google.com/maps/search/Solex+Tours/@14.52,-90.88,13z (hl=en for R1–R5, hl=es for R6–R9), retrieved 2026-11-01.

---

## 4. Twelve short quotes ready for the website (verbatim excerpts, 5★ Google)

English translations of the Spanish quotes are **ours** and should be labelled "Translated from Spanish". The original can be shown on tap.

| # | Quote (verbatim excerpt) | Who · date | Theme |
|---|---|---|---|
| Q1 | "An amazing local tour agency. Alex and Herman were so helpful, friendly and professional!" | Rachel C. · Feb 2026 (R5) | local / hosts |
| Q2 | "The food was absolutely delicious and the cabins were comfortable with an amazing view of the volcano… one of the best I think!" | Rachel C. · Feb 2026 (R5) | food + cabins |
| Q3 | "So happy we chose Solex for this incredible experience. Small groups for a really good price." | Meghan J. · May 2026 (R3) | small groups / value |
| Q4 | "It’s nice to be paying a local family and local guide rather than a big agency. Highly recommended!" | Meghan J. · May 2026 (R3) | community / local |
| Q5 | "Alex was super helpful when we wanted to change days at last minute and he was really flexible." | Ricky S. · May 2026 (R4) | flexibility |
| Q6 | "The hut we stayed in had one of if not the best view of fuego and we had it all to ourselves." | Ricky S. · May 2026 (R4) | the view (do not imply private cabins are guaranteed) |
| Q7 | "The hut at base camp has probably the best view of volcán de fuego." | Jeremy H. · Jul 2026 (R1) | the view |
| Q8 | "Sergio was an excellent guide, he’s great at keeping the positive vibes up and makes sure to consistently check in on every member during the tough parts." | Julian H. · Jul 2026 (R2) | caring guides |
| Q9 | "This is a local run business that I am glad I supported and I would 100% book with them again." | Julian H. · Jul 2026 (R2) | local / repeat |
| Q10 | "él nunca nos apresuró ni nos dejó atrás." → "He never rushed us or left us behind." | Tania P. · Mar 2025 (R6) | never rushed (matches Alexander's own words) |
| Q11 | "Los guías iban divididos entre el grupo para que subiéramos a nuestro propio ritmo y estuviéramos acompañados." → "The guides were spread across the group so we could climb at our own pace and never be alone." | Elena C. · Apr 2024 (R8) | your pace / guide ratio |
| Q12 | "Las cabañas tienen la vista perfecta al volcán fuego 👀" → "The cabins have the perfect view of Fuego volcano." | Samantha M. · Nov 2024 (R7) | the view |

Spares: R9 "nunca hubo un mal momento, todo muy bien organizado, las cabañas hermosas y la comida genial." → "There was never a bad moment, everything very well organised, beautiful cabins and great food." (Theo B., Feb 2024)

### Rules for using these on the site
1. Keep quotes verbatim, including the reviewers' own spelling (e.g. "fuego" in lowercase). Excerpts may only be cut at sentence boundaries, as above.
2. Attribute each as "First name + initial · Google review · Month Year" and link to https://maps.google.com/?cid=8806719826350754210 ("Read all 25 reviews on Google").
3. The rating line should be dated, e.g. **"5.0 ★ on Google · 25 reviews (Nov 2026)"**, or just "Rated 5.0 on Google" with a link, so it doesn't go stale.
4. **Guide names** in reviews (Sergio, Selina, Herman, Mario, Kevin, Leonel, Neri, Diego, Sr. Custodio, Alex/Alexander) may change. Ask Alexander before naming guides.
5. **Avoid** the R2 sentence "Did Acatenango / Fuego…" and any review wording about climbing Fuego. The transcript editor's note says Guatemalan authorities prohibit ascending Fuego. View-of-Fuego quotes are fine.
6. "Private tour" mentions (R4, R5) happened because few people booked that day. Don't present private cabins or tours as standard; Alexander says it depends on numbers.
7. Get Alexander's approval of the selection before publishing (this is a proposal).

---

## 5. Instagram @solextours_acatenango

| Field | Value | Status |
|---|---|---|
| Handle | `solextours_acatenango`, linked from the current site footer (/tmp/solex_raw/site_home.html) | The site link is verified; the account's contents are not |
| Bio, followers, posts, highlights, post themes | not accessible (login redirect, 429, 403, 401). No Wayback copy. No search-engine index entry. | **UNVERIFIED** |

Action: ask Alexander for a screenshot of the IG profile header (bio + counts) and FB "About/Intro" if we want counts on the site.

---

## 6. Other platforms (searched 2026-11-01)

| Platform | Finding |
|---|---|
| TripAdvisor | No listing for Solex Tours found. Results only show other operators (e.g. Soy Tours, VOLCAN ACATENANGO TOURS). |
| GetYourGuide / Viator / Civitatis | No Solex listing found |
| Booking.com / Hostelworld | No Solex listing found. It's not an accommodation business, so this is expected. |
| Reddit (r/guatemala, r/solotravel, r/backpacking) | No mention found (`site:reddit.com Solex Acatenango`) |
| YouTube | No video about this company. "Solex Tours" results are Dutch/French moped tours. |
| TikTok | Search page not readable. No mention surfaced in web search. |
| Phone numbers | No independent web page mentions +502 4834 7003 or +502 4946 8883. The first appears on Google Business. |

Takeaway: Google is the only review channel, and it is 100% positive. There is an opportunity to (a) link Google reviews from the new site and (b) open a TripAdvisor listing later (owner's decision).

---

## 7. Brand summary

### 7.1 Names in use
- **Solex Tours**: Google name, site footer, owner's spoken name
- **Expedición Volcán Acatenango**: logo ring text and FB page name ("Solex Tours - Expedición Volcán Acatenango")
- Site `<title>` and og:site_name: "Solex Tours - Acatenango"

### 7.2 How they describe themselves (verbatim; source and date given)
From the current site https://solex-tours.com (HTML captured at /tmp/solex_raw/site_home.html, state on 2026-11-01):
- H1: **"Conquista el Volcán Acatenango con los Auténticos Guías Locales"** ("Conquer Acatenango with the authentic local guides")
- **"Vive la experiencia de tu vida sin preocuparte por cargar la carpa."** ("…without worrying about carrying the tent")
- **"Campamentos ya instalados, comida incluida y guías expertos listos para llevarte a tocar las nubes."** ("…ready to take you to touch the clouds")
- **"Gracias por apoyar a los guías comunitarios del volcán de fuego y acatenango."** ("Thank you for supporting the community guides of Fuego and Acatenango")
- Footer slogan: **"Los primeros guías locales"** ("The first local guides")
- Gear section: **"Viaja ligero, nosotros te equipamos"** ("Travel light, we'll kit you out")
- **"⚠️ REGLA DE ORO DEL VOLCÁN"**: 4 litres of water per person + extra clothes
- CTA lines: **"La montaña te llama. ¡Asegura tu fecha!"** · **"🔥 ¡Quiero Conquistar el Acatenango!"** · "Hablar con un Guía"
- Meta description: **"Experiencia de Lava, los pioneros en expediciones al volcán Acatenango y Fuego. Viaja con guías Locales. Apoya una empresa 100% guatemalteca."** Flag: "lava experience" and "expeditions to Fuego" conflict with the Fuego-ascent prohibition noted in the transcript. Don't carry this over.

From Google (owner-written, English): "Acatenango's first local agency… the village that sits directly under the volcano."
From owner review replies: "nuestra agencia local Solex tours".
From Alexander's voice notes (/tmp/solex_raw/transcript.txt, 31 Oct 2026, translated):
- "if you pay for a tour, it’s so you can enjoy it, without being rushed along"
- "With us, what we tell you we’ll provide is what we give you."
- "Things don’t go missing here."
- "I welcome you at my house."
- "To be honest, they speak a little English. Mostly they speak Spanish. I do want to tell you that."
- "Thank God…" (recurs)

### 7.3 Recurring themes (owner and guests agree)
| Theme | Owner says | Guests say |
|---|---|---|
| Local, community | "local agency", "local guides", "guías comunitarios" | "local run business" (R2), "local family and local guide rather than a big agency" (R3), "amazing local tour agency" (R5) |
| Small groups, own pace | 2–8 per guide, "without being rushed" | "Small groups" (R3), "nunca nos apresuró" (R6), "a nuestro propio ritmo" (R8); Google topic "small group" ×4 |
| The view | right-hand camp, Fuego "straight ahead", sunset from camp | "best view of volcán de fuego" (R1, R3, R4, R7); Google topic "view of the fuego volcano" |
| Everything set up | cabins with mattress, sleeping bag, pillow; meals; gear rental | "borrowed all the equipment… good quality" (R3); "cabins comfortable" (R5); topic "rental options" ×3 |
| Caring, fun guides | "very good entertainers and good-hearted people" | "caring guides" ×6; "so many laughs" (R1); "check in on every member" (R2) |
| Honest, flexible | "what we tell you… is what we give you"; decide the extra hike at camp | "really flexible" when changing days (R4) |

### 7.4 Tone
- **Current site:** Spanish, high-energy adventure marketing. Imperative verbs ("Conquista", "Asegura", "Reservar"), heavy emoji (🔥🏕️🌌🌅☀️✔📍⚠️), all-caps buttons, "Extra Opcional Adrenalina".
- **Alexander in person:** warm, humble, plain-spoken, transparent about limits (English level, cabin sharing), faith-inflected ("gracias a Dios"), hospitable ("I welcome you at my house").
- **Guests:** "kind", "fun", "laughs", "caring", "flexible", "professional", "best view", "local family".
- **Recommendation for the English site:** move from "conquer" bravado to Alexander's own voice. Use first-person "we", short honest sentences, and specifics (2–8 per guide, cabins already set up, Fuego straight ahead from camp, pickup at two Antigua cafés). Back each claim with a guest quote from section 4. Keep one or two Spanish signature lines as flavour, e.g. "Los primeros guías locales" with its translation. Soften "first"/"pioneers" unless Alexander can substantiate it, e.g. "a locally owned agency at the Acatenango trailhead, founded by a local guide". These are proposal suggestions, not existing slogans.

### 7.5 Visual identity
Sources: /tmp/solex_raw/owner/logo_screenshot.png, /tmp/solex_raw/site/logo.png, /tmp/solex_raw/site/assets/images/share.jpg. Colours were pixel-sampled.
- **Logo:** circular badge. A light-blue outer ring, then a thin white ring, then a light-blue disc. A yellow-orange **sun with radiating rays** rises behind **two black jagged twin peaks**. Arc text along the top: **"EXPEDICIÓN VOLCĀN ACATENANGO"** in bold condensed all-caps sans. Wordmark **"SOLEX"** in heavy hand-brushed italic caps with a light-blue offset drop shadow, and **"TOURS"** below it, smaller and in the same brush italic.
  - Detail: the accent on "VOLCĀN" renders as a flat bar (macron-like) rather than an acute "Á". Probably stylistic, but worth a check with the owner.
- **Logo colours (sampled):** Sky blue **#ABD4EA** (ring/disc), Ink **#1E1D18** (peaks, wordmark), Sun **#F4C06A** (sun core), White ring #FFFFFF.
- **Current site CSS colours:** #1E1D18 (text; same ink as the logo), #F4C06A (accent; same as the sun), #5C83EE (a brighter blue used for UI), #747989 (grey), #FFFFFF.
- **Current site fonts:** **Dela Gothic One** (display: headings, table headers, form labels) + **Inter** 300–900 (body), both from Google Fonts.
- **Best logo file:** /tmp/solex_raw/site/logo.png (1132×1066, transparent background). logo_screenshot.png is a phone screenshot of a WhatsApp Business "Info azienda" screen (Italian UI) and needs cropping. share.jpg (1200×675) is the logo on white and is the current og:image.

---

## 8. Inconsistencies spotted across channels (for the content brief)

| Item | Where | Conflict |
|---|---|---|
| Website on Google | Google Business website field = Facebook URL | Should point to the new site once live (owner action) |
| Second WhatsApp number | +502 4946 8883 only on the site | Not on Google; confirm both are current |
| Meals | Site: "4 tiempos de comida (Desayuno, Almuerzo, Cena y Desayuno del día 2)"; voice notes: 3 meals (lunch, dinner, breakfast) | Confirm with owner |
| Departure time (overnight) | Site: "Inicio 6:30 AM"; voice note 09: pickup "at eight in the morning" | Confirm with owner |
| Fuego wording | Site meta "expediciones al volcán … Fuego", "Extensión a Volcán de Fuego"; voice notes 07/09 | Transcript editor's note: ascending Fuego is prohibited. Do not market it. |
| "First / pioneers" | Site footer, meta, Google description | Unverifiable superlative; soften or substantiate |
| Founding year / experience / surname | Google description only (2019; 20+ years; Morales) | Confirm before publishing |
| INGUAT certification | FB intro (paraphrased snippet); site says "Guía local certificado" | UNVERIFIED. Ask for credential details before displaying a certification badge. |
| Hours | Google: "Open 24 hours" | Fine for WhatsApp replies, but the owner may want real reply hours |

---

## 9. Owner action items (optional, for the proposal)
1. Send screenshots of the FB "Intro/About" and the IG profile header, so we can quote the bio and counts accurately.
2. Update the Google Business website field to the new site. Add the WhatsApp number to the profile.
3. Ask happy guests for Google reviews, e.g. with a QR code at basecamp linking to the Google profile.
4. Approve which guest quotes and guide names may appear on the site.
5. Confirm: founding year, years of experience, INGUAT credentials, meals count, pickup time.
