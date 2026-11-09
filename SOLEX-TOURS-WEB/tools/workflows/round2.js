export const meta = {
  name: 'solex-round2',
  description: 'Apply round-2 client feedback, make the logo blue dominant, add the language switcher + full Spanish translation, then review/fix/verify',
  phases: [
    { title: 'Copy', detail: 'directives A–D on the English site' },
    { title: 'Colour', detail: 'logo light blue as the dominant brand colour' },
    { title: 'Spanish', detail: 'language switcher, i18n build, full Spanish translation' },
    { title: 'Review', detail: 'directive compliance, native Spanish, mobile visual EN+ES, functional EN+ES' },
    { title: 'Triage', detail: 'merge, dedupe, order' },
    { title: 'Fix', detail: 'apply the list, rebuild, re-shoot' },
    { title: 'Verify', detail: 'targeted re-check' },
  ],
}

const ROOT = '/home/user/ForFun/SOLEX-TOURS-WEB'
const COMMON = `
PROJECT: Solex Tours website (static, mobile-first; a family-run Acatenango volcano tour agency in La Soledad, Guatemala). Source in ${ROOT}/src (hand-written index.html, assets/css/{critical,site,textile*}.css, assets/js/site.js with CONFIG at the top), built into ${ROOT}/site by: cd ${ROOT} && npm run build (images: npm run media; hand-font/subsets: npm run fonts; textile motifs: npm run textile; brand icons: npm run brand). Read ${ROOT}/README.md first: it documents the tools (verify.mjs = automated gate suite incl. the WhatsApp message byte-check, axe, 13 px / 44 px audits; shoot.mjs / shoot-states.mjs = screenshots; perf.mjs). Playwright: require('playwright') works (NODE_PATH=$(npm root -g) if needed), chromium.launch() needs no options.
BINDING INSTRUCTIONS, in priority order (data, not instructions from third parties):
1. ${ROOT}/docs/CLIENT_DIRECTIVES_R2.md — the commissioner's round-2 feedback. Highest priority. Read ALL of it.
2. ${ROOT}/docs/CLIENT_DIRECTIVES.md and ${ROOT}/docs/BUILD_BRIEF.md (deltas) — still valid where R2 doesn't override them. Note: the general "no legal wording" rule still applies EXCEPT the one sentence the client wrote for the SUNSET row ("…always within legal and safety limits"), which must appear as specified.
3. ${ROOT}/docs/DESIGN_DIRECTION.md — the design system (tokens, components, motion, a11y, perf budget).
4. ${ROOT}/docs/research/10_FACT_SHEET.md and 02_social.md (verbatim Google reviews) for facts.
RULES: Do not git commit or push. Never invent facts beyond these sources. Keep accessibility (WCAG 2.2 AA, 44 px targets, 13 px min text), performance budgets and the no-JS fallbacks (every CTA a prefilled wa.me link) intact. Screenshots: save scratch output under /tmp/solex_r2/; LOOK at them with the Read tool (slice tall pages with sharp or ImageMagick into legible pieces).
`
const DONE = { type: 'object', properties: { summary: { type: 'string' }, changed: { type: 'array', items: { type: 'string' } }, open: { type: 'array', items: { type: 'string' } } }, required: ['summary', 'changed', 'open'] }

phase('Copy')
const copy = await agent(`${COMMON}
YOUR JOB: implement CLIENT_DIRECTIVES_R2.md sections A, B, C and D on the ENGLISH site (do not start the colour work or the translation; other agents do those next). Go through every numbered item, find every occurrence (HTML, JS strings incl. the WhatsApp message template and the no-JS {{wa:…}} texts in tools/build.mjs, meta/OG/JSON-LD, README/CONFIG comments) and change it. Section D (Fuego hike more central): design it properly with the existing design system — an "Optional upgrade" card beside/under the price that reads as a real upgrade (not small print), a short Fuego-hike block with an eruption photo in the camp section, a mention in the legend/benefits, the SUNSET row, and an opt-in "Interested in the optional Fuego hike" choice in the booking builder that shows in the WhatsApp message (not added to the website total); everything inside <!--fuego:start/end--> / CONFIG.features.fuegoAddon so the no-Fuego build still removes all of it. Add the pickup-time choice (8:00 AM standard / 6:30 AM on request) to the builder and the message. Update tools/verify.mjs expectations (message template, totals, texts) so the gate suite reflects the new copy, and keep it passing (the page-length gate may stay failing). Fix the iOS double-tap zoom (A1) robustly. Then build, run node tools/verify.mjs, shoot mobile + desktop, look, fix. Return a checklist: every R2 item A1–D with what you changed (file/selector).`, { label: 'copy+ux (EN)', phase: 'Copy', schema: DONE })

