// Variable-font glyph engine built on HarfBuzz.
// Every glyph is flattened into polylines so the film can bend, stretch,
// stripe and shear letterforms with the same displacement fields that move
// the swell lines. Typography and geometry share one physics.

let hb = null;
const fonts = {};
const glyphCache = new Map();

export async function initText(defs) {
  const inst = await window.createHarfBuzz({ locateFile: (p) => `lib/${p}` });
  hb = window.hbjs(inst);
  for (const [key, url] of Object.entries(defs)) {
    const buf = await (await fetch(url)).arrayBuffer();
    const blob = hb.createBlob(buf);
    const face = hb.createFace(blob, 0);
    const font = hb.createFont(face);
    const upem = face.upem;
    const axes = face.getAxisInfos();
    fonts[key] = { face, font, upem, axes, vkey: '' };
  }
  return fonts;
}

function setVars(f, vars) {
  const clamped = {};
  for (const [tag, v] of Object.entries(vars || {})) {
    const a = f.axes[tag];
    if (!a) continue;
    clamped[tag] = Math.max(a.min, Math.min(a.max, v));
  }
  const vkey = JSON.stringify(clamped);
  if (vkey !== f.vkey) {
    f.font.setVariations(clamped);
    f.vkey = vkey;
  }
  return vkey;
}

// Flatten an SVG-ish path string (M L Q C Z, y-up font units) into contours.
function flatten(path, tol = 6) {
  const contours = [];
  let cur = null;
  let x = 0, y = 0;
  const re = /([MLQCZ])([^MLQCZ]*)/g;
  let m;
  while ((m = re.exec(path))) {
    const cmd = m[1];
    const v = m[2].trim().length ? m[2].trim().split(/[ ,]+/).map(Number) : [];
    if (cmd === 'M') {
      cur = [v[0], v[1]];
      contours.push(cur);
      x = v[0]; y = v[1];
    } else if (cmd === 'L') {
      cur.push(v[0], v[1]);
      x = v[0]; y = v[1];
    } else if (cmd === 'Q') {
      const [cx, cy, ex, ey] = v;
      const len = Math.hypot(cx - x, cy - y) + Math.hypot(ex - cx, ey - cy);
      const n = Math.max(2, Math.ceil(len / (tol * 4)));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        cur.push(u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey);
      }
      x = ex; y = ey;
    } else if (cmd === 'C') {
      const [c1x, c1y, c2x, c2y, ex, ey] = v;
      const len = Math.hypot(c1x - x, c1y - y) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(ex - c2x, ey - c2y);
      const n = Math.max(2, Math.ceil(len / (tol * 4)));
      for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        cur.push(
          u * u * u * x + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
          u * u * u * y + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey
        );
      }
      x = ex; y = ey;
    }
  }
  return contours;
}

function glyph(f, vkey, gid) {
  const k = `${f.upem}|${vkey}|${gid}|${f.face.ptr}`;
  let g = glyphCache.get(k);
  if (!g) {
    g = flatten(f.font.glyphToPath(gid));
    glyphCache.set(k, g);
    if (glyphCache.size > 20000) glyphCache.clear();
  }
  return g;
}

// Shape a string. Returns glyph records in font units plus total advance.
// opts: { vars, tracking (em) }
export function shape(fontKey, text, opts = {}) {
  const f = fonts[fontKey];
  const vkey = setVars(f, opts.vars);
  const buf = hb.createBuffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(f.font, buf);
  const out = buf.json();
  buf.destroy();
  const track = (opts.tracking || 0) * f.upem;
  let pen = 0;
  const glyphs = out.map((r, i) => {
    const g = { contours: glyph(f, vkey, r.g), x: pen + r.dx, y: r.dy, adv: r.ax, cl: r.cl, ch: text[r.cl] };
    pen += r.ax + (i < out.length - 1 ? track : 0);
    return g;
  });
  return { glyphs, advance: pen, upem: f.upem, font: f };
}

export function measure(fontKey, text, size, opts = {}) {
  const s = shape(fontKey, text, opts);
  return (s.advance / s.upem) * size;
}

// Draw shaped text.
//   x,y: baseline origin (align applied), size: px
//   opts.align: 'left' | 'center' | 'right'
//   opts.warp(px, py, glyphIndex, glyph) -> [px, py] applied in canvas space
//   opts.perGlyph(i, g) -> { dx, dy, scale, alpha, rot } optional per-glyph transform
export function drawText(ctx, fontKey, text, x, y, size, opts = {}) {
  const s = shape(fontKey, text, opts);
  const k = size / s.upem;
  const w = s.advance * k;
  let ox = x;
  if (opts.align === 'center') ox = x - w / 2;
  else if (opts.align === 'right') ox = x - w;
  const warp = opts.warp;
  const pg = opts.perGlyph;
  ctx.beginPath();
  s.glyphs.forEach((g, i) => {
    let gx = ox + g.x * k, gy = y - g.y * k;
    let sc = 1, rot = 0, cx = gx + (g.adv * k) / 2;
    if (pg) {
      const t = pg(i, g, gx, w, s.glyphs.length);
      if (t === null) return;
      if (t) {
        gx += t.dx || 0; gy += t.dy || 0; cx += t.dx || 0;
        sc = t.scale ?? 1; rot = t.rot || 0;
      }
    }
    const cr = Math.cos(rot), sr = Math.sin(rot);
    for (const c of g.contours) {
      for (let j = 0; j < c.length; j += 2) {
        let px = c[j] * k * sc, py = -c[j + 1] * k * sc;
        if (rot) { const ax = px - (g.adv * k * sc) / 2; const nx = ax * cr - py * sr + (g.adv * k * sc) / 2; py = ax * sr + py * cr; px = nx; }
        px += gx - (sc - 1) * (g.adv * k) / 2; py += gy;
        if (warp) { const r = warp(px, py, i, g); px = r[0]; py = r[1]; }
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
    }
  });
  return { width: w, left: ox };
}

export function fontInfo(key) { return fonts[key]; }
