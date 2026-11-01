// site/ → preview/solex-tours-preview.html : ONE self-contained HTML file for private previews
// (open it straight from a phone or a chat attachment, no server, no network).
//
//   node tools/build-preview.mjs
//
// Every asset is inlined as a data URI: CSS, the JS module, the font subsets, the logo sprite,
// one WebP per image (the width closest to the layout's need) and the cabin video (MP4 only).
// AVIF/JPEG alternatives and srcset lists are dropped, so the file stays a few MB. The real,
// deployable site is still site/ — this file is only for looking at the design.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(ROOT, 'preview/solex-tours-preview.html');
const MIME = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', woff2: 'font/woff2', mp4: 'video/mp4' };
const manifest = JSON.parse(await readFile(path.join(SITE, 'assets/img/manifest.json'), 'utf8'));

const cache = new Map();
async function dataURI(rel) {
  rel = rel.replace(/[?#].*$/, '');
  if (!cache.has(rel)) {
    const buf = await readFile(path.join(SITE, rel));
    cache.set(rel, `data:${MIME[path.extname(rel).slice(1)]};base64,${buf.toString('base64')}`);
  }
  return cache.get(rel);
}

// assets/img/<id>-<w>.<ext> → the WebP of that id at the preferred width
function webpFor(rel, want) {
  const m = rel.match(/^assets\/img\/(.+)-(\d+)\.(avif|webp|jpg)$/);
  if (!m || !manifest[m[1]]) return rel;
  const widths = manifest[m[1]].widths.map((x) => x.w);
  const target = want ?? (m[1].startsWith('hero-m') ? 828 : m[1].startsWith('hero-d') ? 900 : 800);
  const w = widths.filter((x) => x >= Math.min(target, Math.max(...widths))).sort((a, b) => a - b)[0] ?? Math.max(...widths);
  return `assets/img/${m[1]}-${w}.webp`;
}

let html = await readFile(path.join(SITE, 'index.html'), 'utf8');

// 1. <head>: drop preloads, icons, manifest and the external stylesheet; inline site.css instead
html = html.replace(/<link rel="(?:preload|icon|apple-touch-icon|manifest)"[^>]*>/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/css\/site\.css[^"]*"[^>]*>/g, '');
html = html.replace(/<noscript>\s*<\/noscript>/g, '');
let css = await readFile(path.join(SITE, 'assets/css/site.css'), 'utf8');
html = html.replace('</head>', `<style>${css}</style>\n</head>`);

// 2. JS module inline
const js = await readFile(path.join(SITE, 'assets/js/site.js'), 'utf8');
html = html.replace(/<script type="module" src="assets\/js\/site\.js[^"]*"><\/script>/, () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script>`);

// 3. Logo sprite: external <use href="assets/svg/mark.svg#id"> → inline symbols
const sprite = (await readFile(path.join(SITE, 'assets/svg/mark.svg'), 'utf8')).replace(/^<svg[^>]*>|<\/svg>\s*$/g, '');
html = html.replace(/href="assets\/svg\/mark\.svg[^"#]*#/g, 'href="#');
html = html.replace(/<body([^>]*)>/, `<body$1><svg width="0" height="0" style="position:absolute" aria-hidden="true">${sprite}</svg>`);

// 4. Pictures: keep one WebP. Drop AVIF sources, JPEG sources and media-less WebP sources
//    (the <img> itself becomes WebP); collapse every srcset to a single candidate.
html = html.replace(/<source\b[^>]*>/g, (tag) => {
  if (/type="image\/avif"/.test(tag)) return '';
  if (!/\stype=/.test(tag)) return '';                       // JPEG source
  if (/type="image\/webp"/.test(tag) && !/\smedia=/.test(tag)) return '';
  return tag.replace(/\s(data-)?srcset="([^"]+)"/, (_, d, list) => ` ${d ?? ''}srcset="${webpFor(list.trim().split(/\s+/)[0])}"`).replace(/\ssizes="[^"]*"/, '');
});
html = html.replace(/<img\b[^>]*>/g, (tag) => {
  tag = tag.replace(/\s(?:data-)?srcset="[^"]*"/g, '').replace(/\ssizes="[^"]*"/, '');
  return tag.replace(/\s(data-)?src="(assets\/img\/[^"]+)"/, (_, d, rel) => ` ${d ?? ''}src="${webpFor(rel)}"`);
});

// 5. Video: MP4 only
html = html.replace(/\sdata-src-webm="[^"]*"/, ' data-src-webm=""');

// 6. Every remaining assets/… reference (attributes and CSS url()) → data URI
const refs = new Set([...html.matchAll(/assets\/[A-Za-z0-9_./-]+\.(?:webp|jpg|png|svg|woff2|mp4)/g)].map((m) => m[0]));
for (const rel of refs) html = html.split(rel).join(await dataURI(rel));
html = html.replace(/(data:[^"')]+?)\?v=[0-9a-z]+/g, '$1');

// 7. Mark it as a preview
html = html.replace('<title>', '<title>PREVIEW · ');
const left = [...html.matchAll(/["'(]assets\//g)].length;
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, html);
console.log(`${path.relative(ROOT, OUT)} — ${(Buffer.byteLength(html) / 1048576).toFixed(2)} MB, ${cache.size} assets inlined, ${left} external refs left`);
