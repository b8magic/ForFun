// Deterministic frame renderer: serves ./src, drives headless Chromium,
// calls window.renderFrame(t) for every frame and writes PNGs.
//
//   node render.mjs --page index.html --fps 60 --from 0 --to 16 --workers 4 --out out/frames
//   node render.mjs --stills 1.2,4.5,9.1 --out out/stills
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);
const PAGE = args.page || 'index.html';
const FPS = +(args.fps || 60);
const OUT = path.resolve(ROOT, args.out || 'out/frames');
const WORKERS = +(args.workers || 4);
const W = +(args.width || 1080), H = +(args.height || 1920);
const OPTS = {};
if (args.k) OPTS.k = +args.k;
if (args.nopost) OPTS.nopost = true;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.json': 'application/json', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file = url.startsWith('/fonts/') ? path.join(ROOT, url) : path.join(ROOT, 'src', url);
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('nf'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

fs.mkdirSync(OUT, { recursive: true });

let times;
if (args.stills) {
  times = String(args.stills).split(',').map(Number);
} else {
  const from = +(args.from || 0), to = +(args.to || 16);
  const n0 = Math.round(from * FPS), n1 = Math.round(to * FPS);
  times = [];
  for (let n = n0; n < n1; n++) times.push(n / FPS);
}

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--force-color-profile=srgb'],
});

const t0 = Date.now();
let done = 0;
async function worker(list) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/${PAGE}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  for (const t of list) {
    const dataUrl = await page.evaluate(([tt, o]) => window.renderFrame(tt, o), [t, OPTS]);
    const name = args.stills ? `still_${t.toFixed(3)}.png` : `f_${String(Math.round(t * FPS)).padStart(5, '0')}.png`;
    fs.writeFileSync(path.join(OUT, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
    done++;
    if (done % 30 === 0 || done === times.length) {
      const el = (Date.now() - t0) / 1000;
      process.stdout.write(`\r${done}/${times.length}  ${el.toFixed(0)}s  eta ${((el / done) * (times.length - done)).toFixed(0)}s   `);
    }
  }
  await ctx.close();
}

// Interleave frames across workers so heavy sections are shared evenly.
const lists = Array.from({ length: Math.min(WORKERS, times.length) }, () => []);
times.forEach((t, i) => lists[i % lists.length].push(t));
await Promise.all(lists.map(worker));
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
await browser.close();
server.close();