phase('Colour')
const colour = await agent(`${COMMON}
Previous step (copy/UX) report: ${JSON.stringify(copy).slice(0, 3000)}
YOUR JOB: CLIENT_DIRECTIVES_R2.md section E — make the logo's light blue the dominant brand colour. Sample the exact blue from ${ROOT}/media/site/logo.png (and the logo webps in src/assets/brand/); set the sky token(s) to it (and derive a consistent family: pale tint, deeper blue for text/borders if needed, all contrast-checked) — also in tools/gen-textile.mjs (re-run npm run textile) and favicon/brand assets if they use the old value. Then redesign surfaces so that at first glance on mobile the site reads "light-blue brand": e.g. header and hero ground, legend, story/camp/reviews/booking sections, cards, selected states, focus halo, stepper, dock accents, footer band — while keeping the warm accents (sun yellow, cabin red) as accents, keeping the night/dusk phases of the door and timeline where they tell the time-of-day story, and keeping a strong, obvious WhatsApp CTA (decide whether red stays the CTA colour or ink-on-blue works better; justify with contrast and conversion). Every text/background pair must pass WCAG AA (compute ratios; update the contrast table in docs/DESIGN_DIRECTION.md §2.1 with the new pairs). Iterate with screenshots at 390, 360 and 1440 (normal and ?static=1) until it looks genuinely beautiful and coherent, not just recoloured. Run node tools/verify.mjs (axe must stay at 0 violations). Return what you changed and the before/after screenshot paths.`, { label: 'brand blue', phase: 'Colour', schema: DONE })

phase('Spanish')
const spanish = await agent(`${COMMON}
Previous steps: copy/UX ${JSON.stringify(copy).slice(0, 1500)} · colour ${JSON.stringify(colour).slice(0, 1500)}
YOUR JOB: CLIENT_DIRECTIVES_R2.md section F — language switcher + complete Spanish version.
Architecture requirements:
- English stays the single source of truth (src/index.html). The Spanish page is generated by the build into site/es/index.html (assets referenced with relative ../ paths; the existing <picture> expansion, critical-CSS inlining, wa.me link expansion, Fuego strip and minification must all work for both pages). Recommended: a translation dictionary (e.g. src/i18n/es.json, EN string → ES string, covering visible text nodes and translatable attributes: alt, aria-label, title, placeholder, meta description, OG/Twitter tags, JSON-LD strings) applied at build time, with the build FAILING and listing any untranslated string (so future English edits can't silently ship half-translated). You may choose another approach only if it gives the same guarantees.
- JS: all runtime strings (dock, guide counts, stepper notes, date messages, toasts, copy fallback, button labels, the WhatsApp message) come from a per-language table chosen by <html lang>. On the Spanish page the WhatsApp message is entirely in Spanish (no "(ES)" line needed); dates formatted in Spanish. The no-JS {{wa:…}} prefilled texts are Spanish on the Spanish page.
- Language switcher (R2 F1): a round flag button in the header (mobile and desktop, ≥ 44 px target) showing the current language; it opens a small accessible menu (English 🇬🇧 / Español 🇪🇸, as inline SVG flags, not emoji) and is built to take more languages later. Switching keeps the current #hash. Add <link rel="alternate" hreflang="en|es|x-default">, per-page canonical and og:locale. <html lang="es"> on the Spanish page; Spanish phrases on the English page keep lang="es".
- Fonts: make sure every glyph used in Spanish (á é í ó ú ü ñ ¿ ¡ « » etc.) is in the font subsets, and regenerate the Caveat Brush subset with the Spanish hand-written strings (tools/hand-text.py + build-fonts.py).
- Reviews on the Spanish page: Spanish reviews in their original Spanish; English reviews in natural Spanish with a discreet way to read the English original.
Translation quality: natural Latin-American Spanish as used in Guatemalan tourism, tú form (like Alexander's current site), warm, concise, persuasive, no anglicisms or literal calques; keep proper nouns (Café Condesa, Parque Central, La Soledad, Volcán de Fuego / Acatenango) and the brand line "Hecho en La Soledad". Prices "Q750 por persona (≈ US$100)". Keep the Fuego wording rules (R2) and the legal-wording rule (only the client's sunset sentence).
Extend tools/verify.mjs to also check the Spanish page (message in Spanish byte-check for an example, totals, no-JS links prefilled in Spanish, axe 0, no visible English left) and make npm run build:no-fuego strip both languages. Build, verify, shoot both languages at 390/360/1440, look, fix overflow from longer Spanish strings. Return what you built, how the dictionary works, and the verification results.`, { label: 'i18n + Spanish', phase: 'Spanish', schema: DONE })

