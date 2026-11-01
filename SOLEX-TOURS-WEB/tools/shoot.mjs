// Screenshots of site/ in headless Chromium (Playwright).
//
//   node tools/shoot.mjs [outDir] [--full] [--only=m,d] [--path=/index.html#tours]
//
// Serves site/ on a free local port, waits for fonts and images, scrolls the page once so
// lazy images and reveal-on-scroll elements are in their final state, then captures:
//   m  390×844 @2x, touch (iPhone 12–15 size)      t  820×1180 (iPad portrait)
//   s  360×780 @2x, touch (small Android)          d  1440×900 desktop
// Playwright is preinstalled in this environment (require('playwright') resolves globally).
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const args = process.argv.slice(2);
const outDir = path.resolve(args.find((a) => !a.startsWith('--')) ?? path.join(ROOT, 'docs/screens'));
const full = args.includes('--full');
const only = (args.find((a) => a.startsWith('--only=')) ?? '--only=m,d').slice(7).split(',');
const urlPath = (args.find((a) => a.startsWith('--path=')) ?? '--path=/').slice(7);

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.xml': 'application/xml' };
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(SITE, path.normalize(p));
  if (!file.startsWith(SITE)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const DEVICES = {
  m: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  s: { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  t: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true },
  d: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

await mkdir(outDir, { recursive: true });
const browser = await playwright.chromium.launch();
const errors = [];
for (const key of only) {
  const ctx = await browser.newContext({ ...DEVICES[key], reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${key}] pageerror ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${key}] console ${m.text()}`));
  page.on('requestfailed', (r) => errors.push(`[${key}] requestfailed ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`[${key}] ${r.status()} ${r.url()}`));
  await page.goto(base + urlPath, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {});
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(outDir, `${key}-first.png`) });
  if (full) {
    // Walk down the page so lazy media load and reveal animations settle, then back to the top.
    await page.evaluate(async () => {
      const step = innerHeight * 0.6;
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 120));
      }
      scrollTo({ top: 0, behavior: 'instant' });
      await new Promise((r) => setTimeout(r, 400));
    });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    // Wait only for images that are actually rendered (lazy images inside display:none never load).
    await page.evaluate(() => Promise.race([
      Promise.all([...document.images].filter((i) => !i.complete && i.getClientRects().length).map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
      new Promise((r) => setTimeout(r, 8000)),
    ]));
    await page.screenshot({ path: path.join(outDir, `${key}-full.png`), fullPage: true });
  }
  await ctx.close();
}
await browser.close();
server.close();
if (errors.length) console.log(errors.join('\n'));
console.log(`screens → ${outDir}`);
