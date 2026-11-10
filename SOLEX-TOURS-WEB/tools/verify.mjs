// Acceptance checks for site/ in headless Chromium (Playwright + axe-core).
//
//   node tools/verify.mjs [--shots=dir]
//
// 1. Booking flow: hero CTA opens the sheet, the form is filled like the §6.3 example (updated for the
//    round-2 client directives: pickup time, Panajachel add-on, opt-in Fuego hike), and the decoded
//    Send href must equal the expected message byte for byte. The example date is ~6 weeks ahead.
// 2. Dock live state, past-date blocking, the "today" note, totals for every tour × {1, 8, 9, 60};
//    the Fuego-hike interest is in the message but never in the total; overnight-only fields.
// 3. No-JS: every wa.me link carries prefilled text; the hero href equals the spec.
// 4. axe-core (WCAG 2.2 AA tags) on mobile + desktop, motion and static; console errors / 4xx.
// 5. Position budget at 390×844, text < 13 px, targets < 44 px, page length.
// 6. iOS double-tap zoom (R2-A1): touch-action: manipulation on every control (also inside the sheet's
//    scroll container), inputs ≥ 16 px, pinch-zoom not disabled in the viewport meta.
// 7. Spanish page (R2-F, site/es/): the same booking example must give the Spanish message byte for byte
//    (no "(ES)" line), Spanish dock / notes / errors / totals, no-JS links prefilled in Spanish, axe, 13 px /
//    44 px audits, no English left (text, alt, aria-label, meta, no-JS texts), the language switcher
//    (≥ 44 px, keeps the #hash or the section in view), hreflang / canonical / og:locale, glyph coverage of the
//    font subsets for every character on both pages, no horizontal overflow at 320 / 360 / 390.
// 8. Round-2 review fixes: the switcher keeps the section on phones in both directions (hidden sections such as
//    #prepare never win) and keeps the place for keyboard users; whole-document axe with the menu, the sheet
//    and the language list open; the menu CTA never covers a link; the English head (canonical, hreflang,
//    og:locale); English-only no-JS texts; every preset button (tour, Fuego box, rentals) and the default
//    pickup-time line; no dead controls without JS.
// 9. Round-2 final review: no "(ES)" line in the English message; the language list closes on Tab-out and its tick
//    is not in the link names; manifest "lang" and JSON-LD WebPage.inLanguage; menu scroll shadows, focus ring kept
//    inside the scrolling list, padded rows; the phone upgrade card's "How it works"; header / booking CTA at 360–430;
//    in the no-Fuego build, the SUNSET row without its "No extra hike needed" lead.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { execFileSync } = await import('node:child_process');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const shotsDir = (process.argv.find((a) => a.startsWith('--shots=')) ?? '').slice(8) || null;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(SITE, path.normalize(p));
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await playwright.chromium.launch();
const results = [];
const ok = (name, pass, detail = '') => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const errors = [];
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`[${tag}] pageerror ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${tag}] console ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`[${tag}] ${r.status()} ${r.url()}`));
  page.on('requestfailed', (r) => !/\.(mp4|webm)$/.test(r.url()) && errors.push(`[${tag}] failed ${r.url()} ${r.failure()?.errorText}`));
};
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1440, height: 900 } };

// Example date: today in Guatemala + 42 days (always valid: in the future, within 18 months).
const GT_TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const EX = new Date(Date.parse(GT_TODAY + 'T00:00:00Z') + 42 * 864e5);
const EX_ISO = EX.toISOString().slice(0, 10);
const EX_EN = `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][EX.getUTCDay()]} ${EX.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][EX.getUTCMonth()]}`;
// The site may be built with or without the optional Fuego hike (node tools/build.mjs --no-fuego-hike):
// detected from the HTML, so the same suite gates both builds.
const HAS_FUEGO = (await readFile(path.join(SITE, 'index.html'), 'utf8')).includes('id="f-fuego"');
const EXPECTED = `Hi Alexander! I found Solex Tours on your website and I'd like to book.

Tour: Acatenango Overnight Hike (2 days / 1 night)
Date: ${EX_EN} ${EX.getUTCFullYear()}
People: 3
Pickup: Café Condesa, Parque Central (Antigua)
Pickup time: 6:30 AM (on request)
After the tour: on toward Panajachel / Lake Atitlán (add-on on request)
${HAS_FUEGO ? "Optional Fuego hike: I'm interested (+Q300 per person, paid at camp)\n" : ''}Extras: porter up (13 kg), rent: headlamp
Name: Maria

