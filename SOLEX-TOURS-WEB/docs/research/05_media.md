# 05 · Media audit for the art director (Solex Tours / Expedición Volcán Acatenango)

Prepared 2026-11-01. Scope: every image in `/tmp/solex_raw/site/assets/images/**` (the `*_original.jpg` version when both exist), `/tmp/solex_raw/site/logo.png`, `/tmp/solex_raw/owner/*.jpg|png`, and the video `/tmp/solex_raw/owner/cabin_interior_beds.mp4`.
Source of the site images: the current site https://solex-tours.com (captured to disk for this project, state as of 2026-11-01). Source of the owner images: files Alexander sent (WhatsApp, received 2026-10-31).
Method: I opened every file with the image viewer (each one inspected by eye, plus 100 % crops of the key ones). I measured with ImageMagick 6 (size, mean luminance, clipping, a Laplacian sharpness proxy, a median-difference noise proxy, k-means palettes and region samples) and extracted frames with ffmpeg. All hex values below were **sampled from the real files**. The one exception is clearly marked as derived.
No external web facts are used in this report. Any statement about *where* a photo was taken comes from looking at it and is marked UNVERIFIED unless the image itself proves it (e.g. a sign).

Companion files written alongside this report:
- `/tmp/solex_research/05_media_palette.png`: swatch sheet of the sampled palette
- `/tmp/solex_research/05_media_hero_mobile_crops.jpg` and `/tmp/solex_research/05_media_hero_desktop_crops.jpg`: hero crop previews
- `/tmp/solex_research/crops/*.jpg`: every recommended crop, already cut at the geometry listed below (e.g. `lava_9x16.jpg`, `cabin_16x9.jpg`, `trailhead_sign_only.jpg`)
- `/tmp/solex_research/frames/`: video frames at 1 fps (`cabin_01…10.jpg`), `contact_sheet.jpg`, sharpest frames `best_sharp_t6.6s.png` and `best_sharp_t8.4s.png`, and all frames at 5 fps in `frames/all/`
- `/tmp/solex_research/zoom/`: 100 % detail crops used for the quality checks

---

## 0. Key findings

1. **The best asset is `owner/fuego_eruption_night_lava_city_lights.jpg`** (1536×2048). It shows Fuego erupting at night: a grey ash column, glowing lava on the summit and flank, stars, and town lights below. It has no people, and its bottom ~35 % is near-black, which gives natural room for a headline and a WhatsApp button. Use it for the **mobile hero (9:16 or 4:5)** and as a **16:9 desktop hero crop** (1536×864).
2. **Second "wow" image: `gallery01/3933a9bd_original.jpg`.** Fuego throws an orange, sunlit ash plume over a gold horizon, shot from the camp fence. It is only 768×1016, so use it in the mobile Fuego section or as a portrait half in a split desktop layout. It cannot be used full-bleed on desktop.
3. **The camp-location proof shots are `owner/cabin_fuego_day.jpg` and `owner/cabins_path_fuego_day.jpg`.** The cabin carries a hand-carved **"Expedición Volcán Acatenango"** sign, with Fuego straight ahead above a sea of clouds. They are sharp iPhone-quality files with a large empty blue sky for text. These visually prove the brief's core claim ("Fuego straight ahead from our camp").
4. **Resolution is the main limit.** No file is wider than 1600 px. WhatsApp stripped EXIF (no camera model; dates are only the forward time, 2026-10-31 05:57) and recompressed the images. Full-bleed desktop on retina (about 2880 px) will look soft. **Ask Alexander to resend the originals as "Document" in WhatsApp, or by Google Drive.** The lava photo is the priority.
5. **Duplicates:** `image03.jpg` = the same shot as `owner/cabin_fuego_day.jpg`. `gallery01/2ed1028f_original.jpg` = a crop of `owner/sunset_man_fuego.jpg` (RMSE 0.058). `image02.jpg` = a crop of `gallery01/6c07d214_original.jpg`. `2ed1028f.jpg` is byte-identical to `2ed1028f_original.jpg`. Always use the owner or `_original` versions.
6. **Privacy:** 8 photos show real guests' faces prominently (list in §6). Use them only with consent, never as the hero, and never next to an invented quote.
7. **Palette:** the photography consistently gives **twilight navy #1E3256**, **lava red #EE4C3E**, **plume orange #EF6C39**, **sunset gold #FEBC36**, **cloud white #DAE7F2**, **volcanic black #1E1D18 / ash grey #5B5E5B**, **day-sky blue #2A6DC6**, **forest #3C553E**. The logo (circle #ABD4EA, sun #F4C06A, peaks #1E1D18) is a soft, pastel version of the same sky, sun and rock. **Lava red is the one strong colour the logo lacks** and the obvious accent or CTA colour. Use deep ember #B32B1D for white-text buttons (6.4:1).

---

## 1. Inventory and duplicates