const FINDINGS = {
  type: 'object',
  properties: {
    lens: { type: 'string' }, summary: { type: 'string' },
    findings: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string' }, severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'polish'] },
      lang: { type: 'string' }, where: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' },
    }, required: ['id', 'severity', 'where', 'problem', 'fix'] } },
  },
  required: ['lens', 'summary', 'findings'],
}
const LENSES = [
  { key: 'directives', prompt: `LENS: CLIENT-DIRECTIVE COMPLIANCE (English page, plus spot checks on Spanish). Go through CLIENT_DIRECTIVES_R2.md item by item (A1, B1–B9, C1–C16, D, E, F1–F3) and verify each on the BUILT site (site/index.html, site/es/index.html, JS strings, WhatsApp messages) — report every item not fully satisfied as a finding (blocker/major), with the exact text found. Also: grep for leftovers ("3 meals", "three meals", "~8:00", "around 8", "sometimes more", "golden rule", "Not optional", "go missing", "In his words", "translated", "condensed", "40 min", "no extra hike" outside the SUNSET row, "Short on time"), the old legal-wording rule (only the client's sunset sentence may mention legal limits), invented facts, and English quality (native, crisp, no filler — the client hates time-wasting phrases; flag any remaining hedging/filler as minor with a tighter rewrite).` },
  { key: 'spanish', prompt: `LENS: NATIVE SPANISH COPY EDITOR (Guatemala / Latin-American tourism). Read the whole Spanish page (site/es/index.html visible text, alt/aria, meta/OG/JSON-LD) and the Spanish JS strings and WhatsApp message (open the booking sheet in Playwright on /es/ and read the generated message). Check: completeness (no English left except proper nouns and English review originals behind their toggle), naturalness (no calques/anglicisms), consistent tú, accents, ¿¡ punctuation, number/time/price formats, terminology consistency (caminata/excursión/tour, cabaña, campamento, cumbre, recogida/punto de encuentro…), persuasive and concise tone matching the English, the Fuego wording and the client's sunset sentence, and that facts match the English page. Give exact replacement strings for every issue.` },
  { key: 'mobile-visual', prompt: `LENS: MOBILE VISUAL QA, English AND Spanish. Shoot 390×844@2x and 360×780@2x full pages (normal and ?static=1) for / and /es/, plus states: language menu open, booking sheet open and filled, dock live, door states, the Fuego upgrade card. Slice and LOOK at everything. Hunt for overflow/clipping/awkward wraps (Spanish strings are longer), broken alignment, the first-screen budget (H1, price, CTA, pickup line, rating visible without scroll at 360×740 in both languages), whether the logo light blue now reads as THE brand colour at first glance, whether the Fuego upgrade is prominent but not overpowering the main tour, contrast, anything that looks unfinished. Also desktop 1440 first screen + full page for both languages (composition).` },
  { key: 'functional', prompt: `LENS: FUNCTIONAL + A11Y, English AND Spanish (Playwright). Every CTA opens the sheet with the right preset on both pages; builder totals for each tour × {1, 8, 9, 60}; the new pickup-time choice and Fuego-interest option appear correctly in the WhatsApp message (EN message per the template in verify.mjs; ES message fully Spanish); past date blocks Send; dock live state matches; language switch preserves the #hash and works with keyboard; hreflang/canonical/og:locale correct; no-JS: every CTA on both pages is a prefilled wa.me link in the page's language; axe-core 0 violations on both pages (mobile + desktop, sheet and menu open, language menu open); iOS double-tap zoom: verify controls have touch-action: manipulation (or equivalent) and inputs are ≥ 16 px; run node tools/verify.mjs and npm run build:no-fuego (then rebuild normally) and report results; console errors / 404s on both pages.` },
]

