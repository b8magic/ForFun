# 01 — Audit of the current website solex-tours.com and its history

Prepared 2026-11-01 for the Solex Tours English-site proposal. This is a read-only audit. No form was submitted, nothing was posted, and no account was used.

Screenshots taken today with headless Chrome on the live site are in `/tmp/solex_research/01_site_shots/`. The mobile shots `mobile_00…11.png` are 390×844 @2x. The desktop shots are `desktop_00_hero.png` and `desktop_01_camping.png` at 1440×900.

---

## 0. Key findings (TL;DR)

1. **Single Spanish page built with Carrd.** It was last published **16 Apr 2026** and has not changed since. The domain was registered **6 Mar 2026**. Nothing else is on the site: `/en` and `/es` return 404, there are no subpages, and the sitemap has a single URL.
2. **No Wayback Machine history exists for the domain.** archive.org's availability API returns no snapshots for `solex-tours.com`, `www.` or `/sitemap.xml`, although the same API returned snapshots for control domains in the same session. `web.archive.org` itself (CDX and snapshots), archive.ph, Common Crawl and Memento were unreachable from this sandbox (blocked or reset by the egress proxy). Any "lost" content can only be inferred from **gaps in Carrd element IDs**: 7 texts, 8 button groups, 7 images, 1 table and 1 social-icon block were deleted at some point. Their content is unknown.
3. **Four tours are listed.** Camping 2D/1N, Midnight and Sunset are each **$100 / Q750**. The Day "Express" tour is **$90 / Q675**. The optional Fuego extension is **$40 / Q300** and the porter is **Q250 each way for 13 kg**. Every USD↔GTQ pair uses the same fixed **7.5** rate. All tours leave from **Café Condesa (Parque Central)** and **Café La Parada (Parque La Merced)** in Antigua.
4. **Conversion path.** There are 8 `wa.me` links: 7 go to **+502 4834 7003** and 1 (footer only) to **+502 4946 8883**. Each tour has its own Spanish prefilled message. The site also has a Carrd AJAX form (name, optional email, phone, tour, date) whose destination is configured server-side and is unknown. Its success message contains a word error ("le **conquistará**" instead of "contactará"). Its failure message is in English.
5. **No analytics, pixels, structured data, English version, reviews, FAQ, policies, map or address beyond "Acatenango, Guatemala C. A".** The only third-party requests are Google Fonts and **i.postimg.cc**, which serves the 589 KB header logo.
6. **Design.** The palette is taken from the logo: sky blue `#ABD4EA`, sun yellow `#F4C06A` and near-black `#1E1D18`. Headings use *Dela Gothic One*. All body text is *Inter*, set **in uppercase, justified and wide-tracked**, which is hard to read. White button text on `#F4C06A` has a contrast ratio of **1.67:1**, and the hero's white text on the sky gradient measures **≈2.3:1**. Both fail WCAG AA.
7. **Site vs. Alexander's voice notes (31 Oct 2026):**
   - Start time: **6:30 AM** on the site vs **8:00 AM** in the voice note.
   - Meals: **4 meals** on the site vs **3 meals** in the voice note.
   - "Duerme bajo las estrellas" / camping gear vs **shared 6-person cabins** with mattress, sleeping bag and pillow.
   - The site says "**Guía local certificado**". Alexander never mentions certification and says guides speak **mostly Spanish**.
   - **Gloves & hats** and **porter prices** appear on the site only.
   - The site sells a **"Fuego extension"** and claims to be "pioneers … to Acatenango **and Fuego**". The project's editor's note says Guatemalan authorities prohibit ascending Fuego, so this needs careful handling.
   - Missing from the site: his strongest differentiators. These are the base at the **La Soledad trailhead**, **max 8 per guide**, the **right-hand camp facing Fuego**, **luggage storage**, and **pay-for-Fuego-at-camp**.

---

## 1. Sources and method