Website price: Q750 per person = Q2,250 total (≈ US$300).
Is there space? Could you confirm the exact pickup time and place? Thank you!`; // R2 (client): no "(ES)" summary line
// The Spanish page writes the whole message in Spanish (site.js TXT/LANG).
const EX_ES_LONG = `${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][EX.getUTCDay()]} ${EX.getUTCDate()} de ${['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][EX.getUTCMonth()]} de ${EX.getUTCFullYear()}`;
const EX_ES_SHORT = `${['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][EX.getUTCDay()]} ${EX.getUTCDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][EX.getUTCMonth()]}`;
const EXPECTED_ES = `¡Hola, Alexander! Encontré Solex Tours en tu página web y quiero reservar.

Tour: Caminata de 2 días al Acatenango (1 noche en cabaña)
Fecha: ${EX_ES_LONG}
Personas: 3
Recogida: Café Condesa, Parque Central (Antigua)
Hora de recogida: 6:30 a. m. (a solicitud)
Después del tour: seguir hacia Panajachel / Lago de Atitlán (extra a solicitud)
${HAS_FUEGO ? 'Caminata opcional al Fuego: me interesa (+Q300 por persona, se paga en el campamento)\n' : ''}Extras: porteador de subida (13 kg), alquiler de linterna
Nombre: Maria

Precio en la web: Q750 por persona = Q2,250 en total (≈ US$300).
¿Hay espacio? ¿Me confirmas la hora y el lugar exactos de recogida? ¡Gracias!`;
// No-JS prefilled texts (tools/build.mjs {{wa:…}}), encoded like the build (encodeURIComponent + !'()*).
const enc = (t) => encodeURIComponent(t).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const NOJS_OVERNIGHT = "Hi Alexander! I'd like to check a date for the Acatenango Overnight Hike (2 days / 1 night, Q750 per person).\nDate: \nPeople: \nPickup: Café Condesa or Café La Parada\nPickup time: 8:00 AM (or 6:30 AM on request)";
const HERO_HREF = 'https://wa.me/50248347003?text=' + enc(NOJS_OVERNIGHT);
const FUEGO_HREF = 'https://wa.me/50248347003?text=' + enc(NOJS_OVERNIGHT + "\nOptional Fuego hike: I'm interested (+Q300 per person, paid at camp)");
const NOJS_OVERNIGHT_ES = '¡Hola, Alexander! Quiero consultar una fecha para la caminata de 2 días al Acatenango (1 noche en cabaña, Q750 por persona).\nFecha: \nPersonas: \nRecogida: Café Condesa o Café La Parada\nHora de recogida: 8:00 a. m. (o 6:30 a. m., a solicitud)';
const HERO_HREF_ES = 'https://wa.me/50248347003?text=' + enc(NOJS_OVERNIGHT_ES);
const FUEGO_HREF_ES = 'https://wa.me/50248347003?text=' + enc(NOJS_OVERNIGHT_ES + '\nCaminata opcional al Fuego: me interesa (+Q300 por persona, se paga en el campamento)');
// "No English left" on the Spanish page: words that are English and never Spanish (names, brands and
// Spanish homographs such as "real", "total", "original", "no" are deliberately not listed).
const EN_ONLY = new Set(('the and with you your our we for from of is are at it its this that what how to in on by will can all have has get more about ' +
  'day days night nights hike hikes hiking people person guide guides cabin cabins camp book booking check date sunset sunrise morning afternoon pickup ' +
  'included price per rent rental send message before after note here there when where who why not only up down back way into out over just than then ' +
  'they them their he she his her my any some one two three four nine six see view views clear sky skies cloudy weather water litres warm clothes ' +
  'shoes poles jacket backpack headlamp porter porters gear question questions answers honest straight talk lake city house family run small group groups ' +
  'pace quiet private platform benches chairs eruptions eruption volcano summit trail trailhead arrive leaves leave hours hour minutes minute optional upgrade ' +
  'request requested paid pay payment cash card fees website reviews review stars swipe read all open menu close skip content main sections language english spanish show hide').split(' '));
// …and the reverse for the English page's no-JS texts: Spanish words that are never English ("La" and "Café" are names)
const ES_ONLY = new Set(('hola quiero consultar fecha personas persona recogida hora caminata días día noche cabaña cabañas por para una sale las ' +
  'tengo pregunta sobre alquiler alquilar equipo interesa opcional campamento paga se del y o solicitud medianoche atardecer exprés chaqueta ' +
  'mochila linterna bastones zapatos gracias').split(' '));
const spanishIn = (text) => (text.toLowerCase().match(/[\p{L}’']+/gu) || []).filter((w) => ES_ONLY.has(w));
const englishIn = (text) => (text.toLowerCase().match(/[\p{L}’']+/gu) || []).map((w) => w.replace(/[’']s$/, '')).filter((w) => EN_ONLY.has(w));
// font subsets: the characters each woff2 covers (python fontTools reads the cmap)
const CMAP = JSON.parse(execFileSync('python3', ['-c', `import json,sys
from fontTools.ttLib import TTFont
print(json.dumps({f: sorted(TTFont('${path.join(SITE, 'assets/fonts')}/'+f+'.woff2').getBestCmap()) for f in ['figtree-var','fraunces-roman','fraunces-italic-600','caveat-brush']}))`]).toString());
for (const k of Object.keys(CMAP)) CMAP[k] = new Set(CMAP[k]);
const glyphsMissing = (page) => page.evaluate(() => {
  const out = {};
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (w.nextNode()) {
    const n = w.currentNode, el = n.parentElement;
    if (!el || !n.textContent.trim() || !el.getClientRects().length || el.closest('svg.sprite, noscript, script, style')) continue;
    const cs = getComputedStyle(el), fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    const file = fam === 'Fraunces' ? (cs.fontStyle === 'italic' ? 'fraunces-italic-600' : 'fraunces-roman') : fam === 'Figtree' ? 'figtree-var' : fam === 'Caveat Brush' ? 'caveat-brush' : fam;
    out[file] = (out[file] || '') + n.textContent;
  }
  return out;
}).then((per) => Object.entries(per).flatMap(([file, text]) => [...new Set(text.replace(/\s/g, ''))].filter((c) => !CMAP[file]?.has(c.codePointAt(0)) && !FALLBACK_OK.has(c)).map((c) => `${file}: "${c}" U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`)));
// ≈ and → exist in none of the npm source fonts (no math/arrows subset): the metric-matched fallback draws them, in both languages
const FALLBACK_OK = new Set(['≈', '→']);

// ------------------------------------------------------------ 1–2. booking flow (mobile)
{
  const ctx = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watch(page, 'flow');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('#hero-cta');
  ok('hero CTA opens the booking sheet in place', await page.locator('dialog#note[open]').count() === 1 && (await page.evaluate(() => scrollY)) < 50);
  await page.fill('#f-date', EX_ISO);
  await page.dispatchEvent('#f-date', 'change');
  await page.click('#note [data-step="1"]');
  await page.click('#note label.rc:has(input[value="condesa"])');
  await page.click('#note label.rc:has(input[value="630"])');
  await page.click('#note label.rc:has(input[value="pana"])');
  if (HAS_FUEGO) {
    const totalBefore = await page.textContent('#note [data-total]');
    await page.click('#note label.rc:has(#f-fuego)');
    ok('Fuego-hike interest is not added to the website total', (await page.textContent('#note [data-total]')) === totalBefore && totalBefore === 'Q2,250 ≈ US$300', totalBefore);
  } else {
    const txt = await page.evaluate(() => document.body.innerText + document.head.innerHTML);
    ok('no-Fuego build: no Fuego-hike content anywhere (page, meta, sheet), no "No extra hike needed" lead', !/Fuego\shike|Q300|optional upgrade|closer to Fuego|legal and safety|No extra hike/i.test(txt));
    const lead = await page.evaluate(() => document.querySelector('.seg--sunset .tl__row h3 + p').textContent.trim());
    ok('no-Fuego build: the SUNSET row is just "The view from our camp is already stunning." (R2-C1/C12: the lead goes with the Fuego offer)', lead === 'The view from our camp is already stunning.', lead);
  }
  await page.click('#note label.chip:has(input[value="porterUp"])');
  await page.click('#note label.chip:has(input[value="headlamp"])');
  await page.fill('#f-name', 'Maria');
  const href = await page.getAttribute('#send', 'href');
  const msg = decodeURIComponent(href.split('?text=')[1]);
  ok('Send href → wa.me/50248347003', href.startsWith('https://wa.me/50248347003?text='));
  ok('message matches the template byte for byte (R2: pickup time, Panajachel add-on, Fuego interest)', msg === EXPECTED, msg === EXPECTED ? '' : '\n--- got ---\n' + msg + '\n--- expected ---\n' + EXPECTED);
  ok('en: no "(ES)" summary line and no Spanish words in the message (R2: it made the site look separate from Alexander)', !/\(ES\)/.test(msg) && spanishIn(msg).length === 0, spanishIn(msg).join(', '));
  ok('en: preview bubble = message', (await page.evaluate(() => document.querySelector('#bubble').textContent)) === EXPECTED);
  ok('encoded URL < 2,000 characters', href.length < 2000, `${href.length} chars`);
  ok('Send label shows total', (await page.textContent('[data-send-label]')).trim() === 'Send on WhatsApp · Q2,250');
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'm-sheet-filled.png') });
  await page.evaluate(() => { document.querySelector('#note .preview').open = true; document.querySelector('#note .preview').scrollIntoView({ block: 'start' }); });
  await page.waitForTimeout(300);
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'm-sheet-preview.png') });
  // dock live state
  await page.click('#note [data-close]');
  await page.evaluate(() => scrollTo(0, document.querySelector('#reviews').offsetTop));
  await page.waitForTimeout(500);
  const dock = await page.evaluate(() => ({ on: document.querySelector('#dock').classList.contains('is-on'), live: document.querySelector('#dock').classList.contains('is-live'), l1: document.querySelector('[data-dock-l1]').textContent, l2: document.querySelector('[data-dock-l2]').textContent, href: document.querySelector('[data-dock-cta]').href, label: document.querySelector('[data-dock-cta-label]').textContent }));
  ok('dock visible + live after the note was filled', dock.on && dock.live, JSON.stringify({ l1: dock.l1, l2: dock.l2, label: dock.label }));
  ok('dock live text', dock.l1 === `${EX_EN} · 3 people` && dock.l2 === 'Q2,250 ≈ US$300', `${dock.l1} / ${dock.l2}`);
  ok('dock CTA reads "Review →" once the note has content', dock.label === 'Review →', dock.label);
  {
    const pop = page.waitForEvent('popup', { timeout: 1200 }).then(() => true).catch(() => false);
    await page.click('[data-dock-cta]');
    await page.waitForTimeout(400);
    const opened = await page.evaluate(() => document.querySelector('#note').open);
    ok('dock CTA opens the note (never WhatsApp directly), also after the stepper was used', opened && !(await pop));
    await page.click('#note [data-close]');
    await page.evaluate(() => scrollTo(0, document.querySelector('#reviews').offsetTop));
    await page.waitForTimeout(400);
  }
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'm-dock-live.png') });
  // past date blocks; today shows the info note
  await page.click('[data-dock-cta]', { trial: true });
  await page.click('.dock__info');
  await page.fill('#f-date', '2026-10-01');
  await page.dispatchEvent('#f-date', 'change');
  const popupP = page.waitForEvent('popup', { timeout: 1500 }).then(() => true).catch(() => false);
  await page.click('#send');
  const popped = await popupP;
  const err = await page.evaluate(() => ({ inv: document.querySelector('#f-date').getAttribute('aria-invalid'), msg: document.querySelector('#date-msg').textContent, role: document.querySelector('#date-msg').getAttribute('role'), focus: document.activeElement.id }));
  ok('past date blocks Send with an announced error', !popped && err.inv === 'true' && err.msg === 'Please pick today or a later date.' && err.role === 'alert' && err.focus === 'f-date', JSON.stringify(err));
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  await page.fill('#f-date', today);
  await page.dispatchEvent('#f-date', 'change');
  ok('today shows the info note (not an error)', (await page.textContent('#date-msg')).startsWith('Today? Message Alexander right away') && (await page.getAttribute('#f-date', 'aria-invalid')) === 'false');
  // totals for every tour × {1, 8, 9, 60}
  const prices = { overnight: [750, 100], midnight: [750, 100], sunset: [750, 100], express: [675, 90] };
  let bad = [];
  for (const [tour, [q, usd]] of Object.entries(prices)) {
    await page.click(`#note label.rc:has(input[value="${tour}"])`);
    for (const n of [1, 8, 9, 60]) {
      await page.evaluate((n) => { const s = JSON.parse(sessionStorage.getItem('solex-note')); const cur = s.people; const btn = document.querySelector(`#note [data-step="${n > cur ? 1 : -1}"]`); for (let i = 0; i < Math.abs(n - cur); i++) btn.click(); }, n);
      const t = await page.textContent('[data-total]');
      const exp = `Q${(q * n).toLocaleString('en-US')} ≈ US$${(usd * n).toLocaleString('en-US')}`;
      const note = await page.textContent('#note [data-guide-note]');
      if (t !== exp) bad.push(`${tour}×${n}: ${t} ≠ ${exp}`);
      if (n === 9 && !note.startsWith('9 people · 2 local guides go')) bad.push(`guides note at 9: ${note}`);
    }
  }
  ok('totals for each tour × {1, 8, 9, 60} + 2 guides at 9', bad.length === 0, bad.join('; '));
  const ovOnly = await page.evaluate(() => [...document.querySelectorAll('[data-overnight-only]')].map((f) => f.hidden));
  ok('pickup time, after-the-tour and Fuego-hike fields hidden for non-overnight tours', ovOnly.length === (HAS_FUEGO ? 3 : 2) && ovOnly.every(Boolean), JSON.stringify(ovOnly));
  const exMsg = decodeURIComponent((await page.getAttribute('#send', 'href')).split('?text=')[1]);
  ok('non-overnight message has no pickup-time, Panajachel or Fuego line', !/Pickup time|Panajachel|Fuego/.test(exMsg));
  await page.click('#note label.rc:has(input[value="overnight"])');
  if (HAS_FUEGO) await page.click('#note label.rc:has(#f-fuego)');
  const noF = decodeURIComponent((await page.getAttribute('#send', 'href')).split('?text=')[1]);
  ok('unticked (or no-Fuego build): no Fuego line in the message; pickup time kept', !/Fuego/.test(noF) && /Pickup time: 6:30 AM \(on request\)/.test(noF));
  await ctx.close();
}