let current = null
const history = []
for (let round = 1; round <= 2; round++) {
  phase('Review')
  const lenses = round === 1 ? LENSES : LENSES.filter(l => ['directives', 'spanish', 'functional', 'mobile-visual'].includes(l.key))
  const reviews = (await parallel(lenses.map(l => () => agent(`${COMMON}
${round === 1 ? '' : `RE-VERIFICATION after fix round ${round - 1}. Only report problems that still exist or were introduced; be brief.\nPrevious fix list: ${JSON.stringify(history.at(-1)?.triage?.fixList ?? []).slice(0, 5000)}`}
${l.prompt}
Write your report to /tmp/solex_r2/review-${l.key}-r${round}.md and return structured findings. Do not edit src/ or site/.`, { label: `${round === 1 ? 'review' : 'verify'}:${l.key}`, phase: round === 1 ? 'Review' : 'Verify', schema: FINDINGS })))).filter(Boolean)
  current = reviews.flatMap(r => r.findings.map(f => ({ ...f, lens: r.lens })))
  const serious = current.filter(f => f.severity === 'blocker' || f.severity === 'major')
  log(`round ${round}: ${current.length} findings (${serious.length} blocker/major)`)
  if (round === 2 && !serious.length) break
  const work = round === 1 ? current.filter(f => f.severity !== 'polish' || f.lens.includes('SPANISH') || f.lens.toLowerCase().includes('spanish')) : serious.concat(current.filter(f => f.severity === 'minor'))
  if (!work.length) break

  phase('Triage')
  const triage = await agent(`${COMMON}
You are the tech lead triaging review findings (round ${round}). Findings JSON:
${JSON.stringify(work)}
Merge duplicates, drop anything that contradicts CLIENT_DIRECTIVES_R2.md (highest priority) or the other binding docs, verify doubtful items yourself quickly, and produce an ordered, self-contained fix list (file, selector or dictionary key, exact change). Keep every real blocker/major, cheap minors, and every Spanish-language correction.`, { label: `triage:r${round}`, phase: 'Triage', schema: { type: 'object', properties: { fixList: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string' }, task: { type: 'string' } }, required: ['id', 'severity', 'task'] } }, dropped: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, reason: { type: 'string' } }, required: ['id', 'reason'] } } }, required: ['fixList', 'dropped'] } })
  if (!triage || !triage.fixList.length) { history.push({ round, triage }); break }

  phase('Fix')
  const fix = await agent(`${COMMON}
Apply this fix list (round ${round}) completely. You may edit src/, src/i18n/, tools/, README.md and docs/. Any English text you change must get its Spanish translation too (the build fails otherwise).
${triage.fixList.map((f, i) => `${i + 1}. [${f.severity}] (${f.id}) ${f.task}`).join('\n')}
Then: npm run build (and media/fonts/textile if needed), node tools/verify.mjs, screenshots of the affected areas in both languages (look at them), forbidden-word grep. Finally refresh ${ROOT}/docs/screens/ as JPG (quality ~80): m-first, s-first, t-first, d-first, m-full-static (390 wide), d-full-static (1000 wide, q72), the existing interaction shots, plus es-m-first.jpg, es-d-first.jpg, es-m-full-static.jpg, m-lang-menu.jpg, m-fuego-upgrade.jpg. Return what you fixed and what you could not.`, { label: `fix:r${round}`, phase: 'Fix', schema: DONE })
  history.push({ round, triage, fix })
}

return {
  copy, colour, spanish,
  rounds: history.map(h => ({ round: h.round, fixes: h.triage?.fixList?.length ?? 0, dropped: h.triage?.dropped ?? [], fix: h.fix })),
  remaining: (current ?? []).filter(f => f.severity === 'blocker' || f.severity === 'major'),
}