| Source | What | Date it refers to |
|---|---|---|
| `/tmp/solex_raw/site_home.html` | Saved HTML, 188,352 bytes, md5 `1e066d57b6aa43387115da7aa0f29cfe` | Byte-identical to https://solex-tours.com/ fetched 2026-11-01 00:45 UTC. HTTP `Last-Modified: Thu, 16 Apr 2026 17:04:21 GMT` |
| https://solex-tours.com/robots.txt | `User-agent: * / Allow: / / Sitemap: https://solex-tours.com/sitemap.xml` | Last-Modified 16 Apr 2026 17:04:23 GMT |
| https://solex-tours.com/sitemap.xml | 1 URL (`https://solex-tours.com`), `lastmod 2026-04-16`, `changefreq daily`, 14 `image:image` entries (gallery titled "Untitled") | 2026-04-16 |
| https://rdap.verisign.com/com/v1/domain/solex-tours.com | Registered **2026-03-06T17:17:02Z**, expires 2027-03-06. Registrar **Moniker Online Services LLC**. NS `ns1–4.monikerdns.net`. Status `client transfer prohibited` | Fetched 2026-11-01 |
| https://dns.google/resolve?name=solex-tours.com&type=A | A `172.66.0.70` (Cloudflare range). `www` is a CNAME to `solex-tours.com`. No MX, no TXT (no email on the domain, no Google site verification) | Fetched 2026-11-01 |
| https://crt.sh/?q=solex-tours.com | First TLS certificates **2026-03-09** (Google Trust Services WE1/WR1), renewed 2026-05-07, 2026-07-05, 2026-09-02 | Fetched 2026-11-01 |
| `HEAD` on every asset | Images `Last-Modified` 2026-03-11 (most) and **2026-03-14** (image02, gallery df16b529, 3933a9bd, 2ed1028f). Favicon / apple-touch 2026-03-11 15:34 | Fetched 2026-11-01 |
| https://archive.org/wayback/available?url=solex-tours.com (also `www.`, `/sitemap.xml`, timestamps 2024 and 2025) | `"archived_snapshots": {}`. Control queries for example.com and carrd.co returned snapshots in the same session | Fetched 2026-11-01 |
| `https://web.archive.org/cdx/search/cdx?url=solex-tours.com*&output=json` | **BLOCKED.** TLS reset by the sandbox egress proxy (`ws_closed_mid_exchange`), 5 attempts. WebFetch: "unable to fetch from web.archive.org" | 2026-11-01 |
| archive.ph, index.commoncrawl.org, timetravel.mementoweb.org | **BLOCKED / rejected** by the egress proxy | 2026-11-01 |
| WebSearch `"solex-tours.com"`; Bing `site:solex-tours.com` | No result for the domain (Bing returned unrelated pages). DuckDuckGo HTML returned HTTP 202 (bot challenge). Indexation status: **UNVERIFIED** | 2026-11-01 |
| Instagram / Facebook links from the site | Both 302 to a **login wall** from this sandbox. Not followed further; social research belongs to another report | 2026-11-01 |
| Carrd docs: https://carrd.com/docs/sites/using-a-custom-domain, https://carrd.com/docs/forms/setting-up-a-custom-email-form, https://carrd.com/pro | Plan requirements and prices (see §2). No page dates shown | Fetched 2026-11-01 |
| `/tmp/solex_raw/transcript.txt`, `/tmp/solex_raw/about_owner_summary.txt` | Alexander's 9 voice notes (31 Oct 2026) and the client's summary | 31 Oct 2026 |

---

## 2. Technical identity

### 2.1 Site builder: **Carrd** (carrd.co / carrd.com). The evidence is conclusive.

1. Every response carries the header `content-security-policy: frame-ancestors https://carrd.com;`.
2. The inline JS opens `indexedDB.open('carrd')`.
3. The markup uses Carrd's component system: `site-wrapper > site-main > inner`, `container-component instance-N style-N`, `text-component`, `buttons-component`, `gallery-component`, `data-onvisible-trigger`, `data-scroll-id`, `deferred` images, and `assets/images/imageNN.jpg?v=e2b28c80` / `gallery01/<hash>_original.jpg` paths.
4. The form is posted by XHR to `/post/custom` and supports Carrd's protection modes (hCaptcha / reCAPTCHA v2 / Turnstile; none enabled here).
5. The 404 page at `solex-tours.com/en` is **byte-identical** (md5 `1edbd3ce1cf8863d9f95eae3c6119b21`) to the 404 page of a nonexistent `*.carrd.co` site.
6. DNS matches Carrd's documented custom-domain setup: an A record on `@` and a CNAME `www` pointing to the apex (https://carrd.com/docs/sites/using-a-custom-domain, fetched 2026-11-01).