// ------------------------------------------------------------ 6. iOS double-tap zoom (R2-A1)
{
  const ctx = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const vp = await page.getAttribute('meta[name="viewport"]', 'content');
  ok('viewport keeps pinch-zoom (no maximum-scale / user-scalable=no)', !/maximum-scale|user-scalable\s*=\s*(no|0)/i.test(vp), vp);
  await page.click('#hero-cta');
  const ta = await page.evaluate(() => {
    const els = [document.documentElement, document.body, ...document.querySelectorAll('a[href], button, summary, input, label, output, [data-stepper], .sheet__body, .menu, .reviews__row, .trio__row, .others__grid')];
    return els.filter((e) => e.getClientRects().length && getComputedStyle(e).touchAction !== 'manipulation').map((e) => `${e.tagName.toLowerCase()}.${e.className}`).slice(0, 8);
  });
  ok('touch-action: manipulation on every control and scroll container (stepper in the sheet too)', ta.length === 0, ta.join('; '));
  const small = await page.evaluate(() => [...document.querySelectorAll('input:not([type=radio]):not([type=checkbox]), select, textarea')].filter((i) => parseFloat(getComputedStyle(i).fontSize) < 16).map((i) => i.id));
  ok('form inputs ≥ 16 px (no iOS zoom on focus)', small.length === 0, small.join(', '));
  // two quick taps on + must add two people and leave the zoom at 1
  const n0 = +(await page.textContent('#note [data-people]'));
  await page.tap('#note [data-step="1"]'); await page.tap('#note [data-step="1"]');
  const after = await page.evaluate(() => ({ n: +document.querySelector('#note [data-people]').textContent, scale: visualViewport.scale }));
  ok('double tap on + adds two people, no zoom', after.n === n0 + 2 && after.scale === 1, JSON.stringify(after));
  await ctx.close();
}

// ------------------------------------------------------------ presets: every [data-book][data-tour], [data-fuego], [data-gear] (both pages)
for (const [lang, url] of [['en', '/'], ['es', '/es/']]) {
  const ctx = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watch(page, lang + '-presets');
  await page.goto(base + url, { waitUntil: 'networkidle' });
  const msgOf = () => page.evaluate(() => decodeURIComponent(document.querySelector('#send').href.split('?text=')[1]));
  // (f) the pickup time left untouched: the standard line
  await page.click('#hero-cta');
  const def = await msgOf();
  ok(`${lang}: untouched pickup time gives the standard line`, def.split('\n').includes(lang === 'en' ? 'Pickup time: 8:00 AM (standard)' : 'Hora de recogida: 8:00 a. m. (estándar)'), def.split('\n').filter((l) => /Pickup time|Hora de recogida/.test(l)).join(' | '));
  const presets = await page.evaluate(() => [...document.querySelectorAll('[data-book][data-tour], [data-fuego], [data-gear]')].map((a, i) => ({ i, tour: a.dataset.tour || '', fuego: a.hasAttribute('data-fuego'), gear: a.hasAttribute('data-gear'), where: (a.closest('section, footer, dialog, header') || {}).id || '' })));
  const TOUR_LINE = lang === 'en'
    ? { overnight: 'Tour: Acatenango Overnight Hike (2 days / 1 night)', midnight: 'Tour: Midnight sunrise tour (leaves 10:30 PM)', sunset: 'Tour: Sunset tour (leaves 10:30 AM)', express: 'Tour: One-day express (leaves 5:00 AM)' }
    : { overnight: 'Tour: Caminata de 2 días al Acatenango (1 noche en cabaña)', midnight: 'Tour: Tour de medianoche (sale a las 10:30 p. m.)', sunset: 'Tour: Tour de atardecer (sale a las 10:30 a. m.)', express: 'Tour: Tour exprés de un día (sale a las 5:00 a. m.)' };
  const FUEGO_LINE = lang === 'en' ? "Optional Fuego hike: I'm interested (+Q300 per person, paid at camp)" : 'Caminata opcional al Fuego: me interesa (+Q300 por persona, se paga en el campamento)';
  const bad = [];
  for (const pr of presets) {
    // start from a different tour, Fuego box unticked, so each preset has to do its own work
    await page.evaluate((t) => { sessionStorage.setItem('solex-note', JSON.stringify({ tour: t === 'express' ? 'sunset' : 'express', fuego: false })); }, pr.tour);
    await page.reload({ waitUntil: 'networkidle' });
    await page.evaluate((i) => { [...document.querySelectorAll('[data-book][data-tour], [data-fuego], [data-gear]')][i].click(); }, pr.i);
    await page.waitForTimeout(150);
    const st = await page.evaluate(() => ({ open: document.querySelector('#note').open, tour: document.querySelector('#note input[name="tour"]:checked')?.value, fuego: !!document.querySelector('#f-fuego')?.checked, extras: (() => { const f = document.querySelector('#f-extras'), b = document.querySelector('.sheet__body'); if (!f || !b) return false; const r = f.getBoundingClientRect(), s = b.getBoundingClientRect(); return r.top >= s.top - 1 && r.top < s.bottom - 40; })() }));
    const lines = (await msgOf()).split('\n');
    const label = `${pr.where}#${pr.i}${pr.tour ? ' ' + pr.tour : ''}${pr.fuego ? ' fuego' : ''}${pr.gear ? ' gear' : ''}`;
    if (!st.open) bad.push(`${label}: sheet not open`);
    const want = pr.tour || 'overnight';
    if (pr.tour && (st.tour !== want || !lines.includes(TOUR_LINE[want]))) bad.push(`${label}: tour ${st.tour}`);
    if (pr.fuego && (!st.fuego || !lines.includes(FUEGO_LINE))) bad.push(`${label}: Fuego box not ticked / no line`);
    if (!pr.fuego && lines.includes(FUEGO_LINE)) bad.push(`${label}: unexpected Fuego line`);
    if (pr.gear && !st.extras) bad.push(`${label}: rental chips not shown at the top of the sheet`);
    await page.keyboard.press('Escape');
  }
  ok(`${lang}: every preset (${presets.length}: tours, Fuego box, rentals) opens the sheet set up, with the matching message line`, presets.length >= (HAS_FUEGO ? 8 : 6) && bad.length === 0, bad.join('; '));
  await ctx.close();
}

// ------------------------------------------------------------ first screen at 360×740
{
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  const fs = await page.evaluate(() => ['#hero-h', '.price', '#hero-cta', '.hero__pickup'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().bottom)));
  ok('360×740 first screen: H1, Q750, CTA and pickup line visible without scrolling', fs.every((b) => b <= 740), fs.join(' / ') + ' px');
  ok('360×740: logo appears once on the first screen', await page.evaluate(() => [...document.querySelectorAll('img[src*="logo"]')].filter((i) => i.getClientRects().length && i.getBoundingClientRect().top < 740).length === 1));
  await ctx.close();
}

// ------------------------------------------------------------ reduced motion = static
{
  const ctx = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.7) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 40)); } });
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({
    running: document.getAnimations().filter((a) => a.playState === 'running').map((a) => a.animationName || a.constructor.name),
    hidden: [...document.querySelectorAll('.settle, .incl li')].filter((e) => getComputedStyle(e).opacity !== '1').length,
    videoPaused: document.querySelector('.film__video').paused,
    doorStacked: [...document.querySelectorAll('.door figure')].every((f) => getComputedStyle(f).opacity === '1'),
  }));
  ok('reduced motion: no running animations, all content visible, video paused, door stacked', st.running.length === 0 && st.hidden === 0 && st.videoPaused && st.doorStacked, JSON.stringify(st));
  await ctx.close();
}

