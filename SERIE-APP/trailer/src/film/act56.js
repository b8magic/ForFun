// V · FLOW and VI · CALM
// White water settles into history: every month is a swell line whose peaks
// are real sessions. The saved dots land on October and raise new crests.
// Zooming out stacks every year into one field of corduroy; a swell travels
// through the whole history; the energy dissipates, and the calm lines become
// the stripes of the logotype.
import { T } from './timeline.js';
import { clamp, lerp, ease, win, smooth, settle, gauss, TAU, rng, PAL, rgba, mixHex } from '../lib/util.js';
import { W, H, strokeLine, dot, ringAt, type, mono } from './draw.js';
import { register } from './registry.js';
import { shape, measure } from '../lib/text.js';
import { discPattern } from './act12.js';
import { YEARS, MONTHS, GRID_PRIOR, GRID_ALL, stats, fmtHours, ALL, NEW, SELECTED, yearCount, daysIn } from './data.js';

const INK = PAL.ink2;
const XL = 196, XR = 900;
const NS = 110;                       // samples per ridge
const SIG = 9.5;
const ROWS = [];
YEARS.forEach((y) => { for (let m = 0; m < 12; m++) if (!(y === 2026 && m > 9)) ROWS.push({ y, m }); });
const NR = ROWS.length;               // 94
const LAST = NR - 1;
const dayX = (d) => XL + ((d - 0.5) / 31) * (XR - XL);

// unit profiles (prior sessions) per row
const PROF = ROWS.map(({ y, m }) => {
  const days = GRID_PRIOR[y][m].days;
  const a = new Float32Array(NS + 1);
  for (let i = 0; i <= NS; i++) {
    const x = lerp(XL, XR, i / NS);
    let v = 0;
    for (let d = 1; d < days.length; d++) if (days[d]) v += days[d] * gauss(x - dayX(d), SIG);
    a[i] = v;
  }
  return a;
});
const NEWX = SELECTED.map(dayX);

// ── timing helpers ────────────────────────────────────────────────────────
const landT = (k) => T.land[0] + 0.12 + k * 0.09;
const landed = (t) => SELECTED.filter((_, k) => t >= landT(k)).length;
const zoomK = (t) => ease.inOutQuint(win(t, T.zoomOut[0], T.zoomOut[1]));
const flatK = (t) => settle(t - T.flatten[0], 1.3, 0.38);

function layout(t) {
  const z = zoomK(t);
  const sp = Math.pow(100, 1 - z) * Math.pow(11.5, z);
  const anchor = lerp(1500, 1640, z);
  const yearGap = 10 * z;
  const amp = 36 * Math.pow(sp / 100, 0.72);
  return { z, sp, anchor, yearGap, amp };
}
const rowBase = (R, L) => L.anchor - (LAST - R) * L.sp - (2026 - ROWS[R].y) * L.yearGap;

// growth of each row's peaks after the white water settles
const grow = (R, t) => {
  const yi = ROWS[R].y === 2026 ? ROWS[R].m : 0;
  const st = ROWS[R].y === 2026 ? 9.82 + yi * 0.035 : 10.95;
  return ROWS[R].y === 2026 ? settle(t - st, 1.5, 0.42) : 1;
};

function pulseAt(R, x, t) {
  const k = win(t, T.pulse[0], T.pulse[1]);
  if (k <= 0 || k >= 1) return 0;
  const Rc = lerp(-12, NR + 12, ease.inOut(k));
  return -26 * gauss(R - Rc, 5.5) * (0.65 + 0.35 * Math.sin(x * 0.014 - t * 7));
}

// Ridge polyline for row R.
function ridge(R, t, L) {
  const base = rowBase(R, L);
  const g = grow(R, t);
  const f = 1 - flatK(t);
  const ext = smooth(win(t, T.flatten[0], T.logo[0] + 0.3));
  const x0 = lerp(XL, 0, ext), x1 = lerp(XR, W, ext);
  const pts = new Float32Array((NS + 1) * 2);
  const isOct = R === LAST;
  for (let i = 0; i <= NS; i++) {
    const u = i / NS;
    const xr = lerp(XL, XR, u);
    let v = PROF[R][i] * g;
    if (isOct) {
      for (let k = 0; k < NEWX.length; k++) {
        const lt = landT(k);
        if (t > lt) v += settle(t - lt, 2.0, 0.35) * gauss(xr - NEWX[k], SIG);
      }
    }
    let y = base - v * L.amp * f + pulseAt(R, xr, t);
    // ripple along October when a dot lands
    if (isOct) for (let k = 0; k < NEWX.length; k++) {
      const dt = t - landT(k);
      if (dt > 0 && dt < 1.2) { const dd = Math.abs(xr - NEWX[k]) - dt * 520; y += 9 * Math.exp(-dt * 3) * gauss(dd, 40) * Math.sin(dd * 0.09); }
    }
    pts[i * 2] = lerp(x0, x1, u);
    pts[i * 2 + 1] = y;
  }
  return pts;
}