| # | File | px | Source | Notes |
|---|---|---|---|---|
| 1 | owner/fuego_eruption_night_lava_city_lights.jpg | 1536×2048 | owner | JPEG q≈80, no EXIF. **Hero.** |
| 2 | owner/fuego_eruption_night_red_plume.jpg | 1200×1600 | owner | q≈93 |
| 3 | owner/cabin_fuego_day.jpg | 1200×1600 | owner | Same shot as site `image03.jpg` (1195×960, cropped/processed) |
| 4 | owner/cabins_path_fuego_day.jpg | 1200×1600 | owner | |
| 5 | owner/new_green_cabins.jpg | 1280×713 | owner | Only landscape owner photo |
| 6 | owner/sunset_group_three.jpg | 1024×768 | owner | |
| 7 | owner/sunset_man_fuego.jpg | 768×1024 | owner | Same as gallery `2ed1028f` (768×838 crop) |
| 8 | owner/logo_screenshot.png | 1179×2556 | owner | iPhone screenshot (Italian UI "Chiudi / Info azienda") |
| 9 | owner/cabin_interior_beds.mp4 | 848×474, 10.5 s | owner | H.264 ~24.9 fps, mono AAC almost silent (mean -64.9 dB, max -32.7 dB) |
| 10 | site/logo.png | 1132×1066 RGBA | site | Opaque area 940×939 at +74+56. The live site hotlinks it from `i.postimg.cc` |
| 11 | site/assets/images/share.jpg | 1200×675 | site | OG image: logo on white |
| 12 | site/assets/images/apple-touch-icon.png | 228×228 | site | |
| 13 | site/assets/images/favicon.png | 64×64 | site | Text illegible at this size |
| 14 | site/assets/images/image01.jpg | 1408×1301 | site | Trailhead group (with COVID-19 signs) |
| 15 | site/assets/images/image02.jpg | 768×542 | site | Crop of #20 |
| 16 | site/assets/images/image03.jpg | 1195×960 | site | Current hero; same shot as #3 |
| 17 | site/assets/images/image05.jpg | 673×884 | site | Backpack in front of Fuego. Provenance UNVERIFIED (looks like stock, see below) |
| 18 | site/assets/images/image12.jpg | 1024×768 | site | Summit sunrise silhouettes |
| 19 | gallery01/0bd7af40_original.jpg | 960×1280 | site | Cabin doorway framing Fuego |
| 20 | gallery01/6c07d214_original.jpg | 736×1024 | site | Summit sunrise, 4 hooded hikers |
| 21 | gallery01/2ed1028f_original.jpg | 768×838 | site | Duplicate of #7; the thumbnail is byte-identical |
| 22 | gallery01/3933a9bd_original.jpg | 768×1016 | site | Fuego golden-hour plume |
| 23 | gallery01/435e7f25_original.jpg | 1600×1200 | site | Summit group, Fuego behind |
| 24 | gallery01/8a98a90b_original.jpg | 1600×1200 | site | Three women at summit sunrise |
| 25 | gallery01/942c4bdf_original.jpg | 1600×1200 | site | Hiker and dog on black-ash slope |
| 26 | gallery01/df16b529_original.jpg | 1200×1114 | site | Guide and 5 guests indoors at base |
| 27 | gallery01/ec2669a1_original.jpg | 1600×1200 | site | Guests around the campfire |

The non-`_original` gallery files are smaller thumbnails of the same pictures (0bd7af40 675×900, 3933a9bd 680×899, 435e7f25 / 8a98a90b / 942c4bdf / ec2669a1 1200×900, 6c07d214 646×900, df16b529 969×900). Do not use them.

Measured technical proxies (ImageMagick; sharpness and noise measured at 800 px max side, so they are relative only, and texture-rich scenes score high on both):

| File | mean L | clipped hi | clipped lo | sharp | noise |
|---|---|---|---|---|---|
| lava_city_lights | 15.7 % | 0.06 % | 39.6 % (intended black foreground) | 12.0 | 4.2 |
| red_plume | 37.9 % | 0.05 % | 3.9 % | 15.7 | 13.3 |
| cabin_fuego_day | 39.2 % | 0.19 % | 0.33 % | 34.1 | 15.1 |
| cabins_path_fuego_day | 39.4 % | 0.20 % | 0.67 % | 36.1 | 15.1 |
| new_green_cabins | 46.2 % | 0.98 % | 0.04 % | 33.6 | 25.5 |
| sunset_group_three | 47.1 % | 0.12 % | 0.89 % | 33.7 | 14.2 |
| sunset_man_fuego | 48.1 % | 0.16 % | 3.17 % | 30.6 | 9.6 |
| image01 | 36.2 % | 0.07 % | 4.80 % | 47.8 | 32.6 |
| image05 | 46.8 % | 3.33 % | 1.66 % | 27.2 | 13.6 |
| image12 | 45.1 % | 0.01 % | 1.44 % | 7.2 (soft) | 1.7 |
| 0bd7af40 | 39.9 % | 0.06 % | 0.03 % | 25.2 | 14.7 |
| 3933a9bd | 52.9 % | 0.00 % | 4.47 % | 18.9 | 4.2 |
| 435e7f25 | 45.8 % | 0.01 % | 4.77 % | 25.9 | 7.8 |
| 6c07d214 | 41.4 % | 0.00 % | 6.13 % | 17.0 | 5.7 |
| 8a98a90b | 49.3 % | 2.03 % (sun) | 0.00 % | 16.0 | 5.7 |
| 942c4bdf | 46.8 % | 0.28 % | 1.46 % | 50.4 | 44.2 (texture) |
| df16b529 | 36.4 % | 0.07 % | 1.58 % | 27.7 | 14.4 |
| ec2669a1 | 32.8 % | 1.05 % | 4.23 % | 37.8 | 28.6 |

---

## 2. Per-asset audit

How to read the focal points: they are the **crop centre as x % / y % of the full source image**. The crop is the largest box of that ratio, clamped to the image edges. The resulting pixel box is given as `WxH+left+top`. Ready-made crops are in `/tmp/solex_research/crops/`.

