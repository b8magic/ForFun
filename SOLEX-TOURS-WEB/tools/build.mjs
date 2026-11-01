// src/ → site/ : the deployable static site.
//
//   node tools/build.mjs                  # normal build
//   node tools/build.mjs --no-fuego-hike  # same, with every <!--fuego:start-->…<!--fuego:end--> block removed
//
// What it does (dependency-light: sharp for media, lightningcss + esbuild for minifying):
//  1. Expands every <img data-pic="ID" …> into a <picture> (AVIF/WebP/JPEG srcset from
//     site/assets/img/manifest.json, real width/height, dominant-colour background).
//     data-wide/data-bp add an art-directed crop for viewports ≥ bp px; data-defer writes
//     data-src/data-srcset so JS can load the image later (desktop timeline panel).
//  2. Expands {{wa:KEY}} into prefilled wa.me links (every CTA works without JS).
//  3. Inlines the critical CSS (+ the first-screen textile motifs) and loads site.css async.
//  4. Writes hero <link rel=preload> tags that match the hero <source> elements exactly.
//  5. Writes the logo mark (twin peaks + sun) as an external SVG sprite (assets/svg/mark.svg).
//  6. Minifies CSS and JS, adds content-hash cache busting, copies fonts/brand/root files.
// All URLs stay relative, so site/ works at a domain root or in a sub-folder.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform as cssTransform } from 'lightningcss';
import { transform as jsTransform } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const SITE = path.join(ROOT, 'site');
const NO_FUEGO = process.argv.includes('--no-fuego-hike');
const manifest = JSON.parse(await readFile(path.join(SITE, 'assets/img/manifest.json'), 'utf8'));

// ---------------------------------------------------------------- pictures
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const has = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`).test(tag);
const dropAttrs = (tag, names) => names.reduce((t, n) => t.replace(new RegExp(`\\s${n}(="[^"]*")?(?=[\\s/>])`), ''), tag);
const srcset = (id, fmt) => manifest[id].widths.map((w) => `assets/img/${id}-${w.w}.${fmt} ${w.w}w`).join(', ');

function need(id, where) {
  if (!manifest[id]) throw new Error(`image "${id}" (${where}) is not in the manifest — add it to tools/media.config.mjs and run npm run media`);
  return manifest[id];
}

function picture(tag) {
  const id = attr(tag, 'data-pic');
  const wide = attr(tag, 'data-wide');
  const bp = attr(tag, 'data-bp') ?? '900';
  const sizes = attr(tag, 'sizes') ?? '100vw';
  const wideSizes = attr(tag, 'data-wide-sizes') ?? sizes;
  const defer = has(tag, 'data-defer');
  const S = defer ? 'data-srcset' : 'srcset';
  const m = need(id, tag);
  if (wide) need(wide, tag);
  const fallback = m.widths.find((w) => w.w >= 960) ?? m.widths.at(-1);
  const sources = [];
  if (wide) {
    const media = `(min-width: ${bp}px)`;
    sources.push(`<source media="${media}" type="image/avif" ${S}="${srcset(wide, 'avif')}" sizes="${wideSizes}">`);
    sources.push(`<source media="${media}" type="image/webp" ${S}="${srcset(wide, 'webp')}" sizes="${wideSizes}">`);
    sources.push(`<source media="${media}" ${S}="${srcset(wide, 'jpg')}" sizes="${wideSizes}">`);
  }
  sources.push(`<source type="image/avif" ${S}="${srcset(id, 'avif')}" sizes="${sizes}">`);
  sources.push(`<source type="image/webp" ${S}="${srcset(id, 'webp')}" sizes="${sizes}">`);
  let img = dropAttrs(tag, ['data-pic', 'data-wide', 'data-bp', 'data-wide-sizes', 'sizes', 'data-defer', 'data-picture-class']);
  const style = `background-color:${m.color}`;
  img = img.replace(/^<img/, `<img ${defer ? 'data-src' : 'src'}="assets/img/${id}-${fallback.w}.jpg" ${S}="${srcset(id, 'jpg')}" sizes="${sizes}" width="${fallback.w}" height="${fallback.h}"`);
  img = /\sstyle="/.test(img) ? img.replace(/\sstyle="/, ` style="${style};`) : img.replace(/\s*\/?>$/, ` style="${style}">`);
  if (!/\sdecoding=/.test(img)) img = img.replace(/>$/, ' decoding="async">');
  const pClass = attr(tag, 'data-picture-class');
  return `<picture${pClass ? ` class="${pClass}"` : ''}>${sources.join('')}${img}</picture>`;
}

// ---------------------------------------------------------------- prefilled WhatsApp links (no-JS path)
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const NUM = { primary: '50248347003', secondary: '50249468883' };
const ask = (what) => `Hi Alexander! I'd like to check a date for the ${what}.\nDate: \nPeople: \nPickup: Café Condesa or Café La Parada`;
const WA = {
  overnight: [NUM.primary, ask('Acatenango Overnight (2 days / 1 night, Q750 per person)')],
  overnight2: [NUM.secondary, ask('Acatenango Overnight (2 days / 1 night, Q750 per person)')],
  midnight: [NUM.primary, ask('Midnight sunrise tour (leaves 10:30 PM, Q750 per person)')],
  sunset: [NUM.primary, ask('Sunset tour (leaves 10:30 AM, Q750 per person)')],
  express: [NUM.primary, ask('One-day express (leaves 5:00 AM, Q675 per person)')],
  gear: [NUM.primary, ask('Acatenango Overnight (2 days / 1 night, Q750 per person)') + "\nExtras: I'd like to rent gear (jacket, backpack, headlamp, poles or shoes)"],
  question: [NUM.primary, 'Hi Alexander! I have a question about Acatenango.'],
};
const waHref = (key) => {
  if (!WA[key]) throw new Error(`unknown {{wa:${key}}}`);
  const [n, text] = WA[key];
  return `https://wa.me/${n}?text=${enc(text)}`;
};

