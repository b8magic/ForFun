// src/ → site/ : expands image placeholders into <picture> markup and copies static assets.
//
//   node tools/build.mjs
//
// In src/index.html an image is written as
//   <img data-pic="camp-sunset" data-wide="camp-sunset-wide" data-bp="900" sizes="100vw" alt="…" loading="lazy">
// and becomes a <picture> with AVIF/WebP/JPEG sources, real width/height (no layout shift) and
// the image's dominant colour as a placeholder background. data-wide/data-bp add an
// art-directed crop for viewports at least data-bp px wide. The manifest comes from
// tools/build-media.mjs, so every referenced file exists.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const SITE = path.join(ROOT, 'site');
const manifest = JSON.parse(await readFile(path.join(SITE, 'assets/img/manifest.json'), 'utf8'));

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const dropAttrs = (tag, names) => names.reduce((t, n) => t.replace(new RegExp(`\\s${n}="[^"]*"`), ''), tag);
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
  const m = need(id, tag);
  if (wide) need(wide, tag);
  const fallback = m.widths.find((w) => w.w >= 960) ?? m.widths.at(-1);
  const sources = [];
  if (wide) {
    const media = `(min-width: ${bp}px)`;
    sources.push(`<source media="${media}" type="image/avif" srcset="${srcset(wide, 'avif')}" sizes="${wideSizes}">`);
    sources.push(`<source media="${media}" type="image/webp" srcset="${srcset(wide, 'webp')}" sizes="${wideSizes}">`);
    sources.push(`<source media="${media}" srcset="${srcset(wide, 'jpg')}" sizes="${wideSizes}">`);
  }
  sources.push(`<source type="image/avif" srcset="${srcset(id, 'avif')}" sizes="${sizes}">`);
  sources.push(`<source type="image/webp" srcset="${srcset(id, 'webp')}" sizes="${sizes}">`);
  let img = dropAttrs(tag, ['data-pic', 'data-wide', 'data-bp', 'data-wide-sizes', 'sizes']);
  const style = `background-color:${m.color}`;
  img = img.replace(/^<img/, `<img src="assets/img/${id}-${fallback.w}.jpg" srcset="${srcset(id, 'jpg')}" sizes="${sizes}" width="${fallback.w}" height="${fallback.h}"`);
  img = /\sstyle="/.test(img) ? img.replace(/\sstyle="/, ` style="${style};`) : img.replace(/\s*\/?>$/, ` style="${style}">`);
  if (!/\sdecoding=/.test(img)) img = img.replace(/>$/, ' decoding="async">');
  const pClass = attr(tag, 'data-picture-class');
  return `<picture${pClass ? ` class="${pClass}"` : ''}>${sources.join('')}${dropAttrs(img, ['data-picture-class'])}</picture>`;
}

let html = await readFile(path.join(SRC, 'index.html'), 'utf8');
let count = 0;
html = html.replace(/<img\b[^>]*\sdata-pic="[^"]+"[^>]*>/g, (tag) => { count++; return picture(tag); });
// Optional asset version for cache busting (?v=…) on css/js
const v = Date.UTC(2026, 10, 1).toString(36);
html = html.replaceAll('{{v}}', v);

await mkdir(SITE, { recursive: true });
await writeFile(path.join(SITE, 'index.html'), html);
for (const dir of ['css', 'js', 'fonts', 'svg']) {
  await rm(path.join(SITE, 'assets', dir), { recursive: true, force: true });
  await cp(path.join(SRC, 'assets', dir), path.join(SITE, 'assets', dir), { recursive: true }).catch(() => {});
}
for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'og-image.jpg', 'robots.txt', 'site.webmanifest', 'icon-192.png', 'icon-512.png']) {
  await cp(path.join(SRC, f), path.join(SITE, f)).catch(() => {});
}
console.log(`site/index.html written — ${count} pictures expanded`);