### 2.1 owner/fuego_eruption_night_lava_city_lights.jpg (1536×2048): **Hero A**
- **Subject:** Fuego seen head-on at night. A grey ash column rises from the summit (crater at about 51 %/42 %). Incandescent lava glows along the summit and down the right-hand flank, and dots of lava glow further down. A starry deep-blue sky sits above a band of cloud, and town lights are scattered across the lowlands at left and right (which towns: UNVERIFIED). The foreground (bottom ~35 %) is near-black ridge. Bottom-left has two out-of-focus orange shapes (probably a jacket, tent or cabin edge) at about 3–35 % / 78–100 %, plus a thin orange vertical at 3 %/60–68 %.
- **Mood:** awe, drama, quiet. This is the "you will see this from camp" money shot.
- **Light / time:** night or late blue hour (stars plus residual glow at the horizon).
- **Technical:** good for a phone night shot. The lava and plume are reasonably sharp at 100 %, the sky shows mild noise and smoothing, and the black foreground is crushed by design (39.6 % of pixels near black). No banding was visible in the sky at 100 %. q≈80 and no EXIF, so it was likely re-saved.
- **Faces:** none.
- **Best use:** **mobile hero** (headline and CTA over the black foreground, so no scrim is needed); desktop hero 16:9; Fuego section; OG/share image (crop 1.91:1 around the cone).
- **Crops:** 9:16 focal **52/50** → `1152x2048+222+0` (crop out the orange blobs at bottom-left by keeping x ≥ 14 %). 4:5 focal **52/46** → `1536x1920+0+0`. 16:9 focal **50/44** → `1536x864+0+469` (keeps the full plume top at about 24 % and the lit flank; the orange sliver at left edge 3 %/60–68 % needs a tiny clone-out or a 2 % left trim). 21:9 banner: focal 50/42 → `1536x658+0+531`.

### 2.2 owner/fuego_eruption_night_red_plume.jpg (1200×1600)
- **Subject:** Fuego at night with a **red-orange lit ash plume** (about 43 %/34 %). Lava glows on the summit cone (apex about 41 %/42 %). Stars and white clouds lie behind, and a dark fence post and two rope lines cross the foreground (post at 35–40 %, y 57–100 %).
- **Mood:** dramatic, "eruption right in front of you". It also proves the view from the camp fence.
- **Light / time:** night with phone night mode or a long exposure. The clouds are bright, so moonlight or a long exposure is likely.
- **Technical:** noisy and smeared (night-mode noise reduction plus over-sharpening halos around the plume and cone). Sky blue is shifted cyan. Fine at card size (≤ 600 px wide) and soft at full width.
- **Faces:** none.
- **Best use:** Fuego section secondary image, gallery, or "small eruptions vs big eruptions" pairing with 2.1.
- **Crops:** 4:5 focal **45/40** → `1200x1500+0+0` (fence post remains). 9:16 focal **43/45** → `900x1600+66+0`. 16:9 focal **45/40** → `1200x675+0+302` (only the post tip and the wire remain at the bottom, easy to clone).

### 2.3 gallery01/3933a9bd_original.jpg (768×1016): **Hero B (mobile only)**
- **Subject:** Fuego's cone in deep red-brown shadow with a tall **orange, sunlit ash plume** (plume about 22 %/35 %, cone apex about 40 %/64 %). The sky runs from periwinkle to a gold horizon band, with a sea of clouds. A camp fence post with rope and a bare tree are at the bottom right.
- **Mood:** spectacular, warm, "golden hour eruption".
- **Light / time:** golden hour, most likely sunset (the sunlit plume and the gold band). Sunset vs sunrise is UNVERIFIED.
- **Technical:** clean but heavily processed (HDR or saturation boost). The sky gradient is smooth. **Low resolution: 768 px wide.** It is OK on phones up to about 2× DPR. It is soft at 3× and on desktop full-bleed.
- **Faces:** none.
- **Best use:** Fuego section lead on mobile, alternate mobile hero (e.g. slide 2), and a portrait half in a desktop split layout.
- **Crops:** 9:16 focal **35/50** → `571x1016+0+0` (plume and cone; loses the tree). 4:5 focal **40/50** → `768x960+0+28`. **Avoid 16:9**: the plume and cone span 12–90 % of the height, so any 16:9 cut breaks the composition.

### 2.4 owner/cabin_fuego_day.jpg (1200×1600): **camp proof, day hero alternative**
- **Subject:** a Solex cabin (corrugated roof, red-brown wooden boards, green base) with a hand-carved sign reading **"Expedición Volcán Acatenango"** (verified at zoom, sign at about 25 %/59 %). A rope-and-post fence lines the path, Fuego rises **straight ahead** (apex about 74 %/45 %) over a forested ridge, and white cumulus cloud sits below. A trail line is visible on Fuego's flank. The top ~45 % is empty deep-blue sky.
- **Mood:** clear, crisp, "this is our camp and this is our view". Trustworthy.
- **Light / time:** clear day with high sun and hard shadows (late morning or midday, UNVERIFIED).
- **Technical:** the best daytime file. Sharp, well exposed (0.19 % / 0.33 % clipping), with low noise and an iPhone look. Sky is a rich #2A6DC6.
- **Faces:** none.
- **Best use:** **camp / "Fuego straight ahead" section background**, day alternative for the mobile hero (headline in the sky area), and a "where we sleep" card.
- **Crops:** 9:16 focal **55/55** → `900x1600+210+0`. 4:5 focal **50/60** → `1200x1500+0+100`. 16:9 focal **50/66** → `1200x675+0+718` (cabin, sign and Fuego: an ideal desktop section band).

