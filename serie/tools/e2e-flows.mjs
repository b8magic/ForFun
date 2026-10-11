// End-to-end verification of the core journeys on the web build (headless Chromium):
// optional details & the four timing states (statistics acceptance test through the UI),
// the same duration applied to several dates, session edit & delete, activity management,
// the deleted remembered activity, month jump, and reduced motion.
//   tools/build-web.sh [--e2e] && node tools/e2e-flows.mjs   (E2E_ROOT=dist-web-e2e to use the e2e bundle)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(process.env.E2E_ROOT || 'dist-web');
const SHOTS = process.env.E2E_SHOTS || path.resolve('/tmp/claude-0/-home-user-ForFun/95d9cc13-7e3c-5b9b-9777-89259157d415/scratchpad/e2e-flows');
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
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

const results = [];
const $ = (id) => page.locator(`[data-testid="${id}"]`).first();
const tap = async (id, wait = 250) => {
  await $(id).scrollIntoViewIfNeeded().catch(() => {});
  await $(id).tap();
  await page.waitForTimeout(wait);
};
const label = async (id) => (await $(id).getAttribute('aria-label')) ?? '';
const text = async (id) => (await $(id).innerText()).trim();
const fill = async (id, v) => {
  await $(id).scrollIntoViewIfNeeded().catch(() => {});
  await $(id).fill(v);
  await $(id).blur().catch(() => {});
  await page.waitForTimeout(150);
};
const body = async () => page.locator('body').innerText();
function assert(c, msg) {
  if (!c) throw new Error(msg);
}
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: String(e?.message ?? e).slice(0, 500) });
    console.log(`✗ ${name}\n   ${String(e?.message ?? e).slice(0, 500)}`);
    await page.screenshot({ path: path.join(SHOTS, `fail-${name.replace(/\W+/g, '_')}.png`) }).catch(() => {});
  }
}
async function home() {
  await page.goto(URL);
  await $('lineup').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1200);
}
async function switchTo(name) {
  await tap('activity-switcher', 900);
  await tap(`activity-${name}`, 1300);
  assert(new RegExp(`Attività attiva: ${name}`).test(await label('activity-switcher')), `now ${name}`);
}
async function details(fn) {
  await tap('details-link', 900);
  await $('details-sheet').waitFor({ timeout: 8000 });
  await fn();
  await tap('details-apply', 700);
}
async function save() {
  await tap('save', 2400);
}
async function monthLabel(key) {
  await tap('history-handle', 1200);
  const l = (await $(`month-${key}`).getAttribute('aria-label')) ?? '';
  return l;
}
async function backToLog() {
  await tap('back-to-log', 900);
}
async function openSession(key, date, nth = 0) {
  if (!(await $(`mini-${date}`).isVisible().catch(() => false))) await tap(`month-${key}`, 600);
  await tap(`mini-${date}`, 600);
  await page.locator('[data-testid^="session-"]').filter({ hasNotText: '__' }).nth(nth).tap();
  await page.waitForTimeout(900);
  await $('session-editor').waitFor({ timeout: 8000 });
}

await home();

await check('statistics acceptance: date-only, start-only 08:00, 09:00–11:00, 1.5 h → 4 sessions, 3 h 30 min, 2 of 4', async () => {
  await switchTo('Allenamento');
  await tap('prev-month', 500);
  await tap('day-2026-09-01', 150);
  await save();
  await tap('day-2026-09-02', 150);
  await details(async () => {
    await tap('details-timing-mode-start_only', 300);
    await fill('details-timing-start', '08:00');
  });
  await save();
  await tap('day-2026-09-03', 150);
  await details(async () => {
    await tap('details-timing-mode-interval', 300);
    await fill('details-timing-start', '09:00');
    await fill('details-timing-end', '11:00');
  });
  await save();
  await tap('day-2026-09-04', 150);
  await details(async () => {
    await tap('details-timing-mode-duration_only', 300);
    await fill('details-timing-duration', '1,5');
  });
  await save();
  const l = await monthLabel('2026-09');
  await page.screenshot({ path: path.join(SHOTS, '01-acceptance-history.png') });
  assert(/4 sessioni · 4 giorni attivi/.test(l), `counts: ${l}`);
  assert(/3 h 30 min registrate/.test(l), `hours: ${l}`);
  assert(/durata disponibile per 2 di 4 sessioni/.test(l), `coverage: ${l}`);
});

