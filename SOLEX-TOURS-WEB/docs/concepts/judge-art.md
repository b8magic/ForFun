# Judge: Art Direction and Brand

**Lens:** creative director (Awwwards/FWA juror). I judged originality and memorability, fit with the Solex logo and the real photography, whether it feels like a local Guatemalan family business, typography, colour, composition, the quality of the motion idea, and "wow" without gimmick.

**What I reviewed:** every required screenshot (m-first, m-full, d-first, d-full for each concept, plus C's m-pass, m-dock and m-seatL). I sliced the full-page captures into readable strips so I could inspect them at native scale. I also looked at the interaction states (A m-dock/m-sheet, B m-view-sunset/m-sight/m-sheet-preview, D extra/m-camp, d-route, d-camp, m-sheet). I read each concept.md, skimmed each prototype's HTML/CSS/JS, checked contrast numerically, and took my own 360 px headless-Chrome captures of A and B (`/tmp/judge_art_slices/A_360.png`, `B_360.png`).

The brief's own facts and the client directives (`/tmp/solex_raw/CLIENT_DIRECTIVES.md`) were the yardstick for brand truth.

---

## Scores

| Concept | Score | One-line verdict |
|---|---|---|
| **A · Front Row to Fuego (24-hour film)** | **8.3** | The most original structure and the best treatment of the real photos. The time-of-day colour journey makes phone snapshots look intentional. It is weakest on local authenticity and logo DNA, and it breaks at 360 px. |
| B · Hecho en La Soledad | 7.8 | The most authentic and the most logo-coherent, with a genuinely ownable textile system taken from the cabin blankets. It is charming rather than spectacular, and the desktop layout is under-composed. |
| D · Contour | 7.4 | Rigorous Swiss information design, and the altimeter is a real signature. But the topo/expedition look is an outdoor-brand cliché, it is cool and technical rather than family-warm, and the crosshair-on-crater reads as a gun sight. |
| C · Summit Pass | 7.1 | The loudest and most instantly memorable, and its desktop hero ticket is a great poster. But the ticket and neo-brutalist trope is generic, every headline shouts, the "Big Antigua tour vs Solex" tone is combative, and one headline fails contrast. |

**Winner for this lens: A, Front Row to Fuego.**

---

## A · Front Row to Fuego: 8.3

**Strengths**
- **The structure is the idea.** The site is literally the 24 hours of the product, so the cold open at 21:40 followed by the "◀◀ Earlier that day…" rewind is a motivated device and not decoration. The giant serif timecodes (08:00, 10:00, 14:00, 17:45, 21:00, 04:30, 06:00) are a memorable typographic motif that also serves as the itinerary.
- **Best art direction of the real photography.** The background drifts from paper (morning) to sky (midday) to the logo blue (camp) to a gold-to-umber gradient (17:45) to night to a lavender-peach dawn. Each photo sits on a field sampled from its own light, so mediocre phone photos read as intentional. The 2.39:1 cinemascope letterbox for the lava-and-city-lights frame on desktop is the single most beautiful moment in all four concepts. The dawn triptych and the sprocket film strip of the cabins also work.
- **Colour system.** The phase tokens re-tint the fixed UI (header, day bar, dock hairline) as the story moves. The coral lava CTA (#FF7F60, sampled from the plume) is the warmest pixel on every screen, and it is accessible (7.5:1 on night, ink on lava 7.7:1).
- **Typography.** Instrument Serif (with an emotional italic half-line) plus Figtree plus JetBrains Mono slates give a clear three-voice system. The "Starring Volcán de Fuego, weather permitting / Cast size 2 to 8 hikers per guide" credits block is witty and also honest.
- **Motion with meaning.** The live HUD clock (which runs, rewinds and holds), the day-bar dot, the focus-pull reveals, the hero dolly, a lava glow pinned to the photographed crater, and the ticket that "prints" then tears off. Reduced-motion fallbacks are specified for all of them.
- **Explainers.** The theatre seat map ("Front row / Side seat") turns the right-side-camp claim into a 3-second read. "Straight talk" on the guides' language is a designed honesty object.

**Weaknesses**
- **Local authenticity is the weak flank.** Hollywood film grammar is an imported frame. The visual voice (light condensed serif and mono on near-black) reads as a boutique lodge or film festival, not a family at the La Soledad trailhead. There is no face of Alexander and no community message. The logo appears only as a small header and footer roundel: the brush "SOLEX", the twin peaks and the rayed sun do not feed the system beyond the #ABD4E9 and #F1C16F tokens.
- **Instrument Serif is the 2024–26 Awwwards default.** It is elegant but not ownable, and the light-weight Q750 is less punchy than in C or D.
- **The concept runs out of film after "Fin."** The box office, other showtimes, wardrobe, reviews and FAQ fall back to generic cream cards with long empty gaps, especially on desktop.
- **Pun overload for ESL travellers.** "Cold open", "Wardrobe department", "From the audience", "Post-credits scene", "Scene selection", "Filmed on location". A few are delightful; all of them together get gimmicky.
- **Breaks at 360 px** (my capture). "LA SOLEDAD · ACATENANGO" collides with the "Day 1 21:40" HUD pill, and the hero "Book your seat" button overflows the right edge.
- **Performance and honesty.** `filter: blur(6px)` is animated on every reveal block and the header uses backdrop-filter, which is expensive on mid-range Android. The FAQ says "Access to Fuego depends on rules set by Guatemala's authorities", which contradicts the client directive.

## B · Hecho en La Soledad: 7.8

**Strengths**
- **The most ownable brand system of the four.** Pixel-stitch bands are taken from real material: a fret from the blankets in the cabin video, a rombo chain, a selvedge stripe, and the **logo's twin peaks and sun re-woven as 1-px stairs**. The **cabin's red-and-cream curtain walls rebuilt as the frame of the view switcher** (Afternoon / Sunset / After dark) is the best photo-framing idea in the round.
- **The logo as a sewn patch.** The "WHAT WE TELL YOU IS WHAT WE GIVE YOU · SOLEX · LA SOLEDAD" stamp, with the peaks, turns Alexander's sentence into an object.
- **The loom.** Sixty ghosted stitch figures (his old groups) against 8 hikers and one red guide is the most memorable infographic in the competition. The second guide appearing at 9 in the booking stepper is a lovely echo.
- **Authenticity and voice.** "¡Hola! I'm Alexander" taped note, a lined-paper letter "translated from his voice notes", the "What we won't promise" card, "Gracias for supporting community guides". It reads like a family at a front door.
- **Palette.** Cream "manta", cabin-stripe red, blanket teal and pink, mauve fret ground, plus logo sky and sun. It is rich but disciplined. It is robust at 360 px.

**Weaknesses**
- **Charm over spectacle.** The hero crops the strongest photo into an arch, and the logo appears twice on the first screen (header and patch). The client asked for "maximum creative fantasy", and B is the most restrained.
- **Scrapbook tropes** (Caveat handwriting, tape, stamp, lined paper) border on craft-brand cliché, and Caveat has no relation to the logo's marker lettering.
- **Desktop is under-composed.** The woven-label ribbon floats at about 560 px on a 1440 canvas, most sections are mid-size cards with small type, and photos are small "prints". The night sightline diagram is a generic icon schematic.
- The Fuego FAQ also mentions "the authorities", against the directive.

## D · Contour: 7.4

**Strengths**
- **Information design.** An elevation-profile spine, waypoints (WP01–WP06) and the **altimeter dock and desktop rail**, driven by the same function that draws the profile, so the number, the marker and the chapter always agree. The 3,976 m summit band in sun-yellow and the sticky instrument panel on desktop (profile plus a cross-fading photo per waypoint) are beautifully made.
- **First screen.** The best "everything answered" hero: claim, plate photo with "FUEGO 3,763 m" label, price, inclusions, full-width CTA and both cafés.
- **Copy and directives.** The cleanest "Small, local, family-run… the money stays in La Soledad" section. The Fuego add-on is worded as Alexander offers it with no legal talk, behind a one-line flag.

**Weaknesses**
- **Topo lines plus mono labels plus a condensed grotesque** is the standard outdoor-brand look (Patagonia, Arc'teryx, trail-race sites). It is not specific to Solex or Guatemala, and it is clinical where the brand should be warm.
- **The crosshair reticle on an erupting volcano** evokes a targeting HUD.
- The camp chapter, the key differentiator, is boxed into a narrow column on desktop.
- On mobile, the sticky route strip plus the dock take roughly 25% of the viewport.
- The low-resolution cabin video is blown up to full width, which exposes its blur.

## C · Summit Pass: 7.1

**Strengths**
- **Maximum punch.** The logo-sky page, the die-cut admission ticket hero with the "MAX 8 PER GUIDE" stamp straddling the perforation, and "FRONT ROW TO FUEGO." in condensed black caps make the desktop hero the best poster of the four. Using the sunrise eruption as the hero gives a colour story none of the others have.
- **The pass as an artefact.** A live pass with a **skyline barcode drawn from the logo's peaks**, a split-flap total, a READY TO SEND stamp and a tear-off. The ticket-stub dock rewrites itself into "SUN 8 NOV · 3 PPL · Q2,250 · Send pass", which is the best dock idea of the four. Caveat Brush for Alexander's quote nods to the marker "SOLEX". The Seat L / Seat R viewfinder illustration is well drawn.

**Weaknesses**
- **Admission tickets, hard offset shadows and condensed caps** are a widespread 2022–25 neo-brutalist trope (festival and event sites). Here it reads like a Berlin festival, not a La Soledad family.
- **Monotone loudness.** Every H2 is set at maximum volume, so nothing is emphasised. The colour-block sequence (sky, night, paper, lavender, ember, sky, paper, ink, sun, paper) feels like a patchwork.
- **Combative tone.** "BIG ANTIGUA TOUR vs SOLEX … Big promises, different reality" is off-voice for a humble, good-hearted local operator. The pass number "SLX-OVN-0811-03" is faux-corporate.
- **Accessibility.** Paper text on the dawn lavender ("Everything up the mountain.") measures **2.28:1**, which fails even the 3:1 large-text threshold, despite the doc claiming every pair is AA. The hero sunrise photo looks over-processed at desktop size.

---

## Winner: A, Front Row to Fuego

A is the only concept whose structure, colour, type and motion all come from one idea that is also the product: the 24 hours, and the seat facing Fuego. It does the most for Solex's real (amateur) photography, and it has the most "wow" while staying conversion-led: price and CTA sit on the first screen, the dock is always present, and the ticket builder writes the WhatsApp message.

Its gap is exactly B's strength: being a real family at a real trailhead. The grafts below close that gap.

### Grafts from the other concepts (concrete)

1. **From B, the cabin-door frame.** Use B's red/cream curtain-wall frame as the window for A's camp scenes. Show the same doorway view at 14:00 (afternoon), 17:45 (sunset) and 21:00 (after dark), so "one view, three shows" becomes A's clock made visible: the frame stays and the light changes as you scroll.
2. **From B, the textile layer as A's "film stock".** Use the fret, rombo and logo-peaks stitch bands as scene dividers, the ticket's edge and the sprocket rail of the cabin film strip. Make the cabin scene ("Your bed is already up here") a blanket-coloured moment (textile red #A14D2E is already in A's tokens). This gives A Guatemalan texture without abandoning the film.
3. **From B, the loom.** In A's 10:00 "Your pace. Not the crowd's." scene, replace the three stat boxes with sixty ghost figures against 8 plus one guide. Echo it in the hikers stepper: a second guide appears at 9.
4. **From B, the stamp and the "What we won't promise" card.** Use them at the box office ("WHAT WE TELL YOU IS WHAT WE GIVE YOU · SOLEX · LA SOLEDAD", pressed onto the ticket) and in the credits, plus a first-person "¡Hola! I'm Alexander" note at 09:00 "Alexander opens his door".
5. **From C, the self-rewriting dock.** Once the builder has a date, A's ticket-stub dock should show the live booking ("Sun 8 Nov · 3 hikers · Q2,250 · Send"). Add C's **skyline barcode drawn from the logo's peaks** to A's ticket, and use a **brush face (Caveat Brush or a traced "SOLEX") for Alexander's quotes and signature only**, so the logo's marker hand finally appears.
6. **From D, the altimeter in A's HUD.** Make it "Day 1 · 14:00 · ≈3,600 m". Turn the 2 px day bar into a tiny route elevation silhouette, so clock and altitude together are the itinerary.
7. **From D and C, the community line, in A's credits voice.** "Crew: guides, porters and cooks from La Soledad. Your ticket money stays on the mountain." (Wording to be confirmed by Alexander.) Also take D's directive-compliant Fuego add-on line behind a feature flag.
8. **From C and D, bilingual labels in the WhatsApp message** (Date *(fecha)*, People *(personas)*), or B's one-line Spanish summary, so Alexander reads it at a glance.

### Must-fix in A

1. **360 px layout bugs** (verified in a headless capture). The header subtitle collides with the HUD pill, and the hero "Book your seat" button overflows the viewport edge. Drop the subtitle or the pill text under about 380 px, and wrap or stack the price and CTA row.
2. **Fuego FAQ breaks the client directive.** Remove "rules set by Guatemala's authorities… what's allowed right now". Present it exactly as Alexander offers it: optional, about 4 h from camp and back, +Q300 per person, decided and paid at camp if you feel fit and the weather is right, nothing prepaid. Keep it small (one FAQ plus one "optional" line) and behind a removable flag.
3. **No community or family message**, which is a core client directive. Add it (graft 7) and put a face to the name: a portrait of Alexander at his door for 09:00. Commission one if needed and use a clearly marked placeholder until then.
4. **Bring the logo into the system.** Use the brush "SOLEX", the peaks and the rayed sun: the day-bar dot as the logo sun, the peaks in the barcode or stitch band, and the brush voice for Alexander. Right now the brand lives only in two hex tokens and a small roundel.
5. **The second half abandons the film.** Box office, showtimes, wardrobe, reviews and FAQ are generic cream cards with large dead gaps (desktop especially). Keep the time-of-day palette running to night for the credits, give the box office a real "ticket window" composition, and tighten the vertical rhythm.
6. **Cut the pun load.** Keep 3–4 film moments (cold open, credits, post-credits, ticket). Use plain-English section labels and navigation for international and ESL readers ("Rent gear", "Reviews", "Questions"), and drop "Scene selection" and "Wardrobe department" as primary labels.
7. **Motion cost on mid-range phones.** Animate only opacity and transform (no `filter: blur()`) in reveals on mobile, and limit backdrop-filter to the header. Keep the cabin video small, since it is a low-resolution 848×474 source, and use its sharpest frame as the poster.
8. **Honesty flags in the visuals.** "21:40" and the other scene times are illustrative, so label the cold open "approx." as well. Qualify "eruptions… from your cabin door" with "on clear nights" in the mobile hero (the desktop-only caption is not enough). Confirm the hero photo was shot from the Solex camp, and resolve the 8:00 vs 6:30 pickup conflict.
9. **Seat map semantics.** "The front row has exactly 8 seats" conflates camp position with group size. Keep the 8 seats as a group-size wink, but caption it so it doesn't read as camp capacity.