### 2.5 owner/cabins_path_fuego_day.jpg (1200×1600)
- **Subject:** a path running along the row of cabins (left edge), with the rope fence leading the eye toward the sea of clouds. Fuego's cone is at the right edge (apex about 88 %/56 %). The top ~55 % is empty blue sky, and there is a small lens flare top-left.
- **Mood:** calm, orderly camp, "your cabin is right on the ridge".
- **Light / time:** clear day, same moment as 2.4 (same file-save timestamp).
- **Technical:** sharp and clean, though the cabin side is slightly underexposed and Fuego is cut by the frame.
- **Faces:** none.
- **Best use:** camp section background with text on top, secondary camp card.
- **Crops:** 9:16 focal **60/55** → `900x1600+270+0`. 4:5 focal **50/62** → `1200x1500+0+100`. 16:9 focal **50/72** → `1200x675+0+814`.

### 2.6 owner/new_green_cabins.jpg (1280×713)
- **Subject:** a newer cabin block clad in **artificial-turf green panels**, with PVC windows (the protective film with "HNGROUP" print is still on the left window) and corrugated translucent door panels. A dirt path, yellow flowers at right, and a few guests seen from behind or the side at the far right (about 85–100 %/35–60 %).
- **Mood:** practical and new, but construction-site-ish. The flat foggy light does not flatter it.
- **Light / time:** overcast, inside cloud, daytime.
- **Technical:** decent sharpness. Flat contrast, a greyish sky, and slight highlight clipping in the sky (0.98 %).
- **Faces:** not prominent (backs, distant).
- **Best use:** small card in the camp section ("new cabins with windows"), or the "what's included / where you sleep" FAQ. **Not a hero.**
- **Crops:** 4:5 focal **62/50** → `570x713+508+0` (door plus windows, excludes the film-covered window and the guests). 9:16 not recommended (401 px wide). 16:9 focal 50/50 → `1267x713+6+0` (near full frame).

