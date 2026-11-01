// Brand assets → src/ (run once; the outputs are committed):
//   logo roundels (webp), favicon.svg/.ico, apple-touch-icon, PWA icons and the 1200×630 share image.
//
//   node tools/build-brand.mjs
//
// The crisp mark (twin peaks + sun) is media/logo-mark-traced.svg, with coordinates rounded to
// whole units (visually identical, half the bytes). The share image is set in Fraunces, so
// install src/assets/fonts' TTF instance locally (see README) or it falls back to a system serif.
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const raw = await readFile(path.join(ROOT, 'media/logo-mark-traced.svg'), 'utf8');
const mark = raw.replace(/-?\d+\.\d+/g, (m) => String(Math.round(+m))).replace(/,\s+/g, ',').replace(/\s+/g, ' ');
const paths = [...mark.matchAll(/<g transform="([^"]+)" fill="([^"]+)">\s*<path d="([^"]+)"/g)].map((m) => ({ t: m[1], fill: m[2], d: m[3] }));
const [sun, peaks] = paths;
await writeFile(path.join(ROOT, 'tools/mark-paths.json'), JSON.stringify({ viewBox: '205 280 670 385', sun, peaks }, null, 0));

// favicon.svg — the mark on the logo-sky disc.
const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#A8D1E6"/><svg x="6" y="13" width="52" height="34" viewBox="205 280 670 385"><g transform="${sun.t}" fill="#E9A15B"><path d="${sun.d}"/></g><g transform="${peaks.t}" fill="#1E1D18"><path d="${peaks.d}"/></g></svg></svg>`;
await writeFile(path.join(SRC, 'favicon.svg'), fav);

const square = (size, pad = 0.14, round = true) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${round ? '<circle cx="50" cy="50" r="50" fill="#A8D1E6"/>' : '<rect width="100" height="100" fill="#A8D1E6"/>'}<svg x="${pad * 100}" y="${50 - (100 - 2 * pad * 100) * 385 / 670 / 2}" width="${100 - 2 * pad * 100}" height="${(100 - 2 * pad * 100) * 385 / 670}" viewBox="205 280 670 385"><g transform="${sun.t}" fill="#E9A15B"><path d="${sun.d}"/></g><g transform="${peaks.t}" fill="#1E1D18"><path d="${peaks.d}"/></g></svg></svg>`);

// favicon.ico = one 32×32 PNG wrapped in an ICO container (PNG-in-ICO works in every current browser).
const png32 = await sharp(square(32, 0.1)).png().toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6); ico.writeUInt8(32, 7); ico.writeUInt8(0, 8); ico.writeUInt8(0, 9);
ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png32.length, 14); ico.writeUInt32LE(22, 18);
await writeFile(path.join(SRC, 'favicon.ico'), Buffer.concat([ico, png32]));
await sharp(square(180, 0.16, false)).png().toFile(path.join(SRC, 'apple-touch-icon.png'));
await sharp(square(192, 0.2, false)).png().toFile(path.join(SRC, 'icon-192.png'));
await sharp(square(512, 0.2, false)).png().toFile(path.join(SRC, 'icon-512.png'));

// Logo roundel (the full round logo, trimmed to its content box 940×940 at +74+56).
const logo = sharp(path.join(ROOT, 'media/site/logo.png')).extract({ left: 74, top: 56, width: 940, height: 940 });
for (const s of [96, 192, 360]) await logo.clone().resize(s, s).webp({ quality: 86, alphaQuality: 90 }).toFile(path.join(SRC, `assets/brand/logo-${s}.webp`));

// Share image 1200×630: the night plume (owner photo), ink panel, headline, logo roundel.
const photo = await sharp(path.join(ROOT, 'media/owner/fuego-eruption-night-plume.jpg'))
  .extract({ left: 0, top: Math.round(1600 * 0.36 - 450), width: 1200, height: 900 }).resize(840, 630).toBuffer();
const logoPng = await logo.clone().resize(132, 132).png().toBuffer();
const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset=".42" stop-color="#0F1524"/><stop offset=".62" stop-color="#0F1524" stop-opacity="0"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect y="0" width="1200" height="8" fill="#A8232B"/>
  <text x="64" y="232" font-family="Figtree" font-weight="800" font-size="22" letter-spacing="3" fill="#F4C06A">OVERNIGHT FROM ANTIGUA · 2 DAYS, 1 NIGHT</text>
  <text x="60" y="330" font-family="Fraunces" font-weight="700" font-size="92" fill="#FFFBF4" letter-spacing="-2">Sleep facing</text>
  <text x="60" y="424" font-family="Fraunces" font-weight="700" font-size="92" fill="#F4C06A" letter-spacing="-2">Fuego.</text>
  <text x="64" y="500" font-family="Figtree" font-weight="500" font-size="27" fill="#A9B4C8">Local guides from La Soledad · 2–8 per guide</text>
  <text x="64" y="546" font-family="Figtree" font-weight="800" font-size="27" fill="#FFFBF4">Q750 per person · cabin, 3 meals, transport</text>
</svg>`);
await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#0F1524' } })
  .composite([{ input: photo, left: 360, top: 0 }, { input: overlay, left: 0, top: 0 }, { input: logoPng, left: 60, top: 52 }])
  .jpeg({ quality: 82, mozjpeg: true }).toFile(path.join(SRC, 'og-image.jpg'));
console.log('brand assets written');
