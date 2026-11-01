// Rough lab numbers in headless Chromium: Slow-4G-like network (150 ms RTT, 1.6 Mbps) + 4× CPU,
// 390×844 @2x. Reports LCP, CLS, bytes until LCP, bytes after a full scroll (excluding video) and
// a size table of the built assets.
//
//   node tools/perf.mjs
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const GZ = new Set(['.html', '.css', '.js', '.svg', '.webmanifest']);
const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    let body = await readFile(path.join(SITE, p));
    const ext = path.extname(p), h = { 'content-type': TYPES[ext] ?? 'application/octet-stream' };
    if (GZ.has(ext)) { body = gzipSync(body, { level: 9 }); h['content-encoding'] = 'gzip'; }
    res.writeHead(200, h).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;
const browser = await playwright.chromium.launch();

for (const [label, dev] of [['mobile 390', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['desktop 1440', { viewport: { width: 1440, height: 900 } }]]) {
  const ctx = await browser.newContext({ ...dev, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (label.startsWith('mobile')) {
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8 });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }
  const reqs = [];
  cdp.on('Network.loadingFinished', (e) => reqs.push({ id: e.requestId, bytes: e.encodedDataLength, t: e.timestamp }));
  const urls = {};
  cdp.on('Network.responseReceived', (e) => { urls[e.requestId] = e.response.url; });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  const t0 = Date.now();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  const lcp = await page.evaluate(() => window.__lcp);
  const nav = await page.evaluate(() => performance.timeOrigin);
  const lcpAbs = nav / 1000 + lcp / 1000; // seconds (approximately aligned with CDP timestamps)
  const firstLoad = reqs.reduce((a, r) => a + r.bytes, 0);
  const clsTop = await page.evaluate(() => window.__cls);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * 0.7) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 150)); } });
  await page.waitForTimeout(2500);
  const all = reqs.filter((r) => !/\.(mp4|webm)(\?|$)/.test(urls[r.id] ?? ''));
  const total = all.reduce((a, r) => a + r.bytes, 0);
  const video = reqs.filter((r) => /\.(mp4|webm)/.test(urls[r.id] ?? '')).reduce((a, r) => a + r.bytes, 0);
  const lcpEl = await page.evaluate(() => 0);
  console.log(`${label}: LCP ${(lcp / 1000).toFixed(2)} s · CLS (load) ${clsTop.toFixed(3)} · first load ${(firstLoad / 1024).toFixed(0)} KB · full scroll excl. video ${(total / 1024).toFixed(0)} KB (video ${(video / 1024).toFixed(0)} KB) · ${all.length} requests`);
  void lcpAbs; void lcpEl; void t0;
  await ctx.close();
}
await browser.close();
server.close();

// size table
const gz = async (f) => gzipSync(await readFile(path.join(SITE, f)), { level: 9 }).length;
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const html = await readFile(path.join(SITE, 'index.html'), 'utf8');
const crit = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const fonts = await readdir(path.join(SITE, 'assets/fonts'));
let fontTotal = 0; for (const f of fonts) fontTotal += (await stat(path.join(SITE, 'assets/fonts', f))).size;
const heroAvif = (await stat(path.join(SITE, 'assets/img/hero-m-1080.avif'))).size;
const heroWebp = (await stat(path.join(SITE, 'assets/img/hero-m-1080.webp'))).size;
console.log(`\nHTML gz ${kb(await gz('index.html'))} (of which inlined critical CSS ${kb(gzipSync(crit, { level: 9 }).length)})`);
console.log(`CSS gz: critical ${kb(gzipSync(crit, { level: 9 }).length)} + site.css ${kb(await gz('assets/css/site.css'))}`);
console.log(`JS gz ${kb(await gz('assets/js/site.js'))}`);
console.log(`Fonts total ${kb(fontTotal)} (${fonts.join(', ')})`);
console.log(`Hero mobile 1080w: AVIF ${kb(heroAvif)} · WebP ${kb(heroWebp)}`);
console.log(`Video: ${kb((await stat(path.join(SITE, 'assets/video/cabin-beds.mp4'))).size)} mp4 · ${kb((await stat(path.join(SITE, 'assets/video/cabin-beds.webm'))).size)} webm`);