// ------------------------------------------------------------ 3. no-JS
{
  const ctx = await browser.newContext({ ...MOBILE, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'load' });
  const links = await page.$$eval('a[href^="https://wa.me/"]', (as) => as.map((a) => a.href));
  const bare = links.filter((h) => !/\?text=./.test(h));
  ok('no-JS: every wa.me link is prefilled', links.length > 10 && bare.length === 0, `${links.length} links, ${bare.length} bare`);
  ok('no-JS: hero href equals the spec (overnight hike + pickup time)', (await page.getAttribute('#hero-cta', 'href')) === HERO_HREF);
  ok('no-JS: the Fuego-hike CTAs prefill the interest line', (await page.$$eval('[data-fuego]', (as) => as.map((a) => a.getAttribute('href')))).every((h) => h === FUEGO_HREF));
  const bookHrefs = await page.$$eval('[data-book]', (as) => as.map((a) => a.getAttribute('href')));
  ok('no-JS: every booking entry point is a wa.me link', bookHrefs.every((h) => h && h.startsWith('https://wa.me/')), `${bookHrefs.length} entry points`);
  ok('no-JS: door figures stacked, all visible', await page.evaluate(() => [...document.querySelectorAll('.door figure')].every((f) => getComputedStyle(f).opacity === '1' && f.getBoundingClientRect().height > 200)));
  const enTexts = links.map((h) => decodeURIComponent(h.split('?text=')[1] || ''));
  const esWords = enTexts.flatMap((t) => spanishIn(t));
  ok('no-JS: every wa.me link is prefilled in English (no Spanish words)', enTexts.every((t) => t.startsWith('Hi Alexander!')) && esWords.length === 0, [...new Set(esWords)].join(', '));
  await ctx.close();
}
// no JS: the steppers and the camp switch would do nothing, so they are neither shown nor focusable (both pages, phone + desktop)
for (const url of ['/', '/es/']) for (const dev of [MOBILE, DESKTOP]) {
  const ctx = await browser.newContext({ ...dev, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base + url, { waitUntil: 'load' });
  const dead = await page.evaluate(() => [...document.querySelectorAll('.stepper__btn, .sight__btn')].filter((b) => b.getClientRects().length).map((b) => b.getAttribute('aria-label') || b.textContent.trim()));
  // Tab through the page: none of them can take focus
  const focusable = [];
  for (let i = 0; i < 400; i++) {
    await page.keyboard.press('Tab');
    const f = await page.evaluate(() => { const a = document.activeElement; return a === document.body ? null : (a.matches('.stepper__btn, .sight__btn') ? a.getAttribute('aria-label') || a.textContent.trim() : a.matches('.foot a:last-child') ? 'END' : ''); });
    if (f === null || f === 'END') break;
    if (f) focusable.push(f);
  }
  const shown = await page.evaluate(() => ({ people: [...document.querySelectorAll('[data-people]')].map((o) => o.textContent).join(','), side: document.querySelector('.sight').dataset.side, cap: !document.querySelector('[data-cap="ours"]').hidden }));
  ok(`no-JS ${url} ${dev === MOBILE ? '390' : '1440'}: no stepper / camp-switch button visible or focusable; people read 2, the schematic shows our camp`, dead.length === 0 && focusable.length === 0 && /^2(,2)*$/.test(shown.people) && shown.side === 'ours' && shown.cap, JSON.stringify({ dead, focusable, ...shown }));
  await ctx.close();
}

// ------------------------------------------------------------ 7. Spanish page: booking flow (mobile)
{
  const ctx = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watch(page, 'es-flow');
  await page.goto(base + '/es/', { waitUntil: 'networkidle' });
  ok('es: <html lang="es">, Spanish title', await page.evaluate(() => document.documentElement.lang === 'es' && /^Caminata/.test(document.title)), await page.title());
  await page.click('#hero-cta');
  ok('es: hero CTA opens the booking sheet', await page.locator('dialog#note[open]').count() === 1);
  await page.fill('#f-date', EX_ISO);
  await page.dispatchEvent('#f-date', 'change');
  await page.click('#note [data-step="1"]');
  await page.click('#note label.rc:has(input[value="condesa"])');
  await page.click('#note label.rc:has(input[value="630"])');
  await page.click('#note label.rc:has(input[value="pana"])');
  if (HAS_FUEGO) {
    const before = await page.textContent('#note [data-total]');
    await page.click('#note label.rc:has(#f-fuego)');
    ok('es: Fuego-hike interest is not added to the total', (await page.textContent('#note [data-total]')) === before && before === 'Q2,250 ≈ US$300', before);
  } else {
    const txt = await page.evaluate(() => document.body.innerText + document.head.innerHTML);
    ok('es no-Fuego build: no Fuego-hike content anywhere (page, meta, sheet), no "No hace falta otra caminata" lead', !/caminata\s(opcional\s)?al\sFuego|Q300|más al Fuego|legales y de seguridad|otra caminata/i.test(txt));
  }
  await page.click('#note label.chip:has(input[value="porterUp"])');
  await page.click('#note label.chip:has(input[value="headlamp"])');
  await page.fill('#f-name', 'Maria');
  const href = await page.getAttribute('#send', 'href');
  const msg = decodeURIComponent(href.split('?text=')[1]);
  ok('es: the WhatsApp message is entirely in Spanish and matches byte for byte', msg === EXPECTED_ES, msg === EXPECTED_ES ? '' : '\n--- got ---\n' + msg + '\n--- expected ---\n' + EXPECTED_ES);
  ok('es: message has no "(ES)" line and no English', !/\(ES\)/.test(msg) && englishIn(msg).length === 0, englishIn(msg).join(', '));
  ok('es: Send label', (await page.textContent('[data-send-label]')).trim() === 'Enviar por WhatsApp · Q2,250');
  ok('es: preview bubble = message', (await page.evaluate(() => document.querySelector('#bubble').textContent)) === EXPECTED_ES);
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'es-m-sheet-filled.png') });
  await page.click('#note [data-close]');
  await page.evaluate(() => scrollTo(0, document.querySelector('#reviews').offsetTop));
  await page.waitForTimeout(500);
  const dock = await page.evaluate(() => ({ l1: document.querySelector('[data-dock-l1]').textContent, l2: document.querySelector('[data-dock-l2]').textContent, label: document.querySelector('[data-dock-cta-label]').textContent, href: document.querySelector('[data-dock-cta]').href }));
  ok('es: dock live text in Spanish', dock.l1 === `${EX_ES_SHORT} · 3 personas` && dock.l2 === 'Q2,250 ≈ US$300' && dock.label === 'Revisar →', `${dock.l1} / ${dock.l2} / ${dock.label}`);
  {
    await page.click('[data-dock-cta]');
    await page.waitForTimeout(400);
    ok('es: dock CTA opens the note', await page.evaluate(() => document.querySelector('#note').open));
    await page.click('#note [data-close]');
    await page.evaluate(() => scrollTo(0, document.querySelector('#reviews').offsetTop));
    await page.waitForTimeout(400);
  }
  await page.click('.dock__info');
  await page.fill('#f-date', '2026-10-01');
  await page.dispatchEvent('#f-date', 'change');
  await page.click('#send');
  const err = await page.evaluate(() => ({ inv: document.querySelector('#f-date').getAttribute('aria-invalid'), msg: document.querySelector('#date-msg').textContent }));
  ok('es: past date blocks Send with a Spanish error', err.inv === 'true' && err.msg === 'Elige hoy o una fecha posterior.', JSON.stringify(err));
  await page.fill('#f-date', GT_TODAY);
  await page.dispatchEvent('#f-date', 'change');
  ok('es: today shows the Spanish info note', (await page.textContent('#date-msg')).startsWith('¿Hoy? Escríbele a Alexander'));
  const prices = { overnight: [750, 100], midnight: [750, 100], sunset: [750, 100], express: [675, 90] };
  const bad = [];
  for (const [tour, [q, usd]] of Object.entries(prices)) {
    await page.click(`#note label.rc:has(input[value="${tour}"])`);
    for (const n of [1, 8, 9, 60]) {
      await page.evaluate((n) => { const s = JSON.parse(sessionStorage.getItem('solex-note')); const cur = s.people; const btn = document.querySelector(`#note [data-step="${n > cur ? 1 : -1}"]`); for (let i = 0; i < Math.abs(n - cur); i++) btn.click(); }, n);
      const t = await page.textContent('[data-total]');
      const exp = `Q${(q * n).toLocaleString('en-US')} ≈ US$${(usd * n).toLocaleString('en-US')}`;
      const note = await page.textContent('#note [data-guide-note]');
      if (t !== exp) bad.push(`${tour}×${n}: ${t} ≠ ${exp}`);
      if (n === 1 && note !== '1 persona · pregúntale a Alexander si puedes unirte a un grupo') bad.push(`note at 1: ${note}`);
      if (n === 9 && !note.startsWith('9 personas · 2 guías locales')) bad.push(`note at 9: ${note}`);
    }
  }
  ok('es: totals for each tour × {1, 8, 9, 60} + Spanish guide notes', bad.length === 0, bad.join('; '));
  const exMsg = decodeURIComponent((await page.getAttribute('#send', 'href')).split('?text=')[1]);
  ok('es: non-overnight message: no pickup time, Panajachel or Fuego line', /^Tour: Tour exprés de un día \(sale a las 5:00 a\. m\.\)$/m.test(exMsg) && !/Hora de recogida|Panajachel|Fuego/.test(exMsg));
  await page.click('#note label.rc:has(input[value="overnight"])');
  // every runtime string that can show: dock, card, notes, toasts — no English
  await page.click('#note [data-close]');
  const live = await page.evaluate(() => [...document.querySelectorAll('[data-dock-l1], [data-dock-l2], [data-dock-cta-label], [data-card-sum], [data-guide-note], [data-people-text], [data-send-label], [data-total], .film__toggle')].map((e) => e.textContent + ' ' + (e.getAttribute('aria-label') || '')).join(' | '));
  ok('es: runtime strings (dock, card, notes, video button) have no English', englishIn(live).length === 0, englishIn(live).length ? englishIn(live).join(', ') + ' ← ' + live.slice(0, 200) : '');
  ok('es: glyph coverage (after the form is filled: bubble, dock, notes)', (await glyphsMissing(page)).length === 0, (await glyphsMissing(page)).slice(0, 10).join('; '));
  await ctx.close();
}

