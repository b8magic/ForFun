// Interaction screenshots: the Cabin Door at afternoon / sunset / after dark (mobile + desktop),
// the menu, and the timeline at night. (The booking sheet and live dock are saved by verify.mjs --shots=…)
//
//   node tools/shoot-states.mjs [outDir]
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const out = path.resolve(process.argv[2] ?? path.join(ROOT, 'docs/screens'));
await mkdir(out, { recursive: true });
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(p)] ?? 'application/octet-stream' }).end(await readFile(path.join(SITE, p))); }
  catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await playwright.chromium.launch();
const DEV = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1440, height: 900 } },
};
for (const [k, dev] of Object.entries(DEV)) {
  const ctx = await browser.newContext({ ...dev, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  for (const [i, name] of [[1, 'afternoon'], [2, 'sunset'], [3, 'night']]) {
    await page.evaluate((i) => {
      const z = document.querySelectorAll('.door__zone')[i - 1].getBoundingClientRect();
      scrollTo({ top: scrollY + z.top + z.height * (i === 3 ? 0.3 : 0.5) - innerHeight / 2, behavior: 'instant' });
    }, i);
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.join(out, `${k}-door-${name}.png`) });
  }
  await page.evaluate(() => { const s = document.querySelector('.seg--night').getBoundingClientRect(); scrollTo({ top: scrollY + s.top + s.height / 2 - innerHeight / 2, behavior: 'instant' }); });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, `${k}-timeline-night.png`) });
  if (k === 'm') {
    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(300);
    await page.click('[data-open-menu]');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(out, 'm-menu.png') });
  }
  await ctx.close();
}
await browser.close();
server.close();
console.log('state screens →', out);