// ---------------------------------------------------------------- CSS + JS
const TARGETS = { chrome: 100 << 16, safari: (15 << 16) | (4 << 8), firefox: 100 << 16, ios_saf: (15 << 16) | (4 << 8), samsung: 18 << 16 };
const minCss = (code, filename) => cssTransform({ filename, code: Buffer.from(code), minify: true, targets: TARGETS }).code.toString();
const read = (p) => readFile(path.join(SRC, p), 'utf8');
const criticalCss = minCss((await read('assets/css/textile-critical.css')) + (await read('assets/css/critical.css')), 'critical.css');
const siteCss = minCss((await read('assets/css/textile.css')) + (await read('assets/css/site.css')), 'site.css');
let js = await read('assets/js/site.js');
if (NO_FUEGO) js = js.replace('fuegoAddon: true', 'fuegoAddon: false');
const siteJs = (await jsTransform(js, { minify: true, format: 'esm', target: ['es2020', 'chrome100', 'safari15'] })).code;
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

// ---------------------------------------------------------------- HTML
let html = await read('index.html');
if (NO_FUEGO) html = html.replace(/<!--fuego:start-->[\s\S]*?<!--fuego:end-->/g, '');
let count = 0;
html = html.replace(/<img\b[^>]*\sdata-pic="[^"]+"[^>]*>/g, (tag) => { count++; return picture(tag); });
html = html.replace(/\{\{wa:(\w+)\}\}/g, (_, k) => waHref(k));

// The logo mark (twin peaks + sun) lives in one small external sprite, so the HTML stays light;
// <use href="#mark-…"> in src becomes <use href="assets/svg/mark.svg?v=…#mark-…">.
const mark = JSON.parse(await readFile(path.join(ROOT, 'tools/mark-paths.json'), 'utf8'));
const markSvg = `<svg xmlns="http://www.w3.org/2000/svg">` +
  `<symbol id="mark-sun" viewBox="${mark.viewBox}"><path transform="${mark.sun.t}" d="${mark.sun.d}"/></symbol>` +
  `<symbol id="mark-peaks" viewBox="${mark.viewBox}"><path transform="${mark.peaks.t}" d="${mark.peaks.d}"/></symbol></svg>`;
html = html.replace('<!--mark-symbols-->', '');
html = html.replaceAll('href="#mark-', `href="assets/svg/mark.svg?v=${createHash('sha256').update(markSvg).digest('hex').slice(0, 10)}#mark-`);

const pre = (id, sizes, media) => `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(id, 'avif')}" imagesizes="${sizes}" media="${media}" fetchpriority="high">`;
html = html.replace('<!--preload:hero-->', pre('hero-m', 'calc(100vw - 40px)', '(max-width: 959px)') + '\n' + pre('hero-d', '(min-width: 1280px) 540px, 42vw', '(min-width: 960px)'));

html = html.replace('<link rel="stylesheet" href="assets/css/critical.css" data-inline>', `<style>${criticalCss}</style>`);
const cssHref = `assets/css/site.css?v=${hash(siteCss)}`;
html = html.replace('<link rel="stylesheet" href="assets/css/site.css" data-async>',
  `<link rel="preload" href="${cssHref}" as="style"><link rel="stylesheet" href="${cssHref}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${cssHref}"></noscript>`);
html = html.replace('src="assets/js/site.js"', `src="assets/js/site.js?v=${hash(siteJs)}"`);
html = html.replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');
const left = html.match(/\{\{[^}]+\}\}|data-pic=/g);
if (left) throw new Error('unexpanded placeholders: ' + left.join(', '));

await mkdir(SITE, { recursive: true });
await writeFile(path.join(SITE, 'index.html'), html);
for (const dir of ['css', 'js', 'fonts', 'svg', 'brand']) await rm(path.join(SITE, 'assets', dir), { recursive: true, force: true });
await mkdir(path.join(SITE, 'assets/css'), { recursive: true });
await mkdir(path.join(SITE, 'assets/js'), { recursive: true });
await writeFile(path.join(SITE, 'assets/css/site.css'), siteCss);
await writeFile(path.join(SITE, 'assets/js/site.js'), siteJs);
await mkdir(path.join(SITE, 'assets/svg'), { recursive: true });
await writeFile(path.join(SITE, 'assets/svg/mark.svg'), markSvg);
for (const dir of ['fonts', 'brand']) await cp(path.join(SRC, 'assets', dir), path.join(SITE, 'assets', dir), { recursive: true }).catch(() => {});
for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'og-image.jpg', 'robots.txt', 'site.webmanifest', 'icon-192.png', 'icon-512.png']) {
  await cp(path.join(SRC, f), path.join(SITE, f)).catch(() => {});
}
const gz = async (s) => (await import('node:zlib')).gzipSync(s, { level: 9 }).length;
console.log(`site/index.html written${NO_FUEGO ? ' (no Fuego hike)' : ''} — ${count} pictures · html ${(await gz(html)) / 1000} KB gz (critical CSS ${(await gz(criticalCss)) / 1000}) · site.css ${(await gz(siteCss)) / 1000} KB gz · site.js ${(await gz(siteJs)) / 1000} KB gz`);
