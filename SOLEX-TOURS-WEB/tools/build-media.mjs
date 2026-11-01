// Responsive images and the cabin video, from media/ into site/assets/.
//
//   node tools/build-media.mjs            # everything in tools/media.config.mjs
//   node tools/build-media.mjs hero-night # only the ids given
//
// Each image entry is cropped around a focal point (when an aspect is given), then written as
// AVIF + WebP + JPEG at every width that the source can honestly provide (no upscaling).
// site/assets/img/manifest.json records the real output sizes; tools/build.mjs reads it to
// write <picture> markup, so the HTML never references a file that does not exist.
import sharp from 'sharp';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { images, videos } from './media.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const IMG_OUT = path.join(ROOT, 'site/assets/img');
const VID_OUT = path.join(ROOT, 'site/assets/video');
const only = new Set(process.argv.slice(2));

const ratio = (a) => {
  const [w, h] = a.split(':').map(Number);
  return w / h;
};

// Crop box of the requested aspect, as large as possible, centred on the focal point (0–100 %).
function cropBox(W, H, aspect, [fx, fy] = [50, 50]) {
  const r = ratio(aspect);
  let w = W, h = Math.round(W / r);
  if (h > H) { h = H; w = Math.round(H * r); }
  const cx = (fx / 100) * W, cy = (fy / 100) * H;
  const left = Math.min(Math.max(0, Math.round(cx - w / 2)), W - w);
  const top = Math.min(Math.max(0, Math.round(cy - h / 2)), H - h);
  return { left, top, width: w, height: h };
}

async function buildImage(e, manifest) {
  const src = path.join(ROOT, e.src);
  const meta = await sharp(src).rotate().metadata();
  const W = meta.autoOrient?.width ?? meta.width;
  const H = meta.autoOrient?.height ?? meta.height;
  const box = e.aspect ? cropBox(W, H, e.aspect, e.focus) : { left: 0, top: 0, width: W, height: H };
  const widths = [...new Set(e.widths.map((w) => Math.min(w, box.width)))].sort((a, b) => a - b);
  const q = e.quality ?? {};
  const out = [];
  for (const w of widths) {
    const h = Math.round((box.height * w) / box.width);
    const base = sharp(src).rotate().extract(box).resize(w, h, { kernel: 'lanczos3' });
    if (e.modulate) base.modulate(e.modulate);
    const stem = path.join(IMG_OUT, `${e.id}-${w}`);
    await base.clone().avif({ quality: q.avif ?? 52, effort: 6, chromaSubsampling: '4:2:0' }).toFile(`${stem}.avif`);
    await base.clone().webp({ quality: q.webp ?? 74, effort: 6, smartSubsample: true }).toFile(`${stem}.webp`);
    await base.clone().jpeg({ quality: q.jpg ?? 76, mozjpeg: true, progressive: true }).toFile(`${stem}.jpg`);
    out.push({ w, h });
  }
  // Dominant colour for the placeholder background behind the image while it loads.
  const { dominant } = await sharp(src).extract(box).stats();
  const hex = '#' + [dominant.r, dominant.g, dominant.b].map((v) => v.toString(16).padStart(2, '0')).join('');
  manifest[e.id] = { aspect: e.aspect ?? `${box.width}:${box.height}`, widths: out, color: hex };
  console.log(`img  ${e.id.padEnd(26)} ${box.width}×${box.height} → ${out.map((o) => o.w).join(', ')}  ${hex}`);
}

function buildVideo(v) {
  const src = path.join(ROOT, v.src);
  const stem = path.join(VID_OUT, v.id);
  const vf = v.vf ?? 'scale=848:-2';
  const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, ...args], { stdio: 'inherit' });
  ff(['-an', '-vf', `${vf},fps=24`, '-c:v', 'libx264', '-profile:v', 'main', '-preset', 'slow', '-crf', String(v.crf ?? 27), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${stem}.mp4`]);
  ff(['-an', '-vf', `${vf},fps=24`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', String(v.webmCrf ?? 40), '-row-mt', '1', '-deadline', 'good', `${stem}.webm`]);
  ff(['-ss', String(v.posterAt ?? 1), '-frames:v', '1', '-vf', vf, '-q:v', '4', `${stem}-poster.jpg`]);
  execFileSync('node', ['-e', `require('sharp')('${stem}-poster.jpg').webp({quality:70}).toFile('${stem}-poster.webp')`], { cwd: ROOT });
  console.log(`vid  ${v.id}`);
}

await mkdir(IMG_OUT, { recursive: true });
await mkdir(VID_OUT, { recursive: true });
const manifestPath = path.join(IMG_OUT, 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')) : {};
for (const e of images) if (!only.size || only.has(e.id)) await buildImage(e, manifest);
for (const v of videos) if (!only.size || only.has(v.id)) buildVideo(v);
// Drop entries that no longer exist in the config.
for (const id of Object.keys(manifest)) if (!images.some((e) => e.id === id)) delete manifest[id];
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