await check('editing the interval to start-only updates totals and coverage (1 h 30 min, 1 of 4)', async () => {
  await openSession('2026-09', '2026-09-03');
  await tap('session-timing-mode-start_only', 400);
  if (await $('session-timing-confirm').isVisible().catch(() => false)) await tap('session-timing-confirm', 400);
  await tap('session-save', 1200);
  await page.waitForTimeout(600);
  const l = (await $('month-2026-09').getAttribute('aria-label')) ?? '';
  assert(/1 h 30 min registrate/.test(l) && /1 di 4/.test(l), `after edit: ${l}`);
});

await check('deleting the duration-only session leaves no known duration (honest empty state)', async () => {
  await home();
  await tap('history-handle', 1200);
  await openSession('2026-09', '2026-09-04');
  await tap('session-delete', 500);
  await tap('session-delete-yes', 1200);
  await page.waitForTimeout(600);
  const l = (await $('month-2026-09').getAttribute('aria-label')) ?? '';
  assert(/3 sessioni/.test(l) && /Nessuna durata registrata/.test(l), `after delete: ${l}`);
  await backToLog();
});

await check('one duration applied to two dates gives each session its own 1 h (2 h, 2 of 2)', async () => {
  await home();
  await tap('day-2026-10-05', 150);
  await tap('day-2026-10-06', 150);
  await details(async () => {
    await tap('details-timing-mode-duration_only', 300);
    await fill('details-timing-duration', '1');
  });
  assert(/Salva 2 sessioni/.test(await text('save')), await text('save'));
  await save();
  const l = await monthLabel('2026-10');
  assert(/2 sessioni/.test(l) && /2 h registrate/.test(l) && /2 di 2/.test(l), `october: ${l}`);
  await backToLog();
});

await check('details are not reused after saving: the next save is date-only', async () => {
  await home();
  await tap('day-2026-10-07', 150);
  await save();
  const l = await monthLabel('2026-10');
  assert(/3 sessioni/.test(l) && /2 di 3/.test(l), `october after plain save: ${l}`);
  await backToLog();
});

await check('activities: create Nuoto, reject a duplicate name, use it', async () => {
  await home();
  await tap('menu', 700);
  await tap('menu-activities', 900);
  await $('activities-sheet').waitFor({ timeout: 8000 });
  await tap('activity-new', 600);
  await fill('activity-name', 'surf');
  await tap('activity-submit', 600);
  assert(/esiste già|già/.test(await body()), 'duplicate name rejected');
  await fill('activity-name', 'Nuoto');
  await tap('activity-submit', 900);
  assert(await $('manage-activity-Nuoto').isVisible(), 'Nuoto listed');
  await page.screenshot({ path: path.join(SHOTS, '02-activities.png') });
  await tap('manage-activity-Nuoto', 700);
  await tap('activity-use', 1500);
  await home();
  assert(/Attività attiva: Nuoto/.test(await label('activity-switcher')), 'relaunch into Nuoto');
});

await check('deleting the remembered activity falls back safely, with a notice, also after restart', async () => {
  await home();
  await tap('menu', 700);
  await tap('menu-activities', 900);
  await tap('manage-activity-Nuoto', 700);
  await tap('activity-delete', 700);
  await tap('delete-confirm', 1500);
  await home();
  const l = await label('activity-switcher');
  assert(/Attività attiva: /.test(l) && !/Nuoto/.test(l), `fallback: ${l}`);
  assert((await text('save')).toUpperCase().includes('SELEZIONA'), 'no stale selection');
});

await check('month jump: Marzo 2025 from the month title', async () => {
  await home();
  await tap('month-title', 900);
  await $('jump-sheet').waitFor({ timeout: 8000 });
  if (!(await $('jump-year-2025').isVisible().catch(() => false))) await tap('jump-earlier', 400);
  await tap('jump-year-2025', 400);
  await tap('jump-month-3', 1200);
  const l = await label('month-title');
  assert(/Marzo 2025/.test(l), `month title: ${l}`);
  await tap('day-2025-03-15', 150);
  assert(/Salva 1 sessione/.test(await text('save')), 'past dates selectable after jump');
});

await check('reduced motion: preference persists and saving still works', async () => {
  await home();
  await tap('menu', 700);
  await tap('motion-pref-reduced', 500);
  await tap('sheet-close', 900);
  await tap('day-2026-10-08', 150);
  await save();
  assert(/1 sessione registrata/.test(await label('day-2026-10-08')), 'saved with reduced motion');
  await home();
  await tap('menu', 700);
  assert((await $('motion-pref-reduced').getAttribute('aria-checked')) === 'true', 'preference persisted');
  await tap('sheet-close', 700);
});

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ results, errors: [...new Set(errors)] }, null, 2));
await browser.close();
server.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
