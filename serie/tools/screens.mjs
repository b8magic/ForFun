// Regenerates the README screenshots (docs/screens/*.png) from the web verification
// build with the in-memory test calendars. Real data is created through the UI.
//   tools/build-web.sh --e2e && node tools/screens.mjs
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('dist-web-e2e');
const OUT = path.resolve('docs/screens');
fs.mkdirSync(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };
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
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, hasTouch: true, isMobile: true })).newPage();
const $ = (id) => page.locator(`[data-testid="${id}"]`).first();
const tap = async (id, wait = 200) => {
  await $(id).scrollIntoViewIfNeeded().catch(() => {});
  await $(id).tap();
  await page.waitForTimeout(wait);
};
const fill = async (id, v) => {
  await $(id).scrollIntoViewIfNeeded().catch(() => {});
  await $(id).fill(v);
  await $(id).blur().catch(() => {});
  await page.waitForTimeout(120);
};
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
async function home() {
  await page.goto(URL);
  await $('lineup').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

await home();
// a little real history: August, September and October sessions with details
await tap('prev-month', 500);
await tap('prev-month', 500);
for (const d of ['2026-08-02', '2026-08-09', '2026-08-15', '2026-08-23', '2026-08-29']) await tap(`day-${d}`, 100);
await tap('save', 2600);
await tap('next-month', 500);
for (const d of ['2026-09-05', '2026-09-06']) await tap(`day-${d}`, 100);
await tap('details-link', 900);
await tap('details-timing-mode-interval', 300);
await fill('details-timing-start', '07:00');
await fill('details-timing-end', '08:45');
await tap('details-apply', 700);
await tap('save', 2600);
for (const d of ['2026-09-13', '2026-09-20', '2026-09-27']) await tap(`day-${d}`, 100);
await tap('save', 2600);
await tap('next-month', 500);
await tap('day-2026-10-04', 100);
await tap('save', 2600);

// 01 lineup with a live selection
for (const d of ['2026-10-06', '2026-10-08', '2026-10-10']) await tap(`day-${d}`, 160);
await page.waitForTimeout(700);
await shot('01-lineup');
// 02 the break
await $('save').tap();
await page.waitForTimeout(420);
await shot('02-wave');
await page.waitForTimeout(2600);
// 03 switcher
await tap('activity-switcher', 1000);
await shot('03-switcher');
await tap('activity-switcher', 1000);
// 04–06 history
await tap('history-handle', 1300);
await tap('month-2026-09', 700);
await tap('mini-2026-09-06', 700);
await shot('04-history-month');
await tap('scale-year', 1100);
await shot('05-history-year');
await tap('scale-all', 1300);
await shot('06-history-all');
await tap('scale-month', 500);
await tap('back-to-log', 900);
// 07 details sheet
await tap('day-2026-10-11', 160);
await tap('details-link', 900);
await fill('details-place-name', 'Bagni Fiume, Livorno');
await fill('details-place-link', 'https://www.google.com/maps/place/Livorno/@43.5485,10.3106,15z');
await tap('details-timing-mode-interval', 300);
await fill('details-timing-start', '06:30');
await fill('details-timing-end', '08:00');
await page.waitForTimeout(500);
await shot('07-details');
await tap('sheet-close', 900);
// 08 import review (in-memory test calendars)
await page.goto(URL + 'calendar');
await $('calendar-hub').waitFor({ timeout: 20000 });
await tap('connect-google', 800);
await page.goto(URL + 'calendar/import');
await $('import-activity').waitFor({ timeout: 20000 });
await tap('import-next-1', 500);
await tap('cal-sport-e2e', 200);
await tap('import-next-2', 400);
await tap('import-range-custom', 150);
await fill('import-from', '2026-08-01');
await fill('import-to', '2026-08-31');
await fill('import-title', 'surf');
await tap('import-search', 1500);
await shot('08-import-review');

await browser.close();
server.close();
console.log('screens →', OUT);