// ------------------------------------------------------------ 7. Spanish page: no English left, switcher, hreflang, no-JS
{
  const ctx = await browser.newContext({ ...MOBILE });
  const page = await ctx.newPage();
  watch(page, 'es-text');
  await page.goto(base + '/es/', { waitUntil: 'networkidle' });
  const left = await page.evaluate(() => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) { const el = w.currentNode.parentElement; if (el && !el.closest('script, style, noscript, [lang="en"]') && w.currentNode.textContent.trim()) out.push(['text', w.currentNode.textContent.trim()]); }
    for (const el of document.querySelectorAll('[alt], [aria-label], [title], [placeholder]')) for (const a of ['alt', 'aria-label', 'title', 'placeholder']) if (el.getAttribute(a) && !el.closest('[lang="en"]') && !el.matches('[hreflang="en"]')) out.push([a, el.getAttribute(a)]);
    for (const m of document.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[property="og:image:alt"], meta[name="twitter:title"], meta[name="twitter:description"]')) out.push(['meta', m.content]);
    out.push(['title', document.title]);
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { const j = JSON.parse(s.textContent); JSON.stringify(j, (k, v) => { if ((k === 'name' || k === 'description') && typeof v === 'string') out.push(['json-ld', v]); return v; }); }
    return out;
  });
  const english = left.map(([k, t]) => [k, t, englishIn(t)]).filter(([, t, w]) => w.length && !/^https?:/.test(t));
  ok('es: no English left in text, alt, aria-label, title, meta, JSON-LD', english.length === 0, english.slice(0, 10).map(([k, t, w]) => `${k} "${t.slice(0, 60)}" [${w.join(',')}]`).join('\n      '));
  const reviews = await page.evaluate(() => ({ orig: [...document.querySelectorAll('.rev__orig')].map((d) => d.querySelector('p').lang), tania: [...document.querySelectorAll('.rev blockquote p')].some((p) => p.textContent.includes('él nunca nos apresuró')) }));
  ok('es: English reviews translated with the English original one tap away; the Spanish review in the original', reviews.tania && reviews.orig.length === 6 && reviews.orig.every((l) => l === 'en'), JSON.stringify(reviews));
  const head = await page.evaluate(() => ({ canon: document.querySelector('link[rel=canonical]').href, alt: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.hreflang}=${l.href}`).join(' '), locale: document.querySelector('meta[property="og:locale"]').content, ogurl: document.querySelector('meta[property="og:url"]').content }));
  ok('es: canonical, hreflang en/es/x-default, og:locale es_GT, og:url', head.canon === 'https://solex-tours.com/es/' && head.alt === 'en=https://solex-tours.com/ es=https://solex-tours.com/es/ x-default=https://solex-tours.com/' && head.locale === 'es_GT' && head.ogurl === 'https://solex-tours.com/es/', JSON.stringify(head));
  const ld = await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].find((n) => n['@type'] === 'TravelAgency'));
  ok('es: JSON-LD TravelAgency uses the Spanish share image and "Efectivo"', ld.image === 'https://solex-tours.com/og-image-es.jpg' && ld.paymentAccepted === 'Efectivo', JSON.stringify({ image: ld.image, pay: ld.paymentAccepted }));
  {
    const en = await browser.newPage();
    await en.goto(base + '/', { waitUntil: 'domcontentloaded' });
    const h = await en.evaluate(() => ({ lang: document.documentElement.lang, canon: document.querySelector('link[rel=canonical]').href, alt: [...document.querySelectorAll('link[rel=alternate][hreflang]')].map((l) => `${l.hreflang}=${l.href}`).join(' '), locale: document.querySelector('meta[property="og:locale"]').content, altLocale: [...document.querySelectorAll('meta[property="og:locale:alternate"]')].map((m) => m.content).join(' '), ogurl: document.querySelector('meta[property="og:url"]').content, ld: JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)['@graph'].find((n) => n['@type'] === 'TravelAgency') }));
    ok('en: <html lang="en">, canonical /, hreflang en/es/x-default, og:locale en_US (+ es_GT alternate), og:url, JSON-LD image + Cash', h.lang === 'en' && h.canon === 'https://solex-tours.com/' && h.alt === 'en=https://solex-tours.com/ es=https://solex-tours.com/es/ x-default=https://solex-tours.com/' && h.locale === 'en_US' && h.altLocale === 'es_GT' && h.ogurl === 'https://solex-tours.com/' && h.ld.image === 'https://solex-tours.com/og-image.jpg' && h.ld.paymentAccepted === 'Cash', JSON.stringify({ ...h, ld: undefined }));
    await en.close();
  }
  // the switcher: round flag ≥ 44 px, opens a list with both languages, current marked; keeps the place
  const btn = await page.evaluate(() => { const r = document.querySelector('.lang__btn').getBoundingClientRect(); return { w: r.width, h: r.height, name: document.querySelector('.lang__btn').textContent.trim() }; });
  ok('es: language button ≥ 44 px with a Spanish name', btn.w >= 44 && btn.h >= 44 && btn.name === 'Idioma: Español', JSON.stringify(btn));
  await page.click('.lang__btn');
  const list = await page.evaluate(() => [...document.querySelectorAll('.lang__list a')].map((a) => `${a.textContent}|${a.getAttribute('hreflang')}|${a.getAttribute('aria-current') || ''}|${Math.round(a.getBoundingClientRect().height)}`));
  ok('es: switcher lists English and Español (current marked, rows ≥ 44 px)', list.join(' ') === 'English|en||48 Español|es|true|48', list.join(' '));
  if (shotsDir) await page.screenshot({ path: path.join(shotsDir, 'es-m-lang-open.png') });
  await page.keyboard.press('Escape');
  ok('es: Esc closes the language list and returns focus', await page.evaluate(() => !document.querySelector('.lang').open && document.activeElement === document.querySelector('.lang__btn')));
  // section in view (no hash) → the English page opens at the same section
  await page.evaluate(() => scrollTo(0, document.querySelector('#faq').offsetTop + 10));
  await page.waitForTimeout(300);
  await page.evaluate(() => { document.querySelector('.lang').open = true; });
  await page.waitForTimeout(100);
  await Promise.all([page.waitForURL(/\/#faq$/), page.click('.lang__list a[hreflang="en"]')]);
  ok('es → en keeps the section in view (#faq)', page.url() === base + '/#faq', page.url());
  // a #hash on screen is kept exactly
  await page.goto(base + '/#faq-pay', { waitUntil: 'networkidle' });
  await page.evaluate(() => { document.querySelector('.lang').open = true; });
  await Promise.all([page.waitForURL(/\/es\/#faq-pay$/), page.click('.lang__list a[hreflang="es"]')]);
  ok('en → es keeps the #hash (#faq-pay, answer open)', page.url() === base + '/es/#faq-pay' && await page.evaluate(() => document.querySelector('#faq-pay').open), page.url());
  await ctx.close();
  // phones (FUN-F1): hidden sections (#prepare is display:none below 600 px) never win; both directions
  const wrong = [];
  for (const [w, h] of [[360, 740], [390, 844]]) for (const from of ['/', '/es/']) {
    const c = await browser.newContext({ ...MOBILE, viewport: { width: w, height: h } });
    const p = await c.newPage();
    await p.goto(base + from, { waitUntil: 'networkidle' });
    for (const id of ['camp', 'reviews', 'two-days', 'gear']) {
      await p.evaluate((id) => scrollTo(0, document.getElementById(id).getBoundingClientRect().top + scrollY + 2), id);
      await p.waitForTimeout(120);
      await p.evaluate(() => { document.querySelector('.lang').open = true; });
      const href = await p.evaluate(() => document.querySelector('.lang__list a:not([aria-current])').getAttribute('href'));
      if (!href.endsWith('#' + id)) wrong.push(`${from} ${w}: #${id} → ${href}`);
      await p.evaluate(() => { document.querySelector('.lang').open = false; });
    }
    if (w === 390) { // follow the link from #reviews: the other page opens with #reviews on screen
      await p.evaluate(() => scrollTo(0, document.getElementById('reviews').getBoundingClientRect().top + scrollY));
      await p.waitForTimeout(150);
      await p.evaluate(() => { document.querySelector('.lang').open = true; });
      await Promise.all([p.waitForURL(/#reviews$/), p.click('.lang__list a:not([aria-current])')]);
      await p.waitForLoadState('load');
      await p.waitForTimeout(300);
      const there = await p.evaluate(() => { const r = document.getElementById('reviews').getBoundingClientRect(); return { url: location.pathname + location.hash, on: r.top < innerHeight && r.bottom > 0 }; });
      if (!there.url.endsWith('#reviews') || !there.on) wrong.push(`${from} 390 → ${there.url}, #reviews on screen: ${there.on}`);
    }
    await c.close();
  }
  ok('phones 360 / 390, en ⇄ es: the switcher carries #camp, #reviews, #two-days, #gear (never #prepare); from #reviews the other page opens on #reviews', wrong.length === 0, wrong.join('; '));
  // keyboard (FUN-F3): from /#faq-pay, Shift+Tab back up to the flag (the page scrolls to the top on the way),
  // Enter, ArrowDown, Enter → /es/#faq-pay; with reduced and with full motion, phone and desktop
  const keys = [];
  for (const [dev, motion] of [[MOBILE, 'reduce'], [MOBILE, 'no-preference'], [DESKTOP, 'reduce'], [DESKTOP, 'no-preference']]) {
    const c = await browser.newContext({ ...dev, reducedMotion: motion });
    const p = await c.newPage();
    await p.goto(base + '/#faq-pay', { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    let at = false;
    for (let i = 0; i < 400 && !at; i++) { await p.keyboard.press('Shift+Tab'); at = await p.evaluate(() => document.activeElement.matches('.lang__btn')); }
    await p.keyboard.press('Enter');
    await p.keyboard.press('ArrowDown');
    await Promise.all([p.waitForURL(/\/es\//, { timeout: 5000 }).catch(() => {}), p.keyboard.press('Enter')]);
    await p.waitForTimeout(300);
    const url = p.url().replace(base, '');
    if (url !== '/es/#faq-pay') keys.push(`${dev === MOBILE ? '390' : '1440'} ${motion}: ${at ? '' : 'flag never reached; '}→ ${url}`);
    await c.close();
  }
  // touch-scroll (phone) / wheel (desktop) to #reviews, then keyboard to the flag (Tab from the top of the document).
  // R2F-3: like a person, not a script: the first Tab comes within 1 s of the scroll and the keys are 200 ms apart
  // (the first Tab focuses "Skip to content" and scrolls to the top inside the settle window), both motion modes.
  const gap = (p) => p.waitForTimeout(200);
  for (const [dev, motion] of [[MOBILE, 'reduce'], [MOBILE, 'no-preference'], [DESKTOP, 'reduce'], [DESKTOP, 'no-preference']]) {
    const c = await browser.newContext({ ...dev, reducedMotion: motion });
    const p = await c.newPage();
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    const dist = await p.evaluate(() => Math.round(document.getElementById('reviews').getBoundingClientRect().top + scrollY - innerHeight * 0.1));
    if (dev === MOBILE) { // most of the way programmatically, the last stretch with a real finger swipe (touch events)
      await p.evaluate((d) => scrollTo(0, d - 160), dist);
      const cdp = await c.newCDPSession(p);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 600 }] });
      for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 600 - i * 20 }] }); await p.waitForTimeout(40); }
      await p.waitForTimeout(120);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else {
      await p.mouse.move(700, 450);
      for (let done = 0; done < dist;) { const step = Math.min(400, dist - done); await p.mouse.wheel(0, step); done += step; await p.waitForTimeout(30); }
    }
    await p.waitForTimeout(300);
    const where = await p.evaluate(() => { const r = document.getElementById('reviews').getBoundingClientRect(); return r.top <= innerHeight * 0.35 && r.bottom > innerHeight * 0.35; });
    let at = false;
    for (let i = 0; i < 12 && !at; i++) { await p.keyboard.press('Tab'); await gap(p); at = await p.evaluate(() => document.activeElement.matches('.lang__btn')); }
    await p.keyboard.press('Enter'); await gap(p);
    await p.keyboard.press('ArrowDown'); await gap(p);
    await Promise.all([p.waitForURL(/\/es\//, { timeout: 5000 }).catch(() => {}), p.keyboard.press('Enter')]);
    await p.waitForTimeout(300);
    const url = p.url().replace(base, '');
    if (url !== '/es/#reviews') keys.push(`${dev === MOBILE ? 'touch 390' : 'wheel 1440'} ${motion}: ${where ? '' : '#reviews not reached by scrolling; '}${at ? '' : 'flag never reached; '}→ ${url}`);
    await c.close();
  }
  ok('keyboard: Shift+Tab to the flag from /#faq-pay → /es/#faq-pay; after touch / wheel scrolling to #reviews, Tab to the flag → /es/#reviews (390 + 1440, reduced + full motion)', keys.length === 0, keys.join('; '));
  // no-JS: Spanish prefills, the switcher still opens (it is a <details>), and no English in the no-JS text
  const nj = await browser.newContext({ ...MOBILE, javaScriptEnabled: false });
  const p2 = await nj.newPage();
  await p2.goto(base + '/es/', { waitUntil: 'load' });
  const links = await p2.$$eval('a[href^="https://wa.me/"]', (as) => as.map((a) => a.href));
  const texts = links.map((h) => decodeURIComponent(h.split('?text=')[1] || ''));
  ok('es no-JS: every wa.me link is prefilled in Spanish', links.length > 10 && texts.every((t) => t.startsWith('¡Hola, Alexander!') && englishIn(t).length === 0), `${links.length} links; ` + texts.filter((t) => !t.startsWith('¡Hola') || englishIn(t).length).slice(0, 2).join(' | '));
  ok('es no-JS: hero href = the Spanish spec', (await p2.getAttribute('#hero-cta', 'href')) === HERO_HREF_ES);
  ok('es no-JS: the Fuego-hike CTAs prefill the Spanish interest line', (await p2.$$eval('[data-fuego]', (as) => as.map((a) => a.getAttribute('href')))).every((h) => h === FUEGO_HREF_ES));
  const njText = await p2.evaluate(() => document.querySelector('.book__noscript')?.textContent || '');
  ok('es no-JS: the <noscript> note is Spanish', /^El formulario necesita JavaScript/.test(njText) && englishIn(njText).length === 0, njText);
  await p2.click('.lang__btn');
  ok('es no-JS: the language list opens without JS (<details>)', await p2.evaluate(() => document.querySelector('.lang').open && document.querySelectorAll('.lang__list a').length === 2));
  await nj.close();
}

// ------------------------------------------------------------ 9. Round-2 final review fixes
{
  // R2F-4: the language list closes when Tab leaves it; the tick is not part of the link names; page languages
  // in the manifests and in JSON-LD (WebPage.inLanguage)
  const c = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
  const p = await c.newPage();
  watch(p, 'r2f');
  await p.goto(base + '/es/', { waitUntil: 'networkidle' });
  let at = false;
  for (let i = 0; i < 12 && !at; i++) { await p.keyboard.press('Tab'); at = await p.evaluate(() => document.activeElement.matches('.lang__btn')); }
  await p.keyboard.press('Enter');
  const names = { es: await p.getByRole('link', { name: 'Español', exact: true }).count(), en: await p.getByRole('link', { name: 'English', exact: true }).count() };
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  const inList = await p.evaluate(() => document.querySelector('.lang').open && document.activeElement.matches('.lang__list a'));
  await p.keyboard.press('Tab');
  const out = await p.evaluate(() => ({ open: document.querySelector('.lang').open, focus: document.activeElement.className }));
  ok('R2F-4: Tab out of the language list closes it; the tick is not in the link names ("Español", "English")', at && inList && !out.open && names.es === 1 && names.en === 1, JSON.stringify({ at, inList, ...out, names }));
  const man = { en: await (await fetch(base + '/site.webmanifest')).json(), es: await (await fetch(base + '/es/site.webmanifest')).json() };
  const ld = {};
  for (const [l, u] of [['en', '/'], ['es', '/es/']]) {
    const h = await readFile(path.join(SITE, u.slice(1), 'index.html'), 'utf8');
    ld[l] = JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].find((n) => n['@type'] === 'WebPage');
  }
  ok('R2F-4: manifests say "lang" (en, es); JSON-LD WebPage inLanguage en / es with the page URL', man.en.lang === 'en' && man.es.lang === 'es' && ld.en?.inLanguage === 'en' && ld.es?.inLanguage === 'es' && ld.en.url === 'https://solex-tours.com/' && ld.es.url === 'https://solex-tours.com/es/', JSON.stringify({ man: [man.en.lang, man.es.lang], ld: [ld.en?.inLanguage, ld.es?.inLanguage] }));
  await c.close();

  // MV2-01 / R2F-1 / R2F-2 / MV2-05: the menu list shows it scrolls (scroll shadows) when it overflows, a focused link
  // keeps its whole focus ring inside the list, two-line rows keep their text off the dividers
  const menu = [];
  for (const [w, h] of [[390, 844], [844, 390], [360, 640]]) for (const url of ['/', '/es/']) {
    const mc = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const mp = await mc.newPage();
    await mp.goto(base + url, { waitUntil: 'networkidle' });
    await mp.click('[data-open-menu]');
    await mp.waitForTimeout(150);
    const r = await mp.evaluate(() => {
      const n = document.querySelector('#menu > nav'), cs = getComputedStyle(n);
      const rows = [...n.querySelectorAll('a')].map((a) => { const s = getComputedStyle(a); return parseFloat(s.paddingTop); });
      return { over: n.scrollHeight > n.clientHeight + 1, grads: (cs.backgroundImage.match(/gradient\(/g) || []).length, att: cs.backgroundAttachment, sp: cs.scrollPaddingTop, pad: Math.min(...rows) };
    });
    // scroll shadows: a cover that scrolls with the list ("local") over a fixed bottom shadow ("scroll")
    if (r.over && !(r.grads >= 2 && /local/.test(r.att) && /scroll/.test(r.att))) menu.push(`${url} ${w}×${h}: overflows without a scroll cue (${r.grads} gradients, ${r.att})`);
    if (r.pad < 8) menu.push(`${url} ${w}×${h}: link padding ${r.pad}px`);
    // Tab through the links: the focused one never sits flush with the list's edge (its 5 px ring would be cut)
    const cut = [];
    for (let i = 0; i < 20; i++) {
      await mp.keyboard.press('Tab');
      const f = await mp.evaluate(() => {
        const a = document.activeElement, n = document.querySelector('#menu > nav');
        if (!n.contains(a)) return null;
        const ar = a.getBoundingClientRect(), nr = n.getBoundingClientRect();
        return { t: a.textContent.trim().slice(0, 18), top: Math.round(ar.top - nr.top), bottom: Math.round(nr.bottom - ar.bottom) };
      });
      if (f && (f.top < 5 || f.bottom < 5)) cut.push(`${f.t} (${f.top}/${f.bottom})`);
    }
    if (cut.length) menu.push(`${url} ${w}×${h}: focus ring cut on ${cut.slice(0, 3).join(', ')}`);
    await mc.close();
  }
  ok('menu (390×844, 844×390, 360×640, both pages): scroll shadows when the list overflows; focused links keep their ring inside; rows padded 8 px', menu.length === 0, menu.join('; '));

  // MV2-03: #fuego text back to the small-text token on phones; the ticket's upgrade card keeps its explanation behind
  // "How it works" on phones (closed, ≥ 44 px) and simply open from 600 px
  const up = [];
  for (const [dev, url] of [[MOBILE, '/'], [MOBILE, '/es/'], [DESKTOP, '/'], [{ viewport: { width: 820, height: 1180 } }, '/es/']]) {
    const uc = await browser.newContext({ ...dev, reducedMotion: 'reduce' });
    const upg = await uc.newPage();
    await upg.goto(base + url, { waitUntil: 'networkidle' });
    const s = await upg.evaluate(() => {
      const d = document.querySelector('.upgrade__more'), sum = d && d.querySelector('summary');
      return d && { open: d.open, sumH: sum.getClientRects().length ? Math.round(sum.getBoundingClientRect().height) : 0, fuegoFs: parseFloat(getComputedStyle(document.querySelector('.fuego__text p')).fontSize), upFs: parseFloat(getComputedStyle(d.querySelector('p')).fontSize), w: innerWidth };
    });
    if (!s) { if (HAS_FUEGO) up.push(`${url}: no .upgrade__more`); await uc.close(); continue; }
    const phone = s.w < 600;
    if (phone && (s.open || s.sumH < 44)) up.push(`${url} ${s.w}: open ${s.open}, summary ${s.sumH}px`);
    if (!phone && (!s.open || s.sumH)) up.push(`${url} ${s.w}: open ${s.open}, summary shown ${s.sumH}px`);
    if (s.fuegoFs < 15 || s.upFs < 15) up.push(`${url} ${s.w}: text ${s.fuegoFs} / ${s.upFs}px`);
    if (phone) { // one tap opens it
      await upg.evaluate(() => document.querySelector('.upgrade__more').scrollIntoView({ block: 'center' }));
      await upg.click('.upgrade__more summary');
      if (!(await upg.evaluate(() => document.querySelector('.upgrade__more').open))) up.push(`${url}: summary does not open`);
    }
    await uc.close();
  }
  ok('upgrade card: "How it works" closed on phones (≥ 44 px, opens on tap), open without a summary from 600 px; #fuego / card text ≥ 15 px', !HAS_FUEGO || up.length === 0, up.join('; '));

  // MV2-02 / MV2-08 / MV2-06: the header subtitle never touches the flag, the Menu label shows where it fits,
  // the booking-card CTA stays on one line at 375
  const hdr = [];
  for (const w of [360, 375, 385, 390, 414, 430]) for (const url of ['/', '/es/']) {
    const hc = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const hp = await hc.newPage();
    await hp.goto(base + url, { waitUntil: 'networkidle' });
    const r = await hp.evaluate(() => {
      const box = (s) => { const e = document.querySelector(s); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; };
      const name = box('.brand__name small') || box('.brand__name'), flag = box('.lang__btn'), menu = box('.top__menu'), label = box('.top__menu-label'), wa = box('.top__wa');
      const cta = document.querySelector('.book__card .btn');
      return { gap: Math.round(flag.left - name.right), label: !!label, fits: Math.round(wa.right) <= innerWidth - 12 && menu.right <= wa.left, cta: cta && cta.getClientRects().length ? Math.round(cta.getBoundingClientRect().height) : 0 };
    });
    if (r.gap < 6 || !r.fits) hdr.push(`${url} ${w}: subtitle–flag gap ${r.gap}px${r.fits ? '' : ', header overflows'}`);
    if (r.cta > 60) hdr.push(`${url} ${w}: booking CTA ${r.cta}px tall`);
    await hc.close();
  }
  ok('header at 360–430 (both pages): the brand keeps ≥ 6 px from the flag, nothing overflows; the booking-card CTA is one line (MV2-02, -06, -08)', hdr.length === 0, hdr.join('; '));
}

// words in CSS generated content would escape the dictionary (and the checks above)
{
  const css = (await readFile(path.join(SITE, 'assets/css/site.css'), 'utf8')) + (await readFile(path.join(SITE, 'index.html'), 'utf8')).match(/<style>([\s\S]*?)<\/style>/)[1];
  const words = css.match(/content:\s*"[^"]*[A-Za-z]{2,}[^"]*"/g) || [];
  ok('no words in CSS generated content (everything visible goes through the dictionary)', words.length === 0, words.join(', '));
}

// ------------------------------------------------------------ both languages: first screen, glyphs, no sideways scroll
for (const [lang, url] of [['en', '/'], ['es', '/es/']]) {
  const issues = [], glyphs = [];
  for (const w of [320, 360, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(base + url, { waitUntil: 'networkidle' });
    const r = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      // an element past the right edge counts unless an ancestor clips it inside the viewport (e.g. the ticket stamp)
      const clipped = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o !== 'visible' && a.getBoundingClientRect().right <= vw + 1) return true; } return false; };
      const wide = [...document.querySelectorAll('body *')].filter((e) => { if (!e.getClientRects().length || e.closest('.reviews__row, .trio__row, .others__grid, .sprite, dialog:not([open]), .dock:not(.is-on)')) return false; const b = e.getBoundingClientRect(); return b.right > vw + 1 && getComputedStyle(e).position !== 'fixed' && !clipped(e); }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} → ${Math.round(e.getBoundingClientRect().right)}`);
      return { scroll: document.documentElement.scrollWidth, vw, wide, first: ['#hero-h', '.price', '#hero-cta', '.hero__pickup'].map((s) => Math.round(document.querySelector(s).getBoundingClientRect().bottom)) };
    });
    if (r.scroll > r.vw || r.wide.length) issues.push(`${w}px: page ${r.scroll}/${r.vw} ${r.wide.join(', ')}`);
    if (w === 360 && !r.first.every((b) => b <= 740)) issues.push(`360×740 first screen: ${r.first.join(' / ')}`);
    if (w === 390) glyphs.push(...await glyphsMissing(page));
    await ctx.close();
  }
  ok(`${lang}: no sideways scroll or overflowing element at 320 / 360 / 390; first screen at 360×740 shows H1, Q750, CTA, pickup`, issues.length === 0, issues.join('; '));
  // the sticky dock never cuts its text (idle "Overnight hike · Q750" and a live note with 12 people)
  const cut = [];
  for (const w of [320, 360, 390]) for (const live of [false, true]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    if (live) await page.addInitScript((d) => sessionStorage.setItem('solex-note', JSON.stringify({ date: d, people: 12, touched: true })), EX_ISO);
    await page.goto(base + url, { waitUntil: 'networkidle' });
    await page.evaluate(() => scrollTo(0, document.querySelector('#reviews').offsetTop));
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => [...document.querySelectorAll('[data-dock-l1], [data-dock-l2], [data-dock-cta-label]')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
    if (r.length) cut.push(`${w}${live ? ' live' : ''}: ${r.join(', ')}`);
    await ctx.close();
  }
  ok(`${lang}: dock text never truncated at 320 / 360 / 390 (idle and live)`, cut.length === 0, cut.join('; '));
  const og = await (await fetch(await (async () => { const h = await readFile(path.join(SITE, url.replace(/^\//, ''), 'index.html'), 'utf8'); return base + '/' + h.match(/property="og:image" content="https:\/\/solex-tours\.com\/([^"]+)"/)[1]; })())).status;
  ok(`${lang}: og:image exists in site/`, og === 200, String(og));
  ok(`${lang}: every character on the page is in its font subset`, glyphs.length === 0, glyphs.slice(0, 10).join('; '));
}

// ------------------------------------------------------------ 4. axe + console (mobile/desktop × motion/static)
const axeSrc = await readFile(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
for (const [tag, dev, q] of [['m', MOBILE, ''], ['m-static', MOBILE, '?static=1'], ['d', DESKTOP, ''], ['d-static', DESKTOP, '?static=1'], ['es-m', MOBILE, 'es/'], ['es-d', DESKTOP, 'es/'], ['es-m-static', MOBILE, 'es/?static=1']]) {
  const ctx = await browser.newContext({ ...dev, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  watch(page, tag);
  await page.goto(base + '/' + q, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 3000)); });
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] }));
  const v = r.violations.map((x) => `${x.id} (${x.impact}) ×${x.nodes.length}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  ok(`axe ${tag}: 0 violations`, v.length === 0, v.join('\n      '));
  // open the language list, the booking sheet and the menu, and audit the WHOLE document each time (target-size and
  // contrast depend on what overlaps what)
  if (tag === 'm' || tag === 'es-m') {
    const TAGS = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] }, resultTypes: ['violations'] };
    const fmt = (r) => r.violations.map((x) => `${x.id} (${x.impact}) ×${x.nodes.length}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`).join('\n      ');
    await page.click('.lang__btn');
    const rl = await page.evaluate((o) => axe.run(document, o), TAGS);
    ok(`axe ${tag} language list open (whole document): 0 violations`, rl.violations.length === 0, fmt(rl));
    await page.keyboard.press('Escape');
    await page.click('#hero-cta');
    await page.waitForTimeout(450);
    const r2 = await page.evaluate((o) => axe.run(document, o), TAGS);
    ok(`axe ${tag} booking sheet open (whole document): 0 violations`, r2.violations.length === 0, fmt(r2));
    await page.keyboard.press('Escape');
    ok(`${tag}: Esc closes the sheet and focus returns to the opener`, await page.evaluate(() => !document.querySelector('#note').open && document.activeElement.id === 'hero-cta'));
    await page.click('[data-open-menu]');
    await page.waitForTimeout(400);
    const r3 = await page.evaluate((o) => axe.run(document, o), TAGS);
    ok(`${tag}: menu opens; axe (whole document) 0 violations`, (await page.locator('#menu[open]').count()) === 1 && r3.violations.length === 0, fmt(r3));
    // the CTA sits below the list (its own scroll area): it covers no link at the top, and the last link is reachable
    const cover = await page.evaluate(() => {
      const nav = document.querySelector('#menu > nav'), n = nav.getBoundingClientRect(), cta = document.querySelector('#menu > .btn--primary').getBoundingClientRect();
      const links = [...nav.querySelectorAll('a')];
      nav.scrollTop = 0;
      const hits = links.map((l) => l.getBoundingClientRect()).map((b) => ({ ...b.toJSON(), top: Math.max(b.top, n.top), bottom: Math.min(b.bottom, n.bottom) })).filter((b) => b.bottom > b.top && !(b.right <= cta.left || b.left >= cta.right || b.bottom <= cta.top || b.top >= cta.bottom)).length;
      nav.scrollTop = nav.scrollHeight;
      const last = links.at(-1), r = last.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const res = { hits, lastOk: el === last || last.contains(el), lastH: Math.round(r.height) };
      nav.scrollTop = 0;
      return res;
    });
    ok(`${tag}: menu CTA covers no link; scrolled to the end, the last link ("${tag === 'm' ? 'Questions' : 'Preguntas'}") is hit at its centre (≥ 44 px)`, cover.hits === 0 && cover.lastOk && cover.lastH >= 44, JSON.stringify(cover));
    await page.keyboard.press('Escape');
    ok(`${tag}: Esc closes the menu`, await page.evaluate(() => !document.querySelector('#menu').open));
  }
  if (tag === 'm' || tag === 'es-m') {
    // 5. position budget (English page) + small text + small targets (both)
    await page.evaluate(() => scrollTo(0, 0));
    if (tag === 'm') {
    const pos = await page.evaluate(() => {
      const H = 844, y = (el) => el ? (el.getBoundingClientRect().top + scrollY) / H : null;
      const find = (re, sel = 'p, li, h2, h3, b, span, strong') => [...document.querySelectorAll(sel)].find((e) => re.test(e.textContent) && e.offsetParent);
      return {
        price: y(document.querySelector('.price')), pickup: y(document.querySelector('.hero__pickup')),
        bedding: y(find(/Your bed is already up there/, '.legend b')), english: y(find(/mainly Spanish and a little English/, '.guides p')),
        ticket: y(document.querySelector('#ticket')), water: y(find(/4 litres of water/, '.rule, .bring li, .incl li')),
        page: document.documentElement.scrollHeight / H,
      };
    });
    const budget = { price: 0.85, pickup: 1.0, bedding: 1.6, english: 3.5, ticket: 7.0, water: 7.5, page: 18 };
    for (const [k, max] of Object.entries(budget)) ok(`position budget ${k} ≤ ${max}`, pos[k] !== null && pos[k] <= max, pos[k]?.toFixed(2));
    }
    const small = await page.evaluate(() => {
      const out = [];
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (w.nextNode()) {
        const n = w.currentNode, el = n.parentElement;
        if (!n.textContent.trim() || !el || !el.offsetParent || el.closest('svg, dialog:not([open]), .vh, [hidden], noscript, [aria-hidden="true"]')) continue; // decorative (e.g. the stamp ring) is exempt
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 13) out.push(`${fs}px "${n.textContent.trim().slice(0, 30)}"`);
      }
      return out;
    });
    ok(`${tag}: no visible text under 13 px`, small.length === 0, small.slice(0, 8).join('; '));
    const svgSmall = await page.evaluate(() => [...document.querySelectorAll('.sight__svg text')].map((t) => t.getBoundingClientRect().height).filter((h) => h < 13).length);
    ok(`${tag}: sightline labels render ≥ 13 px`, svgSmall === 0, `${svgSmall} small`);
    const targets = await page.evaluate(() => [...document.querySelectorAll('a[href], button, summary, input, label.rc, label.chip, label.check')].filter((e) => {
      if (!e.offsetParent || e.closest('dialog:not([open]), .dock:not(.is-on), .vh, .skip') || e.matches('input[type=radio], input[type=checkbox]')) return false;
      const r = e.getBoundingClientRect();
      const inline = getComputedStyle(e).display === 'inline' && e.closest('p, li') && !e.closest('nav');
      return !inline && (r.height < 43.5 || r.width < 43.5);
    }).map((e) => `${e.tagName.toLowerCase()}.${e.className} "${e.textContent.trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
    ok(`${tag}: no non-inline target under 44 px`, targets.length === 0, targets.slice(0, 10).join('; '));
  }
  await ctx.close();
}

ok('no console errors, failed requests or 4xx', errors.length === 0, errors.slice(0, 10).join('\n      '));
await browser.close();
server.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