**Implied plan.** A custom domain needs "Pro Standard or higher" ([Carrd custom-domain doc](https://carrd.com/docs/sites/using-a-custom-domain)). The form is the **Custom** type (`mode:'custom'`), which "Requires Pro Plus or higher" ([Carrd custom-form doc](https://carrd.com/docs/forms/setting-up-a-custom-email-form)). The owner is therefore probably on **Carrd Pro Plus, listed at $49/yr** on https://carrd.com/pro (fetched 2026-11-01). That plan level is inferred, not confirmed.

**Custom code embed.** A hand-written HTML/CSS/JS embed adds a floating white pill header and a back-to-top button. Its CSS comments suggest a pasted template or AI-generated snippet: `/* Your Brand Color */`, `/* Soft shadow like your example */`, `font-family: sans-serif; /* Change to your font */`, `/* Adjust the Solex text size for small screens */`. They also reference classes that are absent from the page (`.solex-text`, `.logo-link`).

### 2.2 Hosting, pages and files

- HTTPS through Cloudflare. `http://` and `www.` both 301 to `https://solex-tours.com/`.
- Only one page exists. `/index.html` returns the same page. `/en`, `/es`, `/favicon.ico`, `/ads.txt`, `/.well-known/security.txt` and `/assets/main.css` return 404 (the Carrd 404 page). Probes for removed image slots (`image04`, `image06`–`image11`, `image13`) return 404.
- `<html lang="es">`. No `hreflang`, no English version.
- **Page weight:** HTML 188 KB (all CSS and JS inline). On-page images total ≈ **2.98 MB**, including the 589 KB header logo from postimg. Google Fonts load on top of that. No `srcset`, no WebP, no `loading="lazy"`; Carrd "deferred" loading applies to 4 gallery thumbnails only.
- **Third-party hosts requested** (headless Chrome, 2026-11-01): `fonts.googleapis.com`, `fonts.gstatic.com`, **`i.postimg.cc`** (free image host used for the header logo; md5 identical to `/tmp/solex_raw/site/logo.png`). If postimg removes the file, the header logo breaks.
- **Analytics, pixels and tag managers: none.** There is no gtag/GTM, Facebook Pixel, Clarity, Hotjar, Plausible or TikTok.
- **Structured data: none.** There is no JSON-LD, microdata, `og:locale`, `theme-color` or web manifest.

### 2.3 Meta, Open Graph and Twitter tags (verbatim)

| Tag | Value | Note |
|---|---|---|
| `<title>` | `Solex Tours - Acatenango` | No intent keywords (tour / Antigua / overnight) |
| `description` and `og:description` | `Experiencia de Lava, los pioneros en expediciones al volcán Acatenango y Fuego. Viaja con guías Locales. Apoya una empresa 100% guatemalteca.` | "pioneros" is an unverifiable claim. "y Fuego" is a regulatory risk (§8). "Locales" has a stray capital |
| `og:site_name` / `og:title` | `Solex Tours - Acatenango` | |
| `og:type` | `website` | |
| `og:image` | `https://solex-tours.com/assets/images/share.jpg?v=e2b28c80` (1200×675) | A **small logo on a white field**, a weak social preview. No volcano photo |
| `og:url` / canonical | `https://solex-tours.com` | |
| `twitter:card` | `summary_large_image` | Written as `property=` instead of `name=` |
| `color-scheme` | `light only` | |
| Icons | `favicon.png` 64×64, `apple-touch-icon.png` 228×228 (logo) | |

---

## 3. Page structure, top to bottom

Carrd scroll anchors are `#top`, `#expeditions`, `#equipment` and `#gallery`. The booking form section has no anchor.

| # | Carrd container | Anchor | Content |
|---|---|---|---|
| 0 | Custom embed `#custom-sticky-header` | – | White floating pill with the logo (links to `#top`), nav links "Expediciones", "Alquiler de Equipo", "Galería", and the button **"Reservar Ahora"** (a `<button onclick>` to WhatsApp, not a link). **On mobile (≤736 px) the nav links are hidden and the header only appears after 150 px of scroll**, leaving the logo and "Reservar Ahora". There is also a black round "↑" back-to-top button (`title="Go to top"`, in English) |
| 1 | container05 (hero, no image, only the page gradient) | `top` | H1 **"Conquista el Volcán Acatenango con los Auténticos Guías Locales"**. Body: "Vive la experiencia de tu vida sin preocuparte por cargar la carpa. / Campamentos ya instalados, comida incluida y guías expertos listos para llevarte a tocar las nubes. / Gracias por apoyar a los guías comunitarios del volcán de fuego y acatenango." Buttons: **"Ver Expediciones"** (→ `#expeditions`) and **"Hablar con un Guía"** (WhatsApp) |
| 2 | container03 + image03 (cabin with Fuego, daytime) | `expeditions` | Eyebrow "🔥 EL MÁS POPULAR". H2 "🏕️Tour de Acampar (2 Días / 1 Noche)". See §4 |
| 3 | container02 + image02 (group at sunset with Fuego) | – | H2 "🌌 Tour de Media Noche" |
| 4 | container06 + image12 (silhouettes, sunrise/sunset over clouds) | – | H2 "🌅 Tour de Atardecer" |
| 5 | container01 + image01 (group at the "Volcán de Acatenango – Bienvenidos / Welcome" trailhead sign) | – | H2 "☀️ Tour de Un Día (Express)" |
| 6 | container07 + image05 (loaded backpack, Fuego behind) | `equipment` | H2 "🌅 Viaja ligero, nosotros te equipamos". Rental list and golden rule (§5) |
| 7 | container09 | – (none) | Tables "Dirección: Acatenango, Guatemala C. A" and "TELÉFONO: +(502) 4834 7003" (plain text, not clickable). H2 "La montaña te llama. ¡Asegura tu fecha!". Text "Nuestros cupos son limitados, para garantizar una experiencia segura y personalizada completa tus datos o escríbenos directamente por WhatsApp." Form (§7) |
| 8 | container04 gallery01 (9 thumbnails with lightbox) | `gallery` | All `alt="Untitled"` |
| 9 | container08 footer (bg `#7894A4`) | – | "Solex Tours / Expedición Volcán Acatenango / **Los primeros guías locales**". Instagram and Facebook icons. "Links": Inicio (`#top`), Expediciones (`#expeditions`), Galería (**`#galery`, broken** because the anchor is `gallery`). "Contáctanos: Acatenango, Guatemala C. A / Teléfonos / WhatsApp: +(502) 4834 7003, +(502) 4946 8883" (both WhatsApp links) |

Heading outline (live DOM): one H1, six H2s, no H3. 15 of 16 `<img>` have an empty or "Untitled" alt; only the header logo has `alt="Logo"`.

---

## 4. Tours, exactly as published (Spanish source, English gloss)

USD↔GTQ is a constant **7.5** on every item (750/100, 675/90, 300/40). The site never says which currency is charged or how payment works.

| | **Tour de Acampar (2 Días / 1 Noche)** "🔥 EL MÁS POPULAR" | **Tour de Media Noche** | **Tour de Atardecer** | **Tour de Un Día (Express)** |
|---|---|---|---|---|
| Price | **$100 / Q750** | **$100 / Q750** | **$100 / Q750** | **$90 / Q675** |
| Start | "Inicio **6:30 AM**" | "⌚ Inicio **10:30 PM**" | "⌚ Inicio **10:30 AM**" | "Horario: Inicio **5:00 AM**" |
| Meeting points | Parque Central Antigua, Café Condesa; Parque la Merced Antigua, Café La Parada | same | same | same |
| Pitch | "Tour Todo Incluido - La experiencia completa. Duerme bajo las estrellas con vista al Volcán de Fuego." | "Camina bajo las estrellas para llegar justo al amanecer en la cima." | "Disfruta del atardecer mágico desde las alturas." | "Descripción: Para los que tienen poco tiempo pero mucha energía." |
| Transport | Transporte desde Antigua | Transporte desde Antigua | Transporte desde Antigua | Transporte desde Antigua |
| Guide | **Guía local** | **Guía local certificado** | **Guía local certificado** | **Guía local certificado** |
| Meals | **4 tiempos de comida (Desayuno, Almuerzo, Cena y Desayuno del día 2)** | **1 tiempo de comida** (unspecified) | Almuerzo | Almuerzo |
| Gear | "Equipo de acampar instalado y cabañas, Guantes y gorros" | "Guantes, gorros" | "Guantes, gorros" | – (no gloves or hats) |
| Park entry | Entrada al volcán | Entrada al volcán | Entrada al volcán | Entrada al volcán |
| Extras | **"Extra Opcional Adrenalina: Extensión a Volcán de Fuego por solo $40 / Q300."** and **"Portador de equipaje: 13kg por Q250 de subida (de bajada se agregan otros Q250)"** (GTQ only; Q500 round trip) | – | – | – |
| CTA label | "Reservar mi Campamento" | "Reservar Aventura Nocturna" | "RESERVAR TOUR DE ATARDECER" (WhatsApp **Business** icon, unlike the others) | "Reservar Tour de Día" |

What the site never states, for any tour: duration or return time, distance and elevation, difficulty and fitness, group size, guide language, what "1 tiempo de comida" is, whether the Sunset and Midnight tours sleep at camp, minimum age, cancellation, deposit or payment, and the weather caveat.

---

## 5. Gear rental and rules

- Heading "🌅 Viaja ligero, nosotros te equipamos" (re-uses the sunset emoji).
- Copy: "¿No tienes ropa de montaña? No inviertas en equipo que usarás una vez. En Solex Tours te alquilamos todo lo necesario a precios accesibles:"
- Items: ✔ **Chaquetas** (jackets), ✔ **Mochilas** (backpacks), ✔ **Linternas** (torches; headlamps not specified), ✔ **Bastones** (trekking poles), ✔ **Zapatos** (shoes), ✔ **Quien cargue tu equipaje** (a porter).
- **No rental prices are given anywhere.** The porter price appears only under the camping tour.
- Rule: "⚠️ **REGLA DE ORO DEL VOLCÁN: Es obligatorio que traigas en tu mochila personal 4 litros de agua por persona y ropa extra.** ¡Del resto nos encargamos nosotros!" This is the site's only safety or packing guidance.

---

## 6. Contact data and social links

| Item | Value on site | Where |
|---|---|---|
| WhatsApp 1 | **+(502) 4834 7003** → `wa.me/50248347003` | Header CTA, hero, all 4 tour CTAs, contact table (text only), footer |
| WhatsApp 2 | **+(502) 4946 8883** → `wa.me/50249468883` | **Footer only** |
| Address | "Acatenango, Guatemala C. A" | Contact table and footer. **La Soledad is never mentioned**, and there is no map or Google Business link |
| Instagram | https://www.instagram.com/solextours_acatenango/ | Footer icon |
| Facebook | https://www.facebook.com/p/Solex-Tours-Expedici%C3%B3n-Volc%C3%A1n-Acatenango-100063545829926/ | Footer icon |
| Email | **None** (no `mailto:`; the domain has no MX records) | – |
| Google Maps / reviews / TripAdvisor | None. Alexander says they can be found "on Facebook, Instagram and Google as Solex Tours" (voice note 05, 02:04–02:20), but the site does not link Google | – |

Which number is Alexander's personal or business WhatsApp is **UNKNOWN** and needs asking. The logo screenshot (`owner/logo_screenshot.png`) is a WhatsApp Business "Info azienda" profile.

---

## 7. Booking form (`#form01`)

- Fields, in order:
  - `name` (text, "Nombre", required, max 256)
  - `email` ("Email (opcional)", optional, max 128)
  - `phone` (tel, "Teléfono", required, pattern `[0-9\-\(\)+ #*]+`, `minlength 7`, **`maxlength` given twice: 28 and 128**)
  - `expedition` (select, required: "Tour de Acampar", "Tour de Media Noche", "Tour de Atardecer", "Tour de un Día")
  - `date` ("Fecha Deseada", required, Carrd date picker)
  - `url` (**honeypot**, hidden by Carrd via `hid:'url'`)
  - hidden `id=form01`
- Submit button: "🔥 ¡Quiero Conquistar el Acatenango!".
- **Submission:** Carrd JS posts `FormData` with XHR to **`/post/custom`** (`mode:'custom', method:'ajax'`). Optional UTM capture is off by default. Bot protection is set to "default", so no captcha.
- **Destination unknown.** It is set in the Carrd dashboard. Per Carrd docs, a Custom form can send email (to the Carrd account email by default) or go to Airtable, Make, n8n, a URL, Zapier or "Run Code" (https://carrd.com/docs/forms/setting-up-a-custom-email-form, fetched 2026-11-01). **Ask Alexander whether he actually receives these leads.**
- Success message (verbatim): "Gracias por su mensaje, en breve nuestro equipo le **conquistará**. si le urge contactarse con nuestro equipo puede hacerlo a los Teléfonos / WhatsApp:+(502) 4834 7003+(502) 4946 8883". This has a wrong verb, a lowercase "si", and run-together numbers.
- Failure message: "Sorry, something went wrong. Please try again later." (**English** on a Spanish page).
- Validation alert: "Entradas faltantes o erróneas. Por favor, vuelva a intentarlo."
- Missing fields: **number of people**, message or questions, preferred contact channel, consent or privacy note.
- Styling: inputs also uppercase with 0.325 rem tracking.

---

## 8. WhatsApp prefilled messages (decoded)

| Trigger (label) | Number | Decoded `text=` |
|---|---|---|
| Header "Reservar Ahora" | 50248347003 | ¡Hola! Vi su página y me gustaría hacer una reservación. ¿Podría darme más información? |
| Hero "Hablar con un Guía" | 50248347003 | Hola, me gustaría recibir información sobre sus tours y servicios. Gracias. |
| "Reservar mi Campamento" | 50248347003 | ¡Hola! Me gustaría reservar el Tour de Acampar. ¿Me podrías dar más información? |
| "Reservar Aventura Nocturna" | 50248347003 | ¡Hola! Me gustaría reservar el Tour de Media Noche. ¿Me podrías dar más información? |
| "RESERVAR TOUR DE ATARDECER" | 50248347003 | ¡Hola! Me gustaría reservar el Tour de Atardecer. ¿Me podrías dar más información? |
| "Reservar Tour de Día" | 50248347003 | ¡Hola! Me gustaría reservar el Tour de Un Día (Express). ¿Me podrías dar más información? |
| Footer "+(502) 4834 7003" | 50248347003 | ¡Hola! Vi su página y me gustaría hacer una reservación. ¿Podría darme más información? |
| Footer "+(502) 4946 8883" | 50249468883 | (same as above) |

Notes:
- The register is mixed: "Podría" (usted) vs "podrías" (tú).
- No message carries date, group size or language. In the new site, prefilled English messages should include placeholders for **date** and **number of people** so that Alexander gets bookable leads.
- Alexander replies by Spanish voice note, so English-speaking leads need a heads-up about that, or a translation workflow.

---

## 9. Design system (extracted)

### 9.1 Fonts

- **Google Fonts:** `Inter` (300/400/700/800/900 plus italics) and **`Dela Gothic One`** (400).
- **Dela Gothic One** is used for the H1, the tour H2s, the table headers and form labels. Always uppercase, tracking 0.5 rem.
- **Inter** is used for everything else. It is always `text-transform: uppercase`, body weight 300, tracked 0.225–0.45 rem, and body text is also `text-align: justify`.
- The custom header uses a generic `sans-serif`, so it does not match the rest of the page.
- Base size: `html` 16pt, 12pt at ≤1680/1280 px, 10pt at ≤980/736 px. Content width 70 rem.

### 9.2 Palette

The core colours match the logo. Sampled from `site/logo.png`: light blue ≈ `#A8D0E8`, sun ≈ `#F0C068`, mountains ≈ `#181818`.

| Hex | Role on site | Uses in CSS |
|---|---|---|
| `#ABD4EA` | Sky blue (logo). Start of the page gradient `linear-gradient(115deg, #ABD4EA 59%, #F4C06A 100%)` and the header button hover | 2 |
| `#F4C06A` | Sun yellow (logo). **All buttons**, the H1 highlight "Auténticos Guías Locales", header CTA | 8 |
| `#1E1D18` | Near-black (logo mountains). Button hover, H1 `<mark>` "Volcán Acatenango", link hovers | 21 |
| `#FFFFFF` | All text on sections, button text | 43 |
| `#7894A4` | Footer background (slate blue) | 1 |
| `#D0CAAA` | `body` base colour under the gradient | 1 |
| `rgba(20,20,23,0.478)` + noise SVG | Tour section overlay. Rendered ≈ **`#52606A`** (sampled) | – |
| `#5C83EE` | Link colour, `<mark>` in some styles (rarely visible) | 7 |
| `#747989` | `<mark>` and hover grey | 5 |
| `#27282A` | Page-load fade overlay | 1 |
| `#333333`, `#EAEAEA`, `#FBE6C3` | Custom header: nav text, nav border, nav hover (pale sun) | 1 each |
| `#000000` | Back-to-top button | 2 |

A fractal-noise SVG at 47 % alpha sits over the gradient, so the rendered hero background is ≈ `#92B1C1` on the left and ≈ `#C5A469` at the bottom-right (sampled from `desktop_00_hero.png`).

### 9.3 Contrast measured on rendered pixels (WCAG 2.x)

| Pair | Ratio | WCAG AA (4.5 / 3 large) |
|---|---|---|
| White text on hero background `#92B1C1` | **2.26** | Fails |
| `#F4C06A` H1 words on hero background | **1.36** | Fails badly |
| White label on `#F4C06A` buttons (every CTA) | **1.67** | Fails |
| White on footer `#7894A4` | **3.20** | Fails for small text |
| White on tour sections `#52606A` | 6.48 | Passes |

### 9.4 Components and motion

- Buttons are square-cornered (radius 0), uppercase, tracked 0.4 rem, white on yellow, turning near-black on hover. Two WhatsApp glyphs are in use (regular and Business).
- Footer social icons are white outline squares.
- Carrd "onvisible" animations: image zoom-in, text fade-left/right/down, buttons fade-up. The page also fades in from `#27282A`.
- Tour sections alternate image left/right on desktop (`data-reorder`) and stack on mobile.

### 9.5 Mobile behaviour (screenshots)

- With all text uppercase and justified, paragraphs become hard-to-scan blocks.
- The back-to-top button overlaps text, for example "Parque la Merced Anti[↑]" in `mobile_01.png` and `mobile_05.png`.
- There is no menu on mobile, only the logo and "Reservar Ahora" after scrolling.
- There is no persistent WhatsApp floating button. The nearest equivalent is the header CTA, which appears after scroll.

---

## 10. Image inventory (all reusable with permission)

| File (`/tmp/solex_raw/site/…`) | px | Size | Used | What it shows | Notes |
|---|---|---|---|---|---|
| `logo.png` (= i.postimg.cc/fRzWws8L/logo.png) | 1132×1066 | 589 KB | Header | Round badge "EXPEDICIÓN VOLCÁN ACATENANGO / SOLEX TOURS", sun over two peaks | Same as the owner's `logo_screenshot.png` (WhatsApp Business profile). Needs an SVG or optimised version |
| `assets/images/share.jpg` | 1200×675 | 48 KB | og:image | Small logo on white | Replace with a hero photo |
| `favicon.png` / `apple-touch-icon.png` | 64² / 228² | 10 / 59 KB | Icons | Logo | Favicon is blurry |
| `image03.jpg` | 1195×960 | 200 KB | Camping tour | Red-and-white cabin, rope fence, Fuego in daylight above clouds | Strong "camp faces Fuego" proof |
| `image02.jpg` | 768×542 | 65 KB | Midnight tour | 4 hikers in hoods, sunset, Fuego behind | Same photo as gallery `6c07d214` (different crop) |
| `image12.jpg` | 1024×768 | 42 KB | Sunset tour | Silhouettes, sun on horizon, cone (Agua?) over clouds | Low resolution |
| `image01.jpg` | 1408×1301 | 492 KB | Day tour | ~18 people at "Volcán de Acatenango – Bienvenidos / Welcome" trailhead sign | Many wear matching blue shirts. Likely a local group |
| `image05.jpg` | 673×884 | 119 KB | Gear rental | Loaded trekking backpack, Fuego behind | |
| `gallery01/8a98a90b` | 1200×900 (orig 1600×1200) | 116 KB | Gallery | 3 women hugging at sunset, Fuego | |
| `gallery01/435e7f25` | 1200×900 (1600×1200) | 150 KB | Gallery | Group of ~10 at summit, Fuego above cloud sea, blue sky | |
| `gallery01/942c4bdf` | 1200×900 (1600×1200) | 377 KB | Gallery | Hiker and dog on volcanic-sand trail | |
| `gallery01/ec2669a1` | 1200×900 (1600×1200) | 304 KB | Gallery | Hikers in beanies around a campfire | Good "camp life" shot |
| `gallery01/0bd7af40` | 675×900 (960×1280) | 116 KB | Gallery | View through a striped cabin door to Fuego | Iconic. Good hero candidate |
| `gallery01/6c07d214` | 646×900 (736×1024) | 66 KB | Gallery | Duplicate of image02 | Duplicate |
| `gallery01/df16b529` | 969×900 (1200×1114) | 178 KB | Gallery | 6 travellers indoors with a smiling local man | Possibly Alexander's house (UNVERIFIED). Added 14 Mar 2026 |
| `gallery01/3933a9bd` | 680×899 (768×1016) | 69 KB | Gallery | Fuego ash plume at golden hour over a cabin roof | Added 14 Mar 2026 |
| `gallery01/2ed1028f` | 768×838 | 96 KB | Gallery | Man in red shirt by fence at sunset, Fuego left | **Same photo as owner `sunset_man_fuego.jpg`**. Added 14 Mar 2026 |

The owner folder (`/tmp/solex_raw/owner/`, EXIF dates 31 Oct 2026, the date sent) adds:
- two daytime cabin + Fuego shots
- two **night eruption** shots (lava, city lights, red plume)
- **new green cabins** (Alexander: "We're making some changes", note 05)
- 3 men at sunset on the camp terrace
- the sunset man duplicate
- a 10.5 s 848×474 H.264 video of the cabin interior and beds

---

## 11. Hidden content, leftovers and history clues

- **No HTML comments** and no hidden text blocks. The only hidden items are the SVG icon sprite, the honeypot field, and the mobile-hidden nav links.
- CSS comments exist only in the custom header embed (quoted in §2.1). There are unused selectors `.solex-text` and `.logo-link`.
- **Element-ID gaps show deleted content.** Carrd numbers elements sequentially and never reuses numbers.
  - `text`: present 1–19, 21, 28–30; **missing 20, 22–27** (7 deleted texts)
  - `buttons`: present 1–4, 13; **missing 5–12** (8 deleted button groups)
  - `image`: present 1–3, 5, 12; **missing 4, 6–11** (7 deleted images)
  - `table`: **table02** deleted; `icons`: **icons01** deleted (perhaps an earlier social or WhatsApp icon row)
  - The sunset block (`container06`, `image12`, `text28`/`29`, `buttons13`) and the golden-rule text (`text30`) were the **last elements created**.
  - The deleted elements' content cannot be recovered without an archive. Wayback has none (§1). **What the deleted content was is UNVERIFIED.**
- **Timeline (verified):**
  - 2026-03-06: domain registered (RDAP).
  - 2026-03-09: first TLS certificate (crt.sh).
  - 2026-03-11: most images uploaded (HTTP Last-Modified).
  - 2026-03-14: image02 and three gallery photos updated.
  - **2026-04-16 17:04 UTC: last publish** (HTML Last-Modified and sitemap `lastmod`).
  - No change in the 6.5 months since.
- **Wayback Machine:** no snapshots per archive.org's availability API (2026-11-01). The CDX endpoint and snapshot pages could not be reached from this sandbox, so a CDX listing remains **UNVERIFIED**. Given that the domain is only 8 months old and the site is not indexed in the search engines tried, an empty archive is plausible.
- **Look-alike domain:** `solextours.com` (no hyphen) is **not theirs**. It was registered 2025-10-19 with Afternic marketplace nameservers and redirects to a `/lander` parking page (RDAP https://rdap.verisign.com/com/v1/domain/solextours.com, fetched 2026-11-01). Travellers who type the name without the hyphen land on a parked page. Worth telling Alexander. Carrd subdomains `solextours.carrd.co`, `solex-tours.carrd.co` and `solextoursacatenango.carrd.co` return 404.

---

## 12. Inconsistencies

### 12.1 Inside the site

| # | Issue | Where |
|---|---|---|
| 1 | Camping tour lists only "**Guía local**". The other three say "**Guía local certificado**". The hero says "guías expertos" and the footer says "**Los primeros guías locales**" | §4 |
| 2 | "Duerme bajo las estrellas" (implies tent or outdoors) vs "Equipo de acampar instalado **y cabañas**" (cabins). The hero says "sin preocuparte por cargar la **carpa**" (tent) | Camping tour, hero |
| 3 | Mixed currencies: tours in USD+GTQ, **porter in GTQ only**, rental with no prices | §4, §5 |
| 4 | Midnight, Sunset and Camping (2 days, 4 meals, cabin) **all cost $100/Q750**. That price parity is unexplained and suggests a copy-paste price or unclear products | §4 |
| 5 | "1 tiempo de comida" on Midnight is not named. Day tour has no gloves or hats. Sunset tour return time is unknown | §4 |
| 6 | Fuego extension under "Adrenalina … por solo $40" vs the meta claim "pioneros en expediciones al volcán Acatenango **y Fuego**" | §2.3, §4 |
| 7 | Address "Acatenango, Guatemala C. A" (municipality-level, "C. A" with a space) vs the business actually being at the La Soledad trailhead (owner) | §6 |
| 8 | Contact table shows only 4834 7003. The footer shows both numbers. Only one number is used for CTAs | §6 |
| 9 | Broken footer anchor `#galery` (should be `#gallery`). The form section has no anchor | §3 |
| 10 | Typos and markup artefacts: `📍 **Puntos de salida:` (stray Markdown `**`), `Puntos de salida:\` (stray backslash), `-Parque la Merced` (missing space), "Parque **la** Merced" vs owner's "Parque La Merced", `🏕️Tour` and `✔Transporte` (missing spaces), "Tour de **Media Noche**" (standard Spanish: "Medianoche"), "Tour de **Un** Día" vs "Tour de **un** Día" (form), "volcán de **fuego** y **acatenango**" (lower-case proper nouns), "Entrada al volcán**.**" (stray period, camping only), "Locales" capitalised in meta, "+(502)" format, success message "le **conquistará**" | §3–§7 |
| 11 | Formatting inconsistencies: camping uses a checklist component, the others use ✔ text. Only the Day tour has "Descripción:" and "Horario:" labels. Only Midnight and Sunset have ⌚. The sunset CTA source is all caps and uses a different WhatsApp icon. 🌅 is used for both the Sunset tour and Gear rental | §3–§5 |
| 12 | Language mix: Spanish page with English "Go to top" and an English form-failure message. "Podría" (usted) vs "podrías" (tú) in WhatsApp texts | §3, §7, §8 |
| 13 | Same photo twice (image02 = gallery 6c07d214). All alts empty or "Untitled". The sitemap advertises "Untitled" images | §10 |
| 14 | Phone input has two `maxlength` attributes (28 and 128) | §7 |

### 12.2 Site vs Alexander's own words (voice notes, 31 Oct 2026)

| Topic | Site says | Alexander says (recording, time) | Action for the new site / question |
|---|---|---|---|
| **Camping start / pickup time** | "Inicio **6:30 AM**" | "Café Condesa at Parque Central and Café La Parada at Parque La Merced, **at eight in the morning**" (09, 0:42–1:05) | **Confirm** the pickup time. Is it seasonal, or did it change? Is 6:30 the pickup at one café and 8:00 at the other? |
| **Meals** | "**4** tiempos de comida (Desayuno, Almuerzo, Cena y Desayuno del día 2)" | "**three meals** … lunch on the first day, dinner and breakfast. To drink, hot chocolate at night and coffee in the morning" (02, 0:00–0:35) | **Confirm.** Likely 3 meals with an 8 AM start. Add hot chocolate and coffee (not on the site) |
| **Sleeping** | "Duerme bajo las estrellas" / "Equipo de acampar instalado y cabañas" | "You'd stay in **cabins**. The cabins **sleep six and are shared**. Inside there's a **mattress, a sleeping bag and a pillow**" (02, 0:16–0:59). Private cabin for a couple "if we don't have many people" (03, 0:00–0:24) | Use "shared 6-bed cabins, bedding included". Mention the private-cabin possibility as "subject to availability, ask" |
| **Guide credentials and language** | "Guía local **certificado**" (3 tours); "guías expertos"; "Los primeros guías locales" | "We work with **local guides**" (01, 04, 08). "**They speak a little English. Mostly they speak Spanish.** I do want to tell you that" (08, 01:48–02:28). Never mentions certification | **Do not claim "certified"** unless Alexander confirms an accreditation (e.g. INGUAT; UNVERIFIED). State the language honestly: "Spanish-speaking local guides with basic English" |
| **"First / pioneer" claim** | Footer "Los primeros guías locales"; meta "los pioneros en expediciones…" | He started out as a guide for big agencies and "managed to go independent and start a local agency" (05, 00:20–01:13) | Unverifiable superlative. Agency web presence dates from Mar 2026 (domain); the Facebook page may be older (UNVERIFIED). Drop it or rephrase as "guides from La Soledad" |
| **Gloves & hats** | Included in Camping, Midnight and Sunset | Not mentioned in any voice note | **Confirm** whether gloves and beanies are lent, given, or no longer included |
| **Porter** | "13kg por Q250 de subida (de bajada se agregan otros Q250)" | Not mentioned. He talks about leaving your **luggage at his house** at the entrance (08, 01:05–01:48; 09, 3:16–3:59) | **Confirm** the current porter price and weight limit. Add luggage storage at La Soledad (not on the site) |
| **Fuego extension** | "Extra Opcional Adrenalina: Extensión a Volcán de Fuego por solo **$40 / Q300**" | Q300 per person, "**about four more hours**" / "can add more than four hours"; you go and come back to camp (07). **Decide and pay at camp** if fit and the weather is right, with no upfront charge (09, 0:00–0:42) | Price matches (Q300). Add "decide at camp, pay there". **Compliance risk:** the project editor's note says "Guatemalan authorities prohibit ascending Fuego", and the route is unspecified. Wording must avoid implying a summit of Fuego; see the regulations report |
| **Sunset** | Separate product "Tour de Atardecer" (10:30 AM, lunch) | Asked whether they do a separate walk from camp to see the sunset: "**No.** … we can see it from our camp, as long as it isn't cloudy" (08, 02:28–03:12) | Not a contradiction, because they are different things, but it is confusing. **Confirm** whether the Sunset, Midnight and Day tours are still offered. In voice notes he only sells the overnight tour ("So the 750 is for the Acatenango volcano tour", 07) |
| **Sunrise** | Midnight tour reaches the summit "justo al amanecer". Camping copy is silent | Overnight: "We camp **about an hour below the summit** … hike up to see the sunrise … come back down to camp, pack up, have breakfast and descend" (08, 03:12–03:37) | Add a timeline to the overnight tour |
| **Camp location / views** | "con vista al Volcán de Fuego" | Camp on the **right-hand side**; **Fuego straight ahead**; sunset, the chain of volcanoes and **Lake Atitlán**; small eruptions visible; most agencies go left (06; 08, 00:00–00:47) | The biggest differentiator, **absent from the site**. Always add "when the sky is clear" |
| **Base / office** | "Acatenango, Guatemala C. A" | "We're a local agency based at **the main entrance to Acatenango volcano**", "**La Soledad**"; "We don't have an office in Antigua"; "I welcome you at **my house**" (01; 03; 09, 3:16–3:59) | Say "Based in La Soledad, at the main trailhead" |
| **Group size** | "cupos limitados", "experiencia … personalizada" | "**2 to 8 people per guide**, with 8 as the maximum"; "If there are nine, two guides go" (03, 0:51–1:21; 04, 00:23–00:36). Large friend groups of 40–50 are fine (05) | Add "Max 8 hikers per guide" |
| **Transport** | "Transporte desde Antigua" | "**Round trip**. We drop you off at the same spot"; "**an hour** from Antigua to the main entrance" (09) | Add round trip and the 1 h drive |
| **Price and currency** | $100 / Q750 | Quoted "**750 quetzales per person**" for 8 Nov (02). No USD mentioned | Keep GTQ as the primary price. Ask whether USD cash or card is accepted and how deposits work |
| **Onward travel** | – | Possible time saving (~40 min) going on to Panajachel instead of back into Antigua; who provides that transport is not specified (09, 2:03–2:37; translation note) | Mention only as "ask us"; not a product |
| **Promise of honesty** | – | "What we tell you we'll provide is what we give you" (08, 00:47–01:05) | A good trust line for the new site |

### 12.3 Inside the owner materials (minor)

- The summary (`about_owner_summary.txt`) is consistent with the transcript on prices, meals, cabins and group size.
- The word "intrattenitori" (Italian) appears in the summary's description of the guides as "very good entertainers". It is not in the transcript, so it is the client's addition and is UNVERIFIED as Alexander's words.
- The summary's closing line ("write us on WhatsApp and we will be delighted to help!") is also not in the transcript.

---

## 13. What the current site lacks for international conversion

- No English version.
- No location story (La Soledad trailhead), no map, and no "how it works" timeline.
- No group-size promise, no cabin description or photos, no "what's included / not included" for the overnight tour as Alexander describes it, and no packing list beyond water and clothes.
- No difficulty, altitude or weather info, no safety or regulation note, and no cancellation, payment or deposit policy.
- No reviews or social proof, although Alexander says they are on Google.
- No FAQ, and no guide-language disclosure.
- No analytics to measure WhatsApp clicks.
- No structured data and a weak OG image.
- The form's lead destination is unknown.

What works and should be kept: real photos with Fuego from camp, transparent prices in GTQ, the named Antigua meeting points, per-tour prefilled WhatsApp messages, and the "all-inclusive, no tent to carry" pitch.

---

## 14. Questions to confirm with Alexander before publishing

1. Pickup time for the overnight tour: **6:30 or 8:00?** Is it the same at both cafés?
2. Meals: **3 or 4?** Is breakfast on day 1 included?
3. Are the **Midnight, Sunset and Day Express** tours still offered, at what prices, and what does each include? What is the Midnight tour's "1 meal"?
4. Are **gloves and hats** included? Are they lent or given?
5. **Porter** price and weight now: is it still Q250 each way for 13 kg? What are the **rental prices** for jackets, backpacks, headlamps, poles and shoes?
6. Can "**certified**" be claimed? If yes, which body certifies the guides?
7. How should the **Fuego option** be described to stay within the rules: route, duration, what the hike actually reaches, and who decides on the day?
8. Which WhatsApp number should be primary, and who answers in English?
9. Accepted payment methods and currency (cash GTQ / USD / card / transfer), deposit, cancellation and weather policy.
10. Does he receive the website **form submissions** today, and where do they go?
11. Exact Google Maps pin for La Soledad / his house, and the Google Business Profile link (for reviews).
12. Is it OK to state "max 8 per guide", "shared 6-bed cabins", "private cabin when available", and "luggage storage at our house"?