// ── white water: spray that settles into the ridgelines ───────────────────
const PARTS = (() => {
  const r = rng(4242);
  const a = [];
  for (let i = 0; i < 1500; i++) {
    const ang = r() * TAU;
    const sp = 500 + 2600 * r() * r();
    const R = LAST - Math.floor(r() * 10);
    a.push({ vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 1.25, R, u: r(), d: r(), len: 6 + r() * 14 });
  }
  return a;
})();

function drawParticles(ctx, t, L) {
  const fade = 1 - smooth(win(t, 10.12, 10.45));
  if (fade <= 0) return;
  const dt = Math.max(0, t - T.impact);
  const kd = 3.6;
  const ridges = {};
  ctx.strokeStyle = INK;
  for (const p of PARTS) {
    const e = (1 - Math.exp(-kd * dt)) / kd;
    const bx = 540 + p.vx * e, by = 960 + p.vy * e;
    const w = ease.inOut(win(t, 9.48 + p.d * 0.32, 9.98 + p.d * 0.3));
    if (!ridges[p.R]) ridges[p.R] = ridge(p.R, t, L);
    const rp = ridges[p.R];
    const i = Math.round(p.u * NS);
    const tx = rp[i * 2], ty = rp[i * 2 + 1];
    const x = lerp(bx, tx, w), y = lerp(by, ty, w);
    const vx = p.vx * Math.exp(-kd * dt), vy = p.vy * Math.exp(-kd * dt);
    let ang = Math.atan2(vy, vx);
    ang = lerp(ang, 0, w);
    const len = lerp(p.len * (1 + Math.hypot(vx, vy) / 900), 7, w);
    ctx.globalAlpha = 0.85 * fade;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(ang) * len / 2, y - Math.sin(ang) * len / 2);
    ctx.lineTo(x + Math.cos(ang) * len / 2, y + Math.sin(ang) * len / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// the four saved dots: thrown out of the barrel, then landing on October
function drawLanding(ctx, t, L) {
  const dt = Math.max(0, t - T.impact);
  SELECTED.forEach((d, k) => {
    const lt = landT(k);
    const ang = -2.3 + k * 0.55;
    const sp = 1700 + k * 220;
    const e = (1 - Math.exp(-3.2 * dt)) / 3.2;
    const fx = 540 + Math.cos(ang) * sp * e, fy = 960 + Math.sin(ang) * sp * e;
    const base = rowBase(LAST, L);
    const tx = dayX(d);
    const ty = base - (t > lt ? settle(t - lt, 2.0, 0.35) : 0) * L.amp * (1 - flatK(t)) + pulseAt(LAST, tx, t);
    const w = ease.flow(win(t, T.land[0] + k * 0.06, lt));
    const arc = Math.sin(Math.PI * w) * -160;
    const x = lerp(fx, tx, w), y = lerp(fy, ty, w) + arc;
    const r = lerp(14, 9, smooth(win(t, lt, lt + 0.3))) * (1 - smooth(win(t, T.logo[0], T.logo[0] + 0.4)));
    dot(ctx, x, y, r, PAL.flare, 1);
    if (t > lt && t < lt + 0.6) ringAt(ctx, tx, ty, 12 + (t - lt) * 160, PAL.flare, 2, 0.8 * (1 - (t - lt) / 0.6));
  });
}

// ── logotype geometry ─────────────────────────────────────────────────────
const LOGO = { text: 'corduroy', size: 252, vars: { wdth: 104, wght: 880, opsz: 144 }, base: 1050 };
let logoPolys = null;
function getLogo() {
  if (logoPolys) return logoPolys;
  const s = shape('flex', LOGO.text, { vars: LOGO.vars, tracking: -0.01 });
  const dotGap = 24, dotR = 20;
  LOGO.size = Math.min(LOGO.size, ((880 - dotGap - dotR * 2) * s.upem) / s.advance);
  const k = LOGO.size / s.upem;
  const w = s.advance * k;
  const total = w + dotGap + dotR * 2;
  const ox = 540 - total / 2;
  const polys = [];
  for (const g of s.glyphs) for (const c of g.contours) {
    const p = new Float32Array(c.length);
    for (let j = 0; j < c.length; j += 2) { p[j] = ox + (g.x + c[j]) * k; p[j + 1] = LOGO.base - c[j + 1] * k; }
    polys.push(p);
  }
  logoPolys = { polys, left: ox, right: ox + w, dotX: ox + w + dotGap + dotR, dotR };
  return logoPolys;
}
function spans(y) {
  const xs = [];
  for (const p of getLogo().polys) {
    const n = p.length;
    for (let j = 0; j < n; j += 2) {
      const x1 = p[j], y1 = p[j + 1], x2 = p[(j + 2) % n], y2 = p[(j + 3) % n];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

// ── draw ──────────────────────────────────────────────────────────────────
function drawAct56(ctx, t) {
  if (t < T.impact) return;
  const L = layout(t);
  const headerOut = 1 - smooth(win(t, 12.35, 12.75));
  const lineIn = smooth(win(t, 9.95, 10.3));
  const logoK = ease.inOut(win(t, T.logo[0], T.logo[1]));
  const LG = getLogo();

  // during the logo phase lines collect into an even stripe field around the word
  const stripeGap = 11.2;
  const logoMid = LOGO.base - LOGO.size * 0.3;

  // Ridges: top to bottom, each fill occludes what lies behind it
  const ridges = [];
  for (let R = 0; R < NR; R++) {
    let pts = ridge(R, t, L);
    const by = rowBase(R, L);
    let a = lineIn;
    const top = lerp(560, 470, L.z);
    if (by < top) { a *= clamp(1 - (top - by) / 50); if (a <= 0.01) continue; }
    if (by > 1720) continue;
    if (logoK > 0) {
      const target = logoMid + (R - LAST + 46.5) * stripeGap;
      const dy = (target - by) * logoK;
      for (let i = 1; i < pts.length; i += 2) pts[i] += dy;
    }
    ridges.push({ R, pts, a, by });
  }
  for (const rg of ridges) {
    const { pts, a, R } = rg;
    if (a <= 0.01) continue;
    if (logoK < 0.999 && flatK(t) < 0.98) {
      ctx.fillStyle = PAL.bone;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1] + 2);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1] + 2);
      ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1] + 120);
      ctx.lineTo(pts[0], pts[1] + 120);
      ctx.closePath();
      ctx.fill();
    }
    // thin line fades away from the letters as the logo forms
    const yMid = pts[NS + 1];
    const inBand = yMid > LOGO.base - LOGO.size * 0.8 && yMid < LOGO.base + LOGO.size * 0.26;
    const thinA = a * (1 - logoK * (inBand ? 0.92 : 1));
    const lw = lerp(lerp(2.2, 1.4, L.z), 1.6, logoK);
    strokeLine(ctx, Array.from(pts), INK, lw, thinA * 0.95);
    // October's new crests in flare
    if (R === LAST && logoK < 1) {
      const nl = landed(t);
      for (let k = 0; k < nl; k++) {
        const seg = [];
        for (let i = 0; i <= NS; i++) { const x = lerp(XL, XR, i / NS); if (Math.abs(x - NEWX[k]) < SIG * 2.6) seg.push(pts[i * 2], pts[i * 2 + 1]); }
        strokeLine(ctx, seg, PAL.flare, lw + 1.6, a * (1 - logoK));
      }
    }
    // stripes: the line thickens wherever it passes through a letter
    if (logoK > 0.35 && inBand) {
      const th = lerp(1.6, stripeGap * 0.6, ease.inOut(win(t, T.logo[0] + 0.35, T.logo[1] + 0.1)));
      const sp = spans(yMid);
      ctx.fillStyle = INK;
      ctx.globalAlpha = smooth(win(t, T.logo[0] + 0.3, T.logo[0] + 0.55));
      const shiftAmp = periodRipple(t, yMid) + 3 * Math.sin(yMid * 0.035 - t * 2.4) * smooth(win(t, 14.4, 15.0));
      for (const [xa, xb] of sp) ctx.fillRect(xa + shiftAmp, yMid - th / 2, xb - xa, th);
      ctx.globalAlpha = 1;
    }
  }

  drawParticles(ctx, t, L);
  if (t < T.logo[1]) drawLanding(ctx, t, L);

  // ── Labels ──
  const z = L.z;
  const monthA = (1 - smooth(clamp((z - 0.05) * 4))) * smooth(win(t, 10.0, 10.35)) * headerOut;
  const yearA = smooth(clamp((z - 0.55) * 3)) * headerOut;
  for (let R = 0; R < NR; R++) {
    const by = rowBase(R, L);
    const top = lerp(560, 470, L.z);
    if (by < top - 10 || by > 1720) continue;
    const { y, m } = ROWS[R];
    if (monthA > 0.01) {
      mono(ctx, MONTHS[m], 72, by + 7, 22, { color: INK, alpha: 0.6 * monthA, tracking: 0.14 });
      let c = GRID_PRIOR[y][m].count;
      if (R === LAST) c += landed(t);
      const isOct = R === LAST;
      mono(ctx, String(c), 1008, by + 8, isOct ? 30 : 26, { color: isOct && landed(t) > 0 ? PAL.flare : INK, align: 'right', alpha: (isOct ? 1 : 0.75) * monthA, wght: isOct ? 560 : 360 });
    }
    if (yearA > 0.01 && m === 5) {
      mono(ctx, String(y), 72, by + 8, 22, { color: y === 2026 ? PAL.flare : INK, alpha: 0.75 * yearA, tracking: 0.08, wght: y === 2026 ? 560 : 360 });
      mono(ctx, String(yearCount(GRID_ALL, y)), 1008, by + 8, 22, { color: INK, align: 'right', alpha: 0.6 * yearA });
    }
  }

  // ── Header ──
  // identity persists: the Surf disc returns, ink on bone
  const chipA = smooth(win(t, 10.05, 10.45)) * headerOut;
  if (chipA > 0) {
    discPattern(ctx, 108, 214, 34, t, 'surf', { color: INK, thick: 4.2, alpha: chipA, n: 7 });
    dot(ctx, 108 + 46 * 0.72, 214 - 46 * 0.72, 7, PAL.flare, chipA);
    type(ctx, 'Surf', 160, 230, 46, { color: INK, vars: { wdth: 100, wght: 520, opsz: 48 }, alpha: chipA });
    // explicit Month / Year browsing
    const tog = z > 0.5 ? 1 : 0;
    const ty = 214;
    ctx.globalAlpha = chipA; ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(782, ty - 26, 226, 52, 26); ctx.stroke();
    const kx = lerp(840, 950, ease.inOut(win(t, T.zoomOut[0] + 0.2, T.zoomOut[0] + 0.5)));
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(kx - 54, ty - 21, 108, 42, 21); ctx.fill();
    ctx.globalAlpha = 1;
    const kk = ease.inOut(win(t, T.zoomOut[0] + 0.2, T.zoomOut[0] + 0.5));
    mono(ctx, 'MONTH', 840, ty + 7, 18, { align: 'center', color: mixHex(PAL.bone, INK, kk), alpha: chipA, tracking: 0.14, wght: 500 });
    mono(ctx, 'YEAR', 950, ty + 7, 18, { align: 'center', color: mixHex(INK, PAL.bone, kk), alpha: chipA, tracking: 0.14, wght: 500 });
  }

  // 2026 title → all-time counter
  const yr = stats(ALL.filter((s) => s.y === 2026));
  const all = stats(ALL);
  const titleOut = ease.build(win(t, T.counter[0] - 0.12, T.counter[0] + 0.06));
  const titleA = smooth(win(t, 10.1, 10.5)) * (1 - titleOut);
  if (titleA > 0) {
    const cnt = yr.count - NEW.length + landed(t);
    type(ctx, '2026', 66, 420 - titleOut * 120 + (1 - smooth(win(t, 10.1, 10.5))) * 30, 190, { color: INK, vars: { wdth: 72, wght: 300, opsz: 144 }, alpha: titleA });
    mono(ctx, `${cnt} SESSIONS`, 1008, 360, 24, { color: INK, align: 'right', alpha: 0.8 * titleA, tracking: 0.12, wght: 500 });
    const knownSec = yr.sec;
    mono(ctx, `${fmtHours(knownSec).toUpperCase()} RECORDED`, 1008, 396, 18, { color: INK, align: 'right', alpha: 0.55 * titleA, tracking: 0.12 });
    mono(ctx, `DURATION ON ${yr.known} OF ${cnt}`, 1008, 424, 18, { color: INK, align: 'right', alpha: 0.4 * titleA, tracking: 0.12 });
  }
  const cIn = ease.flow(win(t, T.counter[0] + 0.04, T.counter[0] + 0.4));
  const cA = cIn * headerOut;
  if (cA > 0) {
    const k = ease.flow(win(t, T.counter[0], T.counter[1]));
    const n = Math.round(lerp(yr.count, all.count, k));
    const settleW = ease.inOut(win(t, T.counter[1] - 0.35, T.counter[1] + 0.1));
    ctx.save(); ctx.beginPath(); ctx.rect(0, 250, 760, 190); ctx.clip();
    type(ctx, String(n), 66, 420 + (1 - cIn) * 170, 190, { color: INK, vars: { wdth: lerp(151, 72, settleW), wght: lerp(160, 520, settleW), opsz: 144 }, alpha: cA });
    ctx.restore();
    mono(ctx, 'SESSIONS · 2019 — 2026', 1008, 360, 22, { color: INK, align: 'right', alpha: 0.8 * cA, tracking: 0.12, wght: 500 });
    const kh = Math.round(lerp(yr.sec, all.sec, k) / 900) * 900;
    mono(ctx, `${fmtHours(kh).toUpperCase()} RECORDED`, 1008, 396, 18, { color: INK, align: 'right', alpha: 0.55 * cA, tracking: 0.12 });
    mono(ctx, `DURATION ON ${Math.round(lerp(yr.known, all.known, k))} OF ${n}`, 1008, 424, 18, { color: INK, align: 'right', alpha: 0.4 * cA, tracking: 0.12 });
  }

  // confirmation, in the product's own voice
  const okA = smooth(win(t, 9.7, 10.0)) * (1 - smooth(win(t, 10.75, 11.0)));
  if (okA > 0) mono(ctx, '4 SESSIONS SAVED  ·  OCT 2026', 540, 1640, 20, { align: 'center', color: INK, alpha: 0.7 * okA, tracking: 0.16 });

  // ── Logo period + tagline ──
  if (t > T.period - 0.5) {
    const k = ease.build(win(t, T.period - 0.42, T.period));
    const y0 = LOGO.base - LG.dotR - 900, y1 = LOGO.base - LG.dotR;
    const y = lerp(y0, y1, k);
    const sq = t > T.period ? settle(t - T.period, 3, 0.3) : 0;
    ctx.save();
    ctx.translate(LG.dotX, y);
    ctx.scale(1 + 0.25 * (1 - sq) * (t > T.period ? 1 : 0), 1 - 0.2 * (1 - sq) * (t > T.period ? 1 : 0));
    dot(ctx, 0, 0, LG.dotR, PAL.flare, 1);
    ctx.restore();
    if (t > T.period) {
      const dt = t - T.period;
      ringAt(ctx, LG.dotX, y1, LG.dotR + dt * 420, PAL.flare, 2, 0.6 * Math.exp(-dt * 3.2));
    }
  }
  const tg = win(t, T.tagline[0], T.tagline[1]);
  if (tg > 0) {
    const txt = 'LOG THE SESSION. KEEP THE SWELL.';
    const n = Math.floor(txt.length * ease.flowIn(tg));
    mono(ctx, txt.slice(0, n), 540, LOGO.base + 150, 26, { align: 'center', color: INK, alpha: 0.85, tracking: 0.2, wght: 420 });
    const fa = smooth(win(t, T.tagline[1] - 0.2, T.tagline[1] + 0.3));
    mono(ctx, 'SURF  ·  RUN  ·  TRAIN  ·  ANYTHING YOU LIVE', 540, LOGO.base + 200, 17, { align: 'center', color: INK, alpha: 0.5 * fa, tracking: 0.22 });
    mono(ctx, 'CONCEPT FILM  ·  ILLUSTRATIVE DATA', 540, 1790, 15, { align: 'center', color: INK, alpha: 0.4 * fa, tracking: 0.24 });
  }
}

// stripes shear sideways as the period lands, then settle
function periodRipple(t, y) {
  const dt = t - T.period;
  if (dt <= 0) return 0;
  const d = Math.abs(y - (LOGO.base - 30));
  return 10 * Math.exp(-dt * 3.5) * Math.sin(dt * 22 - d * 0.05);
}

register(drawAct56);
