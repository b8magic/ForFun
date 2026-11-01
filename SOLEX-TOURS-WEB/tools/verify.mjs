// Acceptance checks for site/ in headless Chromium (Playwright + axe-core).
//
//   node tools/verify.mjs [--shots=dir]
//
// 1. Booking flow: hero CTA opens the sheet, the form is filled like the FINAL_DIRECTION §6.3
//    example, and the decoded Send href must equal the expected message byte for byte.
// 2. Dock live state, past-date blocking, the "today" note, totals for every tour × {1, 8, 9, 60}.
// 3. No-JS: every wa.me link carries prefilled text; the hero href equals the spec.
// 4. axe-core (WCAG 2.2 AA tags) on mobile + desktop, motion and static; console errors / 4xx.
// 5. Position budget at 390×844, text < 13 px, targets < 44 px, page length.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
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

const EXPECTED = `Hi Alexander! I found Solex Tours on your website and I'd like to book.

Tour: Acatenango Overnight (2 days / 1 night)
Date: Sun 8 Nov 2026
People: 3
Pickup: Café Condesa, Parque Central (Antigua)
After the tour: heading on toward Panajachel
Extras: porter up (13 kg), rent: headlamp
Name: Maria

Website price: Q750 per person = Q2,250 total (≈ US$300).
Is there space? Could you confirm the pickup time? Thank you!

(ES) Hola Alexander: Tour 2D/1N (acampar) · dom 08/11/2026 · 3 personas · Café Condesa · Total Q2,250 · después: Panajachel · extras: porteador subida, alquiler: linterna`;
const HERO_HREF = 'https://wa.me/50248347003?text=Hi%20Alexander%21%20I%27d%20like%20to%20check%20a%20date%20for%20the%20Acatenango%20Overnight%20%282%20days%20%2F%201%20night%2C%20Q750%20per%20person%29.%0ADate%3A%20%0APeople%3A%20%0APickup%3A%20Caf%C3%A9%20Condesa%20or%20Caf%C3%A9%20La%20Parada';

// ------------------------------------------------------------ 1–2. booking flow (mobile)
{
  const ctx = await browser.newContext({ ...MOBILE, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  watch(page, 'flow');
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('#hero-cta');
  ok('hero CTA opens the booking sheet in place', await page.locator('dialog#note[open]').count() === 1 && (await page.evaluate(() => scrollY)) < 50);
  await page.fill('#f-date', '2026-11-08');
  await page.dispatchEvent('#f-date', 'change');
  await page.click('#note [data-step="1"]');
  await page.click('#note label.rc:has(input[value="condesa"])');
  await page.click('#note label.rc:has(input[value="pana"])');
  await page.click('#note label.chip:has(input[value="porterUp"])');
  await page.click('#note label.chip:has(input[value="headlamp"])');
  await page.fill('#f-name', 'Maria');
  const href = await page.getAttribute('#send', 'href');
  const msg = decodeURIComponent(href.split('?text=')[1]);
  ok('Send href → wa.me/50248347003', href.startsWith('https://wa.me/50248347003?text='));
  ok('message matches §6.3 byte for byte', msg === EXPECTED, msg === EXPECTED ? '' : '\n--- got ---\n' + msg);
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
  ok('dock live text', dock.l1 === 'Sun 8 Nov · 3 people' && dock.l2 === 'Q2,250 ≈ US$300');
  ok('dock Send = same message', decodeURIComponent(dock.href.split('?text=')[1]) === EXPECTED);
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
  ok('After-the-tour hidden for non-overnight tours', await page.isHidden('[data-after]'));
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
  ok('no-JS: hero href equals the spec', (await page.getAttribute('#hero-cta', 'href')) === HERO_HREF);
  const bookHrefs = await page.$$eval('[data-book]', (as) => as.map((a) => a.getAttribute('href')));
  ok('no-JS: every booking entry point is a wa.me link', bookHrefs.every((h) => h && h.startsWith('https://wa.me/')), `${bookHrefs.length} entry points`);
  ok('no-JS: door figures stacked, all visible', await page.evaluate(() => [...document.querySelectorAll('.door figure')].every((f) => getComputedStyle(f).opacity === '1' && f.getBoundingClientRect().height > 200)));
  await ctx.close();
}

// ------------------------------------------------------------ 4. axe + console (mobile/desktop × motion/static)
const axeSrc = await readFile(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
for (const [tag, dev, q] of [['m', MOBILE, ''], ['m-static', MOBILE, '?static=1'], ['d', DESKTOP, ''], ['d-static', DESKTOP, '?static=1']]) {
  const ctx = await browser.newContext({ ...dev, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  watch(page, tag);
  await page.goto(base + '/' + q, { waitUntil: 'networkidle' });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.7) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 3000)); });
  await page.addScriptTag({ content: axeSrc });
  const r = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] }));
  const v = r.violations.map((x) => `${x.id} (${x.impact}) ×${x.nodes.length}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
  ok(`axe ${tag}: 0 violations`, v.length === 0, v.join('\n      '));
  // open dialogs and audit them too
  if (tag === 'm') {
    await page.click('#hero-cta');
    const r2 = await page.evaluate(() => axe.run(document.querySelector('#note'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } }));
    ok('axe booking sheet open: 0 violations', r2.violations.length === 0, r2.violations.map((x) => `${x.id} ×${x.nodes.length}: ${x.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`).join('\n      '));
    await page.keyboard.press('Escape');
    ok('Esc closes the sheet and focus returns to the opener', await page.evaluate(() => !document.querySelector('#note').open && document.activeElement.id === 'hero-cta'));
    await page.click('[data-open-menu]');
    const r3 = await page.evaluate(() => axe.run(document.querySelector('#menu'), { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
    ok('menu opens; axe 0 violations', (await page.locator('#menu[open]').count()) === 1 && r3.violations.length === 0, r3.violations.map((x) => x.id).join(', '));
    await page.keyboard.press('Escape');
  }
  if (tag === 'm') {
    // 5. position budget + small text + small targets
    await page.evaluate(() => scrollTo(0, 0));
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
    ok('no visible text under 13 px', small.length === 0, small.slice(0, 8).join('; '));
    const svgSmall = await page.evaluate(() => [...document.querySelectorAll('.sight__svg text')].map((t) => t.getBoundingClientRect().height).filter((h) => h < 13).length);
    ok('sightline labels render ≥ 13 px', svgSmall === 0, `${svgSmall} small`);
    const targets = await page.evaluate(() => [...document.querySelectorAll('a[href], button, summary, input, label.rc, label.chip, label.check')].filter((e) => {
      if (!e.offsetParent || e.closest('dialog:not([open]), .dock:not(.is-on), .vh, .skip') || e.matches('input[type=radio], input[type=checkbox]')) return false;
      const r = e.getBoundingClientRect();
      const inline = getComputedStyle(e).display === 'inline' && e.closest('p, li') && !e.closest('nav');
      return !inline && (r.height < 43.5 || r.width < 43.5);
    }).map((e) => `${e.tagName.toLowerCase()}.${e.className} "${e.textContent.trim().slice(0, 24)}" ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
    ok('no non-inline target under 44 px', targets.length === 0, targets.slice(0, 10).join('; '));
  }
  await ctx.close();
}

ok('no console errors, failed requests or 4xx', errors.length === 0, errors.slice(0, 10).join('\n      '));
await browser.close();
server.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exitCode = failed.length ? 1 : 0;
