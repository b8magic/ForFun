// End-to-end verification of the Serie web build (headless Chromium).
// Each check drives the real UI and asserts on what the user would see.
//   node tools/e2e.mjs            (expects dist-web built by tools/build-web.sh)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('dist-web');
const SHOTS = process.env.E2E_SHOTS || path.resolve('/tmp/claude-0/-home-user-ForFun/95d9cc13-7e3c-5b9b-9777-89259157d415/scratchpad/e2e');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const results = [];
let ctx, page;
const errors = [];
async function fresh() {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.locator('[data-testid="lineup"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}
async function reload() {
  await page.reload();
  await page.locator('[data-testid="lineup"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}
const $ = (id) => page.locator(`[data-testid="${id}"]`).first();
const tap = async (id, wait = 180) => {
  await $(id).tap();
  await page.waitForTimeout(wait);
};
const text = async (id) => (await $(id).innerText()).trim();
const label = async (id) => (await $(id).getAttribute('aria-label')) ?? '';
async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - t0 });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: String(e?.message ?? e).slice(0, 400) });
    console.log(`✗ ${name}\n   ${String(e?.message ?? e).slice(0, 400)}`);
    await page.screenshot({ path: path.join(SHOTS, `fail-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
}
function assert(c, msg) {
  if (!c) throw new Error(msg);
}
async function save(wait = 2300) {
  await tap('save', wait);
}

await fresh();

await check('first launch opens directly in Surf, ready to select dates', async () => {
  const l = await label('activity-switcher');
  assert(/Attività attiva: Surf/.test(l), `switcher label: ${l}`);
  assert((await text('save')).toUpperCase().includes('SELEZIONA LE DATE'), 'save should be disabled with "Seleziona le date"');
  await page.screenshot({ path: path.join(SHOTS, '01-first-launch.png') });
});

await check('multi-date selection with no details saves immediately', async () => {
  await tap('prev-month', 500);
  for (const d of ['2026-09-03', '2026-09-10', '2026-09-24']) await tap(`day-${d}`, 140);
  assert((await text('save')).includes('Salva 3 sessioni'), `save label: ${await text('save')}`);
  await save();
  assert((await text('save')).toUpperCase().includes('SELEZIONA'), 'selection must be cleared after saving');
  const l = await label('day-2026-09-10');
  assert(/1 sessione registrata/.test(l), `day label after save: ${l}`);
});

await check('saved sessions survive a restart; old selections are not reused', async () => {
  await tap('day-2026-09-17', 140); // leave a pending selection, then restart
  await reload();
  assert(/Attività attiva: Surf/.test(await label('activity-switcher')), 'still Surf');
  assert((await text('save')).toUpperCase().includes('SELEZIONA'), 'pending selection must not survive a restart');
  await tap('prev-month', 500);
  assert(/1 sessione registrata/.test(await label('day-2026-09-10')), 'session persisted');
  assert(!/selezionato/.test(await label('day-2026-09-17')), 'stale selection');
});

await check('double tap on Save does not duplicate sessions', async () => {
  await tap('day-2026-09-05', 140);
  await $('save').tap();
  await $('save').tap().catch(() => {});
  await page.waitForTimeout(2400);
  const l = await label('day-2026-09-05');
  assert(/1 sessione registrata/.test(l), `expected exactly one session, got: ${l}`);
});

await check('a deliberate second session on the same date is allowed', async () => {
  await tap('day-2026-09-05', 140);
  await save();
  assert(/2 sessioni registrate/.test(await label('day-2026-09-05')), await label('day-2026-09-05'));
});

await check('future dates cannot be selected', async () => {
  await tap('next-month', 500);
  const l = await label('day-2026-10-30');
  assert(/data futura/.test(l), `future label: ${l}`);
  await $('day-2026-10-30').tap({ force: true }).catch(() => {});
  assert(!/Salva/.test(await text('save')), 'future date selected');
});

await check('switching activity persists across restart and clears selection', async () => {
  await tap('day-2026-10-01', 140);
  await tap('activity-switcher', 900);
  await page.screenshot({ path: path.join(SHOTS, '02-switcher.png') });
  await tap('activity-Corsa', 1300);
  assert(/Attività attiva: Corsa/.test(await label('activity-switcher')), 'now Corsa');
  assert((await text('save')).toUpperCase().includes('SELEZIONA'), 'selection must not carry across activities');
  await reload();
  assert(/Attività attiva: Corsa/.test(await label('activity-switcher')), 'relaunch in Corsa');
  await tap('day-2026-10-02', 140);
  await save();
  await tap('activity-switcher', 900);
  await tap('activity-Surf', 1300);
});

await check('history month mode shows exact counts and honest durations', async () => {
  await tap('history-handle', 1200);
  await page.screenshot({ path: path.join(SHOTS, '03-history-month.png') });
  const sep = await page.locator('[data-testid="month-2026-09"]').getAttribute('aria-label');
  assert(/Settembre 2026: 5 sessioni · 4 giorni attivi/.test(sep ?? ''), `sep label: ${sep}`);
  assert(/Nessuna durata registrata/.test(sep ?? ''), 'no durations yet');
  await tap('month-2026-09', 600);
  await tap('mini-2026-09-05', 500);
  const vis = await page.locator('[data-testid="time-place"]').innerText();
  assert(/Sessioni del sabato 5 settembre 2026/i.test(vis), 'day panel');
  await page.screenshot({ path: path.join(SHOTS, '04-history-day.png') });
});

await check('year mode shows annual totals and a month drill-down', async () => {
  await tap('scale-year', 900);
  const y = await page.locator('[data-testid="time-place"]').innerText();
  assert(/2026/.test(y), 'year 2026 visible');
  await page.screenshot({ path: path.join(SHOTS, '05-history-year.png') });
  await tap('year-month-2026-09', 1000);
  const vis = await page.locator('[data-testid="time-place"]').innerText();
  assert(/Settembre 2026/.test(vis), 'drilled into September');
});

await check('all-time view renders progress from real data', async () => {
  await tap('scale-all', 1200);
  await page.screenshot({ path: path.join(SHOTS, '06-history-all.png') });
  const vis = await page.locator('[data-testid="time-place"]').innerText();
  assert(/SESSIONI TOTALI/i.test(vis) && /TRAGUARDI/i.test(vis), 'progress blocks');
  await tap('scale-month', 600);
  await tap('back-to-log', 900);
});

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ results, errors: [...new Set(errors)] }, null, 2));
await browser.close();
server.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
