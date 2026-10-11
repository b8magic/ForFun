// End-to-end verification of calendar import / export / automatic export on the
// web build with the in-memory TEST calendars (src/calendar/memory.ts).
//   tools/build-web.sh --e2e && node tools/e2e-calendar.mjs
// This proves the UI + engines + local database together. It does NOT prove
// Google OAuth or EventKit on a device (see README status matrix).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('dist-web-e2e');
const SHOTS = process.env.E2E_SHOTS || path.resolve('/tmp/claude-0/-home-user-ForFun/95d9cc13-7e3c-5b9b-9777-89259157d415/scratchpad/e2e-cal');
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
const text = async (id) => (await $(id).innerText()).trim();
const visible = async (id, timeout = 15000) => $(id).waitFor({ state: 'visible', timeout });
const fill = async (id, v) => {
  await $(id).fill(v);
  await page.waitForTimeout(120);
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
async function go(route) {
  await page.goto(URL + route);
  await page.waitForTimeout(1500);
}
async function importSearch({ calendars, from, to, title = '', labels = [] }) {
  await go('calendar/import');
  await visible('import-activity');
  await tap('import-next-1', 500);
  await visible('import-source');
  for (const c of calendars) await tap(`cal-${c}`, 150);
  await tap('import-next-2', 400);
  await visible('import-filters');
  await tap('import-range-custom', 150);
  await fill('import-from', from);
  await fill('import-to', to);
  if (title) await fill('import-title', title);
  for (const l of labels) await tap(`label-${l}`, 120);
  await tap('import-search', 1200);
  await visible('import-review');
}

await page.goto(URL);
await $('lineup').waitFor({ timeout: 30000 });
await page.waitForTimeout(1200);

await check('two manual Surf sessions are saved in September', async () => {
  await tap('prev-month', 500);
  await tap('day-2026-09-06', 150);
  await tap('day-2026-09-13', 150);
  await tap('save', 2400);
  assert(/1 sessione registrata/.test((await $('day-2026-09-13').getAttribute('aria-label')) ?? ''), 'saved');
});

await check('calendar hub opens from the menu and asks nothing until Collega', async () => {
  await tap('menu', 700);
  await tap('menu-calendars', 900);
  await visible('calendar-hub');
  assert(/build E2E|Non collegato/.test(await text('conn-google')), `google status: ${await text('conn-google')}`);
  await tap('connect-google', 700);
  assert(/prova@e2e\.local/.test(await text('conn-google')), `after connect: ${await text('conn-google')}`);
  await page.screenshot({ path: path.join(SHOTS, '01-hub.png') });
});

await check('import: title-only filter, durations, multi-day mapping, scoped selection, confirm', async () => {
  await importSearch({ calendars: ['sport-e2e'], from: '2026-08-01', to: '2026-08-31', title: 'surf' });
  await page.screenshot({ path: path.join(SHOTS, '02-import-review.png') });
  assert((await text('import-count')) === '4 di 4 selezionati', `count: ${await text('import-count')}`);
  const b = await body();
  assert(!/Corsa lungo mare/.test(b), 'non-matching title must not appear');
  assert(/1 h 30 min/.test(b), 'timed interval shows its known duration');
  assert(/Durata non specificata/.test(b), 'all-day event shows unknown duration');
  assert(/più giorni/i.test(b), 'multi-day mapping is disclosed');
  await page.locator('[data-testid^="import-toggle-"]', { hasText: 'Surfskate' }).first().tap();
  await page.waitForTimeout(200);
  assert((await text('import-count')) === '3 di 4 selezionati', `after deselect: ${await text('import-count')}`);
  await tap('import-scope-new', 200);
  await tap('import-select-all', 200);
  assert((await text('import-count')) === '4 di 4 selezionati', 'select-all in scope');
  await tap('import-select-all', 200);
  assert((await text('import-count')) === '0 di 4 selezionati', 'deselect-all in scope');
  await tap('import-scope-all', 200);
  for (const t of ['Surf all’alba', 'SURF lesson', 'Surf trip Portogallo']) await page.locator('[data-testid^="import-toggle-"]', { hasText: t }).first().tap();
  await page.waitForTimeout(200);
  assert((await text('import-count')) === '3 di 4 selezionati', `before confirm: ${await text('import-count')}`);
  await tap('import-confirm', 1500);
  await visible('import-done');
  assert(/3 sessioni importate in Surf/.test(await body()), 'result line');
  await page.screenshot({ path: path.join(SHOTS, '03-import-done.png') });
});

await check('import again: already imported events are recognised and not selectable', async () => {
  await importSearch({ calendars: ['sport-e2e'], from: '2026-08-01', to: '2026-08-31', title: 'surf' });
  // the 3 imported ones are excluded; only the event left out last time is selectable
  assert((await text('import-count')) === '1 di 1 selezionati', `count: ${await text('import-count')}`);
  assert(/Già importato/.test(await body()), 'status shown');
});

await check('import: title filter ignores notes; zero-length event keeps only its start', async () => {
  await importSearch({ calendars: ['primary-e2e'], from: '2026-08-01', to: '2026-08-31', title: 'SURF' });
  const b = await body();
  assert(!/Cena con amici/.test(b), '"surf" only in notes must not match');
  assert(/coincidono|solo l’ora di inizio/i.test(b), 'zero-length disclosure');
});

await check('import: label filter (Google only) and recurring occurrences without the cancelled one', async () => {
  await importSearch({ calendars: ['sport-e2e'], from: '2026-08-01', to: '2026-09-30', labels: ['7'] });
  const b = await body();
  assert(/Surf trip Portogallo/.test(b) && !/SURF lesson/.test(b) && !/Corsa lungo mare/.test(b), 'only label 7');
  await importSearch({ calendars: ['sport-e2e'], from: '2026-08-01', to: '2026-09-30', title: 'corsa' });
  const items = await page.locator('[data-testid^="import-toggle-"]', { hasText: 'Corsa lungo mare' }).count();
  assert(items === 6, `6 occurrences listed (got ${items})`);
  assert((await text('import-count')) === '5 di 5 selezionati', `cancelled excluded: ${await text('import-count')}`);
});

await check('export: equivalent Google/iPhone destinations are blocked, then exported to Google', async () => {
  await go('calendar');
  await visible('calendar-hub');
  await tap('connect-apple', 700);
  await go('calendar/export');
  await visible('export-activity');
  await tap('export-next-1', 500);
  await visible('export-dest');
  await tap('provider-apple', 400);
  await page.waitForTimeout(600);
  await tap('dest-google-sport-e2e', 200);
  await tap('dest-apple-ek-sport-e2e', 300);
  assert(/stesso calendario/.test(await body()), 'equivalence warning');
  assert((await $('export-next-2').getAttribute('aria-disabled')) === 'true', 'continue blocked');
  await page.screenshot({ path: path.join(SHOTS, '04-export-equivalent.png') });
  await tap('export-only-google', 400);
  await tap('dest-google-sport-e2e', 200);
  await tap('export-next-2', 500);
  await visible('export-options');
  await fill('export-prefix', '🏄 ');
  assert((await text('export-title-preview')).replace(/ /g, ' ') === '🏄 Surf', `preview: ${await text('export-title-preview')}`);
  await tap('export-next-3', 2000);
  await visible('export-review');
  await page.screenshot({ path: path.join(SHOTS, '05-export-review.png') });
  // 2 manual sessions are new; 3 imported from this calendar are recognised as their own source
  assert((await text('export-count')) === '2 di 5 selezionati', `count: ${await text('export-count')}`);
  await tap('export-confirm', 2500);
  await visible('export-done');
  const r = await text('export-result-google');
  assert(/2\s*CREATI/.test(r), `results: ${r}`);
  await page.screenshot({ path: path.join(SHOTS, '06-export-done.png') });
});

await check('export again: already exported sessions are not recreated', async () => {
  await go('calendar/export');
  await tap('export-next-1', 500);
  await page.waitForTimeout(600);
  await tap('dest-google-sport-e2e', 200);
  await tap('export-next-2', 500);
  await fill('export-prefix', '🏄 ');
  await tap('export-next-3', 2000);
  await visible('export-review');
  assert((await text('export-count')) === '0 di 5 selezionati', `count: ${await text('export-count')}`);
  assert(/Già esportato/.test(await body()), 'identical export → already exported');
  // a different title is a difference to review (explicit update), never a silent rewrite
  await tap('export-filter-all', 200);
  await tap('wizard-back', 600);
  await fill('export-prefix', '');
  await tap('export-next-3', 2000);
  assert((await text('export-count')) === '0 di 5 selezionati', 'nothing selected by default');
  assert(/Evento collegato modificato/.test(await body()) && /impostazione di esportazione/.test(await body()), 'difference disclosed');
});

await check('automatic export: off by default, enabled with a destination, runs after a save', async () => {
  await go('calendar/auto');
  await visible('auto-export');
  assert((await $('auto-enabled').getAttribute('aria-checked')) === 'false', 'off by default');
  await tap('auto-google-primary-e2e', 500);
  await tap('auto-enabled', 600);
  assert((await $('auto-enabled').getAttribute('aria-checked')) === 'true', 'enabled');
  await go('');
  await $('lineup').waitFor({ timeout: 30000 });
  await page.waitForTimeout(800);
  await tap('prev-month', 500);
  await tap('day-2026-09-20', 150);
  await tap('save', 2400);
  await page.waitForTimeout(9000);
  await go('calendar/jobs');
  await visible('jobs');
  await tap('jobs-filter-done', 400);
  assert(/accettato dal calendario/i.test(await body()) && /AUTOMATICA/.test(await body()), 'auto job accepted');
  assert(/sincronizzazione con il cloud dipende/.test(await body()), 'not-cloud disclosure');
  await page.screenshot({ path: path.join(SHOTS, '07-jobs.png') });
});

console.log(`\n${results.filter((r) => r.ok).length}/${results.length} checks passed`);
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
fs.writeFileSync(path.join(SHOTS, 'results.json'), JSON.stringify({ results, errors: [...new Set(errors)] }, null, 2));
await browser.close();
server.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