### 2.7 owner/sunset_man_fuego.jpg (768×1024) [= gallery `2ed1028f`]
- **Subject:** sunset from camp. Fuego's dark cone is at left (apex about 9 %/56 %) and the sun at right (about 86 %/54 %) over a golden sea of clouds. A bare pine, log fence, wire, and yellow flowers. **A man in a red T-shirt and cap** sits at about 63 %/71–92 %. His face is visible but small and soft, with the wire crossing it.
- **Mood:** warm, triumphant, "sunset from camp without an extra hike".
- **Light / time:** sunset.
- **Technical:** strong HDR look, a very saturated sky (#4599E5 to #FEBC36), slight halos, and soft detail (768 px).
- **Faces:** one, moderately visible. It is probably the same man as in 2.8 (same red T-shirt). Who he is (guest? staff?) is UNVERIFIED.
- **Best use:** "Sunset from our camp" section, mobile card.
- **Crops:** 4:5 focal **50/55** → `768x960+0+64` (best). 9:16 focal **42/55** → `576x1024+34+0` (loses the sun). 16:9 focal **50/45** → `768x432+0+244` (no person, but Fuego is reduced to its lower flank). A 16:9 crop that keeps both Fuego's apex and the sun also keeps the man's cap at the bottom edge.

### 2.8 owner/sunset_group_three.jpg (1024×768)
- **Subject:** three men posing at the camp edge at sunset. The sun is at left (about 11 %/37 %) over a sea of clouds, with plastic chairs and a cabin corner at right. **The man at right holds a liquor bottle with a yellow label.**
- **Mood:** friends at camp, casual.
- **Light / time:** sunset.
- **Technical:** OK and sharp enough. Faces are well lit, with a strong HDR look.
- **Faces:** 3, prominent. Identity UNVERIFIED (guests or staff).
- **Best use:** **do not use** on the marketing site: alcohol, 3 recognisable faces, low resolution. It is useful only as internal evidence that sunset can be seen from camp.
- **Crops (if ever needed):** 4:5 focal 55/50 → `614x768+256+0`.

### 2.9 site/assets/images/image01.jpg (1408×1301)
- **Subject:** group photo at the **Acatenango trailhead** under the wooden "BIENVENIDOS / WELCOME – Volcán de Acatenango" sign (sign at about 66 %/37 %). About 18 people, including about 4 guides in blue "**EX.VOL.ACAT**" jerseys with an erupting-volcano print (zoom-verified). Two **COVID-19 "preventive measures"** boards are at left, with lush trailhead vegetation and gear at bottom right.
- **Mood:** cheerful start-of-hike group. However, it reads as a **big group**, which conflicts with the "2–8 per guide, small groups" message.
- **Light / time:** daytime, bright overcast.
- **Technical:** sharp, but over-sharpened and noisy (noise proxy 32.6). JPEG q75.
- **Faces:** about 18, prominent.
- **Best use:** only the **sign crop without faces** (`trailhead_sign_only.jpg`, `440x300+705+305`) for a "We are at the main entrance, La Soledad" location block. It is small, so show it at ≤ 440 px. The COVID boards suggest the photo is from 2020–2022 (inference, UNVERIFIED). Do not use the full frame.
- **Crops:** custom only (above). 16:9 focal 50/65 is not recommended.

### 2.10 site/assets/images/image05.jpg (673×884)
- **Subject:** a teal and brown trekking backpack on black volcanic sand in front of Fuego's flank (backpack about 42 %/62 %). Shallow depth of field, pines.
- **Mood:** editorial, "gear / packing list".
- **Light / time:** sunny day, backlit haze.
- **Technical:** looks professionally shot (DSLR bokeh and grading), unlike every other asset. Some highlight clipping in the sky (3.3 %). 673 px wide.
- **Faces:** none.
- **Provenance: UNVERIFIED.** The style suggests a stock or third-party photo. **Ask Alexander whether it is theirs before reuse.**
- **Best use (only if confirmed):** "Rent gear / what to bring" card.
- **Crops:** 4:5 focal 50/55 → `673x841+0+42`.

### 2.11 site/assets/images/image12.jpg (1024×768)
- **Subject:** summit sunrise. A symmetric cone (most likely Volcán de Agua, from its position under the rising sun, UNVERIFIED) sits on a sea of clouds, with the sun at about 55 %/69 % and a long blue-to-gold sky. Silhouetted hikers in the foreground hold up phones.
- **Mood:** shared moment, "worth the 4 a.m. start".
- **Light / time:** sunrise.
- **Technical:** **soft** (sharpness proxy 7.2, the lowest of the set) and low resolution. There is a small lens-flare dot in the sky at about 44 %/29 %. Colours are pleasant.
- **Faces:** none recognisable (backlit, from behind). **Privacy-safe.**
- **Best use:** "Sunrise at the summit" itinerary card or a mobile card ≤ 500 px.
- **Crops:** 4:5 focal **50/60** → `614x768+204+0`. 16:9 focal **50/62** → `1024x576+0+188`.

### 2.12 gallery01/0bd7af40_original.jpg (960×1280)
- **Subject:** the view **from inside a cabin through the open doorway to Fuego** (cone about 32 %/40 %). The walls are lined with **orange and cream striped, embossed fabric**, the floor is diamond-plate metal, and the corner of a blue sleeping bag shows at bottom left.
- **Mood:** cosy and surprising, "wake up with Fuego at your door". On-brand warmth.
- **Light / time:** clear day, sun through the fabric.
- **Technical:** good, with warm saturated fabric and good exposure (0.06 % / 0.03 % clipping). Fuego is a little hazy.
- **Faces:** none.
- **Best use:** **cabin section lead image**, "what's included: a cabin with mattress, sleeping bag, pillow" card. Its warm orange stripes echo the lava accent.
- **Crops:** 4:5 focal **40/50** → `960x1200+0+40`. 9:16 focal **35/50** → `720x1280+0+0`. 16:9 focal **40/45** → `960x540+0+306` (keeps the doorway and Fuego's apex).

### 2.13 gallery01/6c07d214_original.jpg (736×1024) [and crop `image02.jpg`]
- **Subject:** four hikers in hoodies at the summit at sunrise, partly silhouetted. A cone (likely Agua, UNVERIFIED) sits under the sun (about 44 %/46 %), with a smoke plume at the right edge. Other hikers are in the background, and **a plastic bottle lies on the ground** at about 25 %/80 %.
- **Mood:** warm, fiery, triumphant.
- **Light / time:** sunrise.
- **Technical:** heavy orange cast, a green lens-flare dot, soft, low resolution.
- **Faces:** 3–4, partly visible (lit by flash or the sun, hoods up).
- **Best use:** gallery only, after cloning out the bottle and with consent. Not a hero.
- **Crops:** 4:5 focal 50/55 → `736x920+0+103`. 9:16 focal 45/55 → `576x1024+43+0` (drops the woman at the right edge).

### 2.14 gallery01/435e7f25_original.jpg (1600×1200)
- **Subject:** a group of about 10 at the summit in the early morning, with a grey ash cone behind them (most likely Fuego, UNVERIFIED), a dramatic sky, a long cloud bank, other hikers, and a dog.
- **Mood:** group achievement.
- **Light / time:** just after sunrise.
- **Technical:** **over-processed HDR**: cyan sky, halos around the people and the cone, and smeared foreground texture.
- **Faces:** about 10, prominent.
- **Best use:** gallery only, with consent. Avoid as a hero or section background.
- **Crops:** 16:9 focal 50/62 → `1600x900+0+294`. 4:5 focal 50/60 → `960x1200+320+0`.

### 2.15 gallery01/8a98a90b_original.jpg (1600×1200)
- **Subject:** three smiling young women in winter gear at the summit at sunrise. The sun sits just right of a cone (likely Agua, UNVERIFIED) with long lens-flare rays, a crowd of other hikers at right, and a line of hikers on the ridge at left.
- **Mood:** joyful, authentic, the "best day of the trip" feeling.
- **Light / time:** sunrise.
- **Technical:** decent. The sun is clipped (2 %), and there is flare plus a green flare dot at about 24 %/63 %.
- **Faces:** 3, very prominent. Others are visible.
- **Best use:** **testimonial-adjacent** or "real travellers" strip, only with the guests' consent and never next to an invented quote.
- **Crops:** 16:9 focal **50/45** → `1600x900+0+90`. 4:5 focal **45/50** → `960x1200+240+0`.

### 2.16 gallery01/942c4bdf_original.jpg (1600×1200)
- **Subject:** a woman in a pink jacket with trekking poles (about 42 %/62 %, small in frame) walking along a black-ash ridge toward the camera. **A tricolour dog** in the foreground looks straight into the lens (about 47 %/82 %). Behind them is a steep black-sand slope with erosion grooves, scattered pines, a traversing trail, and a brownish rocky summit. **Which slope or route this is remains UNVERIFIED.** Do not caption it as a specific route (e.g. the Fuego extra hike) until Alexander confirms.
- **Mood:** adventure, scale, a little humour from the dog.
- **Light / time:** soft low sun, morning or late afternoon (UNVERIFIED).
- **Technical:** sharp, but over-sharpened and HDR-processed (noise proxy 44 is mostly texture). Good exposure.
- **Faces:** one, small. Not prominent.
- **Best use:** "The hike" or itinerary section, Fuego-hike card (if the location is confirmed), gallery.
- **Crops:** 4:5 focal **45/55** → `960x1200+240+0`. 9:16 focal **44/55** → `675x1200+366+0`. 16:9 focal **45/58** → `1600x900+0+246`.

### 2.17 gallery01/df16b529_original.jpg (1200×1114)
- **Subject:** indoors at the base. A local man in a cap and maroon fleece (probably a guide; whether he is Alexander is UNVERIFIED) stands with 5 smiling international women in hiking gear. Behind them are Solex posters reading "TOUR DE ACAMPAR" and "TOUR DE MEDIA NOCHE" (zoom-verified), patterned curtains, and a wood-effect floor.
- **Mood:** friendly, personal, "we welcome you at La Soledad".
- **Light / time:** indoor daylight.
- **Technical:** good: sharp, natural colour, slightly warm.
- **Faces:** 6, very prominent.
- **Best use:** "About us / meet your guides" or the welcome step of the itinerary, with consent. Good for trust next to *real* reviews.
- **Crops:** 4:5 focal 50/50 → `891x1114+154+0` (trims the outer two people). 16:9 focal 50/30 → `1200x675+0+0` (cuts at the knees).

### 2.18 gallery01/ec2669a1_original.jpg (1600×1200)
- **Subject:** 7 guests sitting on plastic chairs and a plank bench around a small stone campfire against an earth bank, holding cups (hot chocolate or coffee).
- **Mood:** cosy camp life, conversation, warmth.
- **Light / time:** early morning or late afternoon, cold blue light, at camp.
- **Technical:** strong purple-blue white-balance cast, HDR halos, noisy shadows. Needs colour correction (warm it by about +600 K and reduce magenta).
- **Faces:** 7, prominent.
- **Best use:** camp section "evenings / hot chocolate" card, with consent and colour correction.
- **Crops:** 4:5 focal **55/55** → `960x1200+400+0`. 16:9 focal **50/55** → `1600x900+0+210`.

### 2.19 site/logo.png (1132×1066, transparent)
- **Content:** a circular badge: light-blue disc **#ABD4EA** (outer ring the same blue), with a **transparent gap** between the ring and the disc (it shows white on a white page and dark on dark pages). The arc text "EXPEDICIÓN VOLCÁN ACATENANGO" is in a bold condensed sans. The sunburst is **#F4C06A** (rays lighter, about #F2C16D), the two black peaks are **#1E1D18 / #1F201B**, and "SOLEX" is in an italic brush-marker face with a light-blue offset shadow over "TOURS".
- **Technical:** clean raster but not vector. The canvas is off-centre (content box `940x939+74+56`). The live site hotlinks it from `i.postimg.cc`, so self-host it.
- **Best use:** header (small: the arc text becomes illegible below about 120 px, so use a simplified mark of peaks and sun for the favicon and very small sizes), footer, OG image. Do not put it over busy photos without a backing. On a dark hero, either fill the ring gap white or place it on a white disc.
- **Crop:** square-trim to 940×940 at +74+56 and redraw as SVG.

### 2.20 site/assets/images/share.jpg (1200×675), apple-touch-icon.png (228×228), favicon.png (64×64)
- share.jpg: the logo centred on white, 1200×675 (OG 1.91:1 is 1200×630). It works, but a photo OG image (lava crop plus logo) would convert better on WhatsApp and Facebook shares.
- apple-touch-icon: readable at 228 px. Fine.
- favicon 64 px: text unreadable. Make a simplified mark (sun and peaks on #ABD4EA).

### 2.21 owner/logo_screenshot.png (1179×2556)
- An iPhone screenshot of a "business info" sheet (Italian UI: "Chiudi", "Info azienda", status bar 01:00, 93 %). It is the **official logo reference** and matches logo.png exactly (samples: disc #ABD4E6, sun #F4C06B). **Do not publish the screenshot.** Use logo.png or an SVG redraw.

### 2.22 owner/cabin_interior_beds.mp4 (848×474, 10.5 s)
- Frames: `frames/cabin_01…10.jpg` (1 fps), `frames/contact_sheet.jpg`, plus all frames at 5 fps in `frames/all/`.
- **Content:** a handheld pan back and forth across a cabin floor of about 6 mattress places. Each place has a sleeping bag (teal, mint, blue, olive, grey), a striped pillow, and a rolled wool blanket (red/yellow/white plaid, grey/white and brown/white Greek-key patterns). The walls are the same red and cream fabric as 2.12, the floor is green turf, and a red floral mattress cover shows in front.
- **Mood:** colourful, clean, "everything is already up there".
- **Light:** soft daylight inside the cabin.
- **Technical:** low resolution, **shaky with motion blur** (most frames are blurry), auto-exposure shifts, and audio is essentially silent. The sharpest frame is **t ≈ 6.6 s** (`frames/best_sharp_t6.6s.png`: rolled blankets in front of the sleeping bags), followed by t ≈ 8.4 s. `frames/cabin_04.jpg` (t ≈ 3 s) is the best wide view of the whole bed row and walls.
- **Faces:** none.
- **Best use:** **not** as an autoplay background (too shaky and low-res). Use a still frame (`best_sharp_t6.6s.png` or `cabin_04.jpg`) as a card image ≤ 424 css px, optionally as the poster for a tap-to-play muted clip in the cabin section. Ask for a new 15 s **vertical**, tripod-steady clip.
- **Crops:** 4:5 from 848×474 only gives 379×474, so treat it as a thumbnail. For 16:9, use the frame as is.

---

## 3. Hero recommendations

### Mobile (portrait), in priority order
1. **`owner/fuego_eruption_night_lava_city_lights.jpg`**, 9:16 crop `1152x2048+222+0` (or 4:5 `1536x1920+0+0`). The headline and WhatsApp CTA go in the black lower third; the eruption is in the upper-middle. Already ≥ 1080 px wide, so it is native for 3× phones at 384 css px. (Preview: `05_media_hero_mobile_crops.jpg`, left.)
2. **`gallery01/3933a9bd_original.jpg`**, 9:16 `571x1016+0+0`: a warmer, golden alternative or second slide. It will look slightly soft on 3× screens. (Preview: middle.)
3. **`owner/cabin_fuego_day.jpg`**, 9:16 `900x1600+210+0`: the daytime "this is our camp" version. Text goes in the blue sky on the top 40 %. (Preview: right.)

### Desktop (landscape)
1. **Lava photo, 16:9 crop `1536x864+0+469`** (preview: `05_media_hero_desktop_crops.jpg`, top-left), with the headline on the left over the starry sky and a left-to-right navy gradient (#1E3256 → transparent). Native width is 1536 px, so cap the hero container around 1440–1536 css px or accept 2× softness. The night subject hides it well.
2. **Split layout:** headline and CTA on a twilight-navy (#1E3256) panel at left, with the portrait lava photo (or 3933a9bd) at right at native resolution. This is the sharpest option on retina.
3. **Section band (not hero):** `cabin_fuego_day` 16:9 `1200x675+0+718` (preview: bottom-left) for the "Our camp faces Fuego" section.

## 4. Section-by-section shot list

| Site section | Primary | Secondary |
|---|---|---|
| Hero | lava_city_lights | 3933a9bd (mobile slide), cabin_fuego_day (day) |
| Why our camp / Fuego straight ahead | cabin_fuego_day | cabins_path_fuego_day |
| Fuego (eruptions + optional extra hike) | 3933a9bd, red_plume | lava (if not hero), 942c4bdf (only once Alexander confirms the location) |
| Sunset from camp (no extra walk) | sunset_man_fuego (4:5) | — |
| Cabins / what's included | 0bd7af40 (doorway) | video still `best_sharp_t6.6s.png`, new_green_cabins 4:5 |
| Camp life / meals / hot chocolate | ec2669a1 (colour-corrected, consent) | — |
| Sunrise summit | image12 (no faces) | 8a98a90b (consent), 6c07d214 (cleaned, consent) |
| About us / local guides / welcome at La Soledad | df16b529 (consent) | trailhead_sign_only crop |
| Location / getting there | trailhead_sign_only | — |
| Gear rental | image05 **only if provenance is confirmed** | — |
| Reviews / testimonials | real review text only; adjacent photo 8a98a90b or df16b529 with consent | — |
| OG / WhatsApp share | lava 1.91:1 crop + logo | share.jpg (current) |

## 5. Do NOT use (or only with fixes)

- **sunset_group_three.jpg**: alcohol bottle, 3 recognisable faces, low resolution.
- **image01.jpg (full frame)**: about 18 faces, reads as a big group (against the small-group positioning), dated COVID signage. Use only `trailhead_sign_only.jpg`.
- **image05.jpg**: unknown provenance (looks like stock). Confirm with Alexander first.
- **image02.jpg, image03.jpg, 2ed1028f(_original).jpg, all non-`_original` gallery thumbnails**: duplicates or lower-quality versions. Use the owner originals or `_original` files.
- **6c07d214 / image02** as-is: plastic bottle on the ground and a heavy orange cast. Fix before any use.
- **435e7f25**: over-processed HDR halos plus about 10 faces. Gallery at most.
- **Video as autoplay background**: shaky, 848×474. Use stills.
- **logo_screenshot.png**: reference only; it contains phone UI.
- **favicon.png**: illegible. Regenerate from a simplified SVG mark.
- **Any guest photo as the hero, or any guest face next to a quote that the guest did not write.**

## 6. Privacy and consent

Faces prominent: image01 (~18), 435e7f25 (~10), ec2669a1 (7), df16b529 (6), 8a98a90b (3), sunset_group_three (3), 6c07d214/image02 (3–4, hooded), sunset_man_fuego/2ed1028f (1, soft).
No or non-recognisable faces: lava_city_lights, red_plume, 3933a9bd, cabin_fuego_day, cabins_path_fuego_day, 0bd7af40, image03, image05, image12 (backs and silhouettes), 942c4bdf (one small figure), new_green_cabins (backs), video.
The owner files carry no GPS EXIF (checked). Re-export everything with metadata stripped anyway.
Recommendation: build hero, Fuego and camp sections only from face-free images. Use people photos in one clearly labelled "Real days on Acatenango" strip after Alexander confirms consent. Staff in jerseys (image01) and the guide in df16b529 also need consent.

## 7. Palette (sampled with ImageMagick from the real files)

Sampling method: region mean and k-means top colours (`-colors n`), plus pixel masks for lava (R>170, R−G>80, R−B>80). Scripts: `/tmp/solex_research/scripts/reg.sh`, `dom.sh`. Swatches: `/tmp/solex_research/05_media_palette.png`.

| Role | Hex | Where sampled (file, region x/y/w/h %) |
|---|---|---|
| **Twilight navy** (night sky) | **#1E3256** (mean #25395D) | lava_city_lights [10,12,80,20] |
| Blue hour (mid) | #455C86 | lava_city_lights sky, 3rd cluster |
| Horizon haze at night | #6B89A4 | lava_city_lights [5,40,30,8] |
| Dusk periwinkle | #879BE9 | 3933a9bd [50,5,45,35] |
| **Day sky blue** | **#2A6DC6** (range #2A67BC to #3985E1) | cabin_fuego_day [10,5,80,35] |
| Sunset upper sky | #4599E5 | sunset_man_fuego [10,5,80,30] |
| **Lava red** (incandescent) | **#EE4C3E** (core, R>200 mask); #DF4638 all lava px | lava_city_lights, lava mask |
| **Deep ember** (lava flanks) | **#B32B1D** (also #B62D16 on 3933a9bd cone) | lava_city_lights / 3933a9bd darker-lava mask |
| **Plume orange** | **#EF6C39** (bright clusters #FB9442, #E2572B) | 3933a9bd plume mask, [8,13,28,40] |
| Plume coral (night) | #F47865 | red_plume lava/plume mask |
| **Sunset gold** | **#FEBC36** (#FCA70D sun core, #EED35D band) | sunset_man_fuego [25,55,40,4]; sunset_group_three [0,30,40,12] |
| Agua sunrise horizon | #E2A859 | image12 [5,63,90,4] |
| **Cloud white** | **#DAE7F2** (shaded cloud #9FBAD8, mean #BCCCDA) | cabin_fuego_day [30,50,25,6]; image03 #DCE9F1 |
| **Volcanic black** | **#1E1D18** (= logo peaks); night foreground #040402 | logo; lava_city_lights [30,65,40,15] |
| Ash grey (black-sand slope, day) | #5B5E5B (dark #282F2F) | 942c4bdf [20,25,30,20] |
| Fuego cone in haze | #5C6A82 | cabin_fuego_day [72,52,18,10] |
| **Forest green** | **#3C553E** (dark #122517, light #87A383) | image01 foliage [10,10,35,30] |
| Pine on Fuego flank (hazy) | #474C49 | cabin_fuego_day [45,65,25,15] |
| Guide jersey blue (brand cue) | #1C56B2 / #0B5CB8 | image01 jerseys |
| Cabin fabric ember / cream | #A14D2E, #6D1E13 / #CC9A68 | 0bd7af40 (k-means) |
| Artificial-turf green (avoid as brand colour) | #3E6236, #5C8858 | new_green_cabins |

**Relation to the logo** (logo samples: disc **#ABD4EA**, sun **#F4C06A**, peaks **#1E1D18**):
- Logo sky #ABD4EA is a desaturated, pastel version of the photographed skies. It sits between cloud white #DAE7F2 / shaded cloud #9FBAD8 and the day sky #2A6DC6. It works as a light section background and pairs well with **twilight navy #1E3256** as its dark counterpart (#ABD4EA on #1E3256 = 8.1:1).
- Logo sun #F4C06A is a muted cousin of the photographed **sunset gold #FEBC36** and the Agua horizon #E2A859. Keep #F4C06A for brand marks and use #FEBC36 for highlights (dark text on it = 10.0:1).
- Logo peaks #1E1D18 match the volcanic blacks exactly. Use them for body text and dark UI (#1E1D18 on #DAE7F2 = 13.4:1).
- **Missing from the logo, dominant in the best photos: lava red and orange.** Use it as the accent and CTA family:
  - Use #EE4C3E or #EF6C39 for icons, highlights, and large text. White on #EE4C3E is only 3.66:1, which passes for large text only.
  - Use **#B32B1D (deep ember, sampled)** for buttons with white text: 6.4:1, passes AA.
  - If the WhatsApp button must stay WhatsApp-green, avoid white on #25D366 (1.98:1). Use dark text #1E1D18 (8.5:1) or the darker #075E54 with white (7.7:1).
- Suggested token set: `--navy #1E3256`, `--sky #ABD4EA`, `--cloud #DAE7F2`, `--sun #F4C06A`, `--gold #FEBC36`, `--lava #EE4C3E`, `--ember #B32B1D`, `--ink #1E1D18`, `--ash #5B5E5B`, `--forest #3C553E`.

Contrast checks (WCAG ratio): white/#1E3256 12.76 · #F4C06A/#1E3256 7.65 · #1E1D18/#ABD4EA 10.72 · #1E1D18/#F4C06A 10.12 · white/#2A6DC6 5.12 · white/#5C6A82 5.47 · white/#B32B1D 6.40 · white/#EE4C3E 3.66 · #1E1D18/#EE4C3E 4.61.

## 8. Export spec and requests to the owner

- Export AVIF and WebP with a JPEG fallback, strip metadata, and serve `srcset` widths 480 / 768 / 1080 / 1536 (never upscale beyond source). Hero target ≤ 180 KB AVIF on mobile. Lazy-load everything below the fold. Add `alt` text in English (the current site uses "Untitled" or empty alt).
- Colour fixes: ec2669a1 (warm it, remove magenta), 6c07d214 (reduce orange cast, clone out the bottle), lava_city_lights (clone the small orange sliver at the left edge if using 16:9).
- **Ask Alexander for:**
  1. The full-resolution originals of the lava, red-plume, cabin and doorway photos, plus 3933a9bd, sent as WhatsApp "Document" or via Drive.
  2. Confirmation of who owns image05 (backpack).
  3. The location of 942c4bdf (which slope or route).
  4. Who is in sunset_man_fuego, df16b529 and image01, and whether they consent to publication.
  5. New shots: a steady **vertical** cabin-interior clip; a daytime photo of the camp with its full Fuego view in **landscape**; a portrait of Alexander and of the guides (with consent) for "About us"; a meal or hot-chocolate close-up; the luggage storage area at La Soledad.
