// III · CREST — the Surf identity unfolds into a living calendar.
// Each week is a swell line; days sit on it; a selected day lifts its line
// into a crest that carries a flare dot. Selections disturb the whole set and
// fill the Save control with energy.
import { T } from './timeline.js';
import { clamp, lerp, ease, win, smooth, settle, gauss, TAU, PAL, rgba } from '../lib/util.js';
import { W, H, strokeLine, dot, ringAt, type, mono } from './draw.js';
import { measure } from '../lib/text.js';
import { register } from './registry.js';
import { discState } from './act12.js';
import { LX0, LX1, COLX, ROWY, dayAt, cellOf, bandY, ROW_TO_LAYER, BAND_XSTART, PILL } from './shared.js';
import { SELECTED, PRIOR_OCT, TODAY } from './data.js';

export const TAPS = SELECTED.map((d, k) => ({ d, ...cellOf(d), t: T.taps[k] }));
const PRIOR = PRIOR_OCT.map((d) => ({ d, ...cellOf(d) }));
const today = cellOf(TODAY.d);

export const tension = (t) => TAPS.reduce((a, tp) => a + smooth(win(t, tp.t, tp.t + 0.45)), 0);
export const nSel = (t) => TAPS.filter((tp) => t >= tp.t + 0.02).length;

// Crest amount of a selected cell (negative = up), with press-in anticipation.
export function crest(tp, t) {
  const press = smooth(win(t, tp.t - 0.09, tp.t)) * (1 - smooth(win(t, tp.t, tp.t + 0.1)));
  return 16 * press - 66 * settle(t - tp.t - 0.02, 1.9, 0.36);
}

function unfoldP(r, t) {
  const s = T.unfold[0] + 0.07 * r;
  return { p: ease.flow(win(t, s, s + 0.95)), px: ease.flow(win(t, s - 0.04, s + 0.75)), raw: win(t, s, s + 0.95) };
}
export const drawback = (t) => ease.build(win(t, T.drawback[0], T.drawback[1]));

// Vertical displacement of week-line r at x.
export function disp(r, x, t) {
  const q = drawback(t);
  let y = 0;
  const ten = tension(t);
  y += (2 + 2.6 * ten) * Math.sin(x * 0.0065 + t * 1.6 + r * 0.8) * smooth(win(t, T.unfold[1] - 0.3, T.unfold[1] + 0.3));
  for (const tp of TAPS) {
    const x0 = COLX(tp.c);
    if (tp.r === r) y += crest(tp, t) * gauss(x - x0, 50) * (1 - q);
    const dt = t - tp.t;
    if (dt > 0 && dt < 1.6) {
      const dist = Math.hypot(x - x0, (ROWY[r] - ROWY[tp.r]) * 1.1);
      const front = dt * 760;
      y += 24 * Math.exp(-dt * 2.6) * gauss(dist - front, 75) * Math.sin((dist - front) * 0.085) * (1 - q);
    }
  }
  for (const pr of PRIOR) if (pr.r === r) y -= 9 * gauss(x - COLX(pr.c), 34) * (1 - q);
  const u = unfoldP(r, t);
  if (u.raw < 1) y += 18 * Math.sin(Math.PI * u.p) * Math.sin(x * 0.009 - t * 9 + r * 0.35);
  return y;
}

// The line's base geometry (before displacement) for row r at time t.
export function lineGeom(r, t) {
  const u = unfoldP(r, t);
  const ds = discState(t);
  const g = (2 * ds.R) / 7.6;
  const dy = (r - 2) * g;
  const chord = Math.sqrt(Math.max(0, ds.R * ds.R - dy * dy)) * 0.98;
  let x0 = lerp(ds.cx - chord, LX0, u.p);
  let x1 = lerp(ds.cx + chord, LX1, u.px);
  let y = lerp(ds.cy + dy, ROWY[r], ease.crest(u.raw));
  let w = lerp(g * 0.34, 2.4, ease.flow(clamp(u.raw * 1.4)));
  const q = drawback(t);
  if (q > 0) {
    y = lerp(ROWY[r], bandY(ROW_TO_LAYER[r]), q);
    x0 = lerp(LX0, BAND_XSTART, q);
    x1 = lerp(LX1, 1250, q);
    w = lerp(2.4, 2.2, q);
  }
  return { x0, x1, y, w, u };
}

export function linePts(r, t) {
  const G = lineGeom(r, t);
  const pts = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const x = lerp(G.x0, G.x1, i / N);
    pts.push(x, G.y + disp(r, x, t));
  }
  return { pts, G };
}

export const lineYAt = (r, x, t) => lineGeom(r, t).y + disp(r, x, t);

function finger(ctx, x, y, t, tp) {
  const dt = t - tp;
  if (dt < -0.16 || dt > 0.55) return;
  if (dt < 0) {
    const e = ease.flow(win(dt, -0.16, 0));
    ringAt(ctx, x, y, lerp(56, 34, e), PAL.foam, 2.5, e * 0.85);
    dot(ctx, x, y, 30, PAL.foam, 0.1 * e);
  } else {
    const e = ease.flow(dt / 0.55);
    ringAt(ctx, x, y, 34 + 130 * e, PAL.foam, lerp(2.5, 1, e), 0.85 * Math.pow(1 - dt / 0.55, 1.6));
    dot(ctx, x, y, 30 * (1 - e), PAL.foam, 0.1 * (1 - e));
  }
}

function roundRect(ctx, cx, cy, w, h) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2 + r, cy - h / 2);
  ctx.lineTo(cx + w / 2 - r, cy - h / 2);
  ctx.arc(cx + w / 2 - r, cy, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(cx - w / 2 + r, cy + h / 2);
  ctx.arc(cx - w / 2 + r, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

// Save control: the selection's energy rises inside it like a swell.
export function pillLevel(t) {
  let lev = 0;
  TAPS.forEach((tp, k) => { lev += (k === 0 ? 0.475 : 0.175) * settle(t - tp.t - 0.04, 1.3, 0.3); });
  return lev * 0.93;
}

export function pillSurface(x, t) {
  let slosh = 0;
  for (const tp of TAPS) { const dt = t - tp.t; if (dt > 0) slosh += Math.exp(-dt * 2.4); }
  const st = t - T.saveTap; if (st > 0) slosh += 2.5 * Math.exp(-st * 3);
  return (4 + 9 * slosh) * Math.sin(x * 0.017 - t * 5.2) + 3 * Math.sin(x * 0.043 + t * 3.1);
}

function drawPill(ctx, t, q) {
  const app = ease.flow(win(t, 5.0, 5.45));
  if (app <= 0) return;
  const press = smooth(win(t, T.saveTap - 0.08, T.saveTap)) * (1 - smooth(win(t, T.saveTap, T.saveTap + 0.14)));
  const { cx, cy, h } = PILL;
  const w = PILL.w * lerp(0.2, 1, app) * (1 - press * 0.03);
  const hh = h * (1 - press * 0.06);
  ctx.save();
  ctx.globalAlpha = 1 - smooth(q * 1.6);
  roundRect(ctx, cx, cy, w, hh);
  ctx.strokeStyle = rgba(PAL.foam, 0.35 * app);
  ctx.lineWidth = 2;
  ctx.stroke();
  roundRect(ctx, cx, cy, w, hh);
  ctx.clip();
  const lev = pillLevel(t);
  const bottom = cy + hh / 2;
  const surf = [];
  for (let i = 0; i <= 60; i++) {
    const x = cx - w / 2 + (w * i) / 60;
    surf.push(x, bottom - lev * hh + pillSurface(x, t) * Math.min(1, lev * 3));
  }
  if (lev > 0.001) {
    ctx.beginPath();
    ctx.moveTo(surf[0], surf[1]);
    for (let i = 2; i < surf.length; i += 2) ctx.lineTo(surf[i], surf[i + 1]);
    ctx.lineTo(cx + w / 2, bottom + 4); ctx.lineTo(cx - w / 2, bottom + 4); ctx.closePath();
    ctx.fillStyle = PAL.flare;
    ctx.fill();
  }
  // label slot-reel; duotone split by the liquid surface
  const n = nSel(t);
  const lastT = n > 0 ? TAPS[n - 1].t + 0.02 : 0;
  const k = n > 0 ? ease.flow(clamp((t - lastT) / 0.22)) : 1;
  const label = (m) => (m === 0 ? 'Select dates' : `Save ${m} session${m > 1 ? 's' : ''}`);
  const drawLabel = (m, dy, a) => {
    const opts = m === 0 ? null : { vars: { wdth: 100, wght: 560, opsz: 48 } };
    const draw = (col) => {
      if (m === 0) mono(ctx, label(m).toUpperCase(), cx, cy + 9 + dy, 24, { align: 'center', color: col, alpha: a * 0.6 * app, tracking: 0.16 });
      else type(ctx, label(m), cx, cy + 16 + dy, 46, { ...opts, align: 'center', color: col, alpha: a * app });
    };
    ctx.save();
    ctx.beginPath(); ctx.moveTo(surf[0], surf[1]);
    for (let i = 2; i < surf.length; i += 2) ctx.lineTo(surf[i], surf[i + 1]);
    ctx.lineTo(cx + w / 2, cy - hh); ctx.lineTo(cx - w / 2, cy - hh); ctx.closePath();
    ctx.clip(); draw(PAL.foam); ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.moveTo(surf[0], surf[1]);
    for (let i = 2; i < surf.length; i += 2) ctx.lineTo(surf[i], surf[i + 1]);
    ctx.lineTo(cx + w / 2, cy + hh); ctx.lineTo(cx - w / 2, cy + hh); ctx.closePath();
    ctx.clip(); draw(PAL.ink); ctx.restore();
  };
  if (k < 1) drawLabel(n - 1, -k * 70, 1 - k);
  drawLabel(n, (1 - k) * 70, k);
  ctx.restore();
}

function drawAct3(ctx, t) {
  if (t < T.unfold[0] || t > T.drawback[1] + 0.001) return;
  const q = drawback(t);
  const push = 1 + 0.022 * ease.swell(win(t, 6.62, T.saveTap + 0.1));
  ctx.save();
  ctx.translate(540, 1150); ctx.scale(push, push); ctx.translate(-540, -1150);

  const content = (1 - smooth(q * 2.2));
  const drift = q * 260;

  // Month title: gathers from wide/light to condensed (tension)
  const ta = win(t, 4.5, 5.3);
  if (ta > 0) {
    const e = ease.flow(ta);
    const wd = lerp(151, 58, e) + q * 93;
    const wg = lerp(110, 300, e);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 300, W, 248 + drift); ctx.clip();
    type(ctx, 'October', 72, 524 + (1 - e) * 60 + drift * 0.6, 186, {
      vars: { wdth: wd, wght: wg, opsz: 144 }, alpha: content, tracking: q * 0.08,
      perGlyph: (i) => ({ dy: (1 - ease.flow(clamp(ta * 1.5 - i * 0.07))) * 120 }),
    });
    ctx.restore();
    const ya = smooth(win(t, 4.9, 5.4)) * content;
    mono(ctx, '2026', 1008 - 34, 400 + drift * 0.6, 26, { align: 'right', alpha: 0.6 * ya, tracking: 0.14 });
    // month navigation chevrons
    ctx.globalAlpha = 0.5 * ya; ctx.strokeStyle = PAL.foam; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    const cy = 391 + drift * 0.6;
    ctx.beginPath(); ctx.moveTo(1004, cy - 9); ctx.lineTo(1012, cy); ctx.lineTo(1004, cy + 9); ctx.stroke();
    const lx = 1008 - 34 - measure('mono', '2026', 26, { vars: { wght: 340, wdth: 87.5 }, tracking: 0.14 }) - 22;
    ctx.beginPath(); ctx.moveTo(lx + 8, cy - 9); ctx.lineTo(lx, cy); ctx.lineTo(lx + 8, cy + 9); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Weekday header
  const wa = smooth(win(t, 4.85, 5.3)) * content;
  'MTWTFSS'.split('').forEach((ch, c) => mono(ctx, ch, COLX(c), 640 + drift, 22, { align: 'center', alpha: 0.42 * wa, wght: 400 }));

  // Week lines
  for (let r = 0; r < 5; r++) {
    const { pts, G } = linePts(r, t);
    if (G.u.raw <= 0) continue;
    strokeLine(ctx, pts, PAL.foam, G.w, 1);
  }

  // Cells: ticks, numerals, prior sessions, today
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 7; c++) {
      const d = dayAt(r, c);
      const inMonth = d >= 1 && d <= 31;
      const ap = ease.flow(win(t, 4.72 + 0.026 * c + 0.05 * r, 5.1 + 0.026 * c + 0.05 * r));
      if (ap <= 0) continue;
      const x = COLX(c);
      const ly = lineYAt(r, x, t);
      const tp = TAPS.find((s) => s.r === r && s.c === c);
      const sel = tp ? smooth(win(t, tp.t - 0.02, tp.t + 0.18)) : 0;
      const a = ap * content;
      // tick
      if (!tp || sel < 0.5) {
        ctx.globalAlpha = 0.38 * a * (1 - sel);
        ctx.fillStyle = PAL.foam;
        ctx.fillRect(x - 1, ly - 6, 2, 12);
        ctx.globalAlpha = 1;
      }
      const label = String(d <= 0 ? 30 + d : d > 31 ? d - 31 : d);
      const isToday = r === today.r && c === today.c;
      mono(ctx, label, x, ly - 30 - sel * 14 + (1 - ap) * 26, 36 + sel * 8, {
        align: 'center', alpha: a * (inMonth ? 0.92 : 0.2), wght: isToday || sel > 0.5 ? 560 : 330, tracking: 0,
      });
      if (isToday) mono(ctx, 'TODAY', x, ROWY[r] + 38 + drift, 15, { align: 'center', alpha: 0.5 * a, tracking: 0.22 });
    }
  }
  for (const pr of PRIOR) {
    const ap = ease.flow(win(t, 5.0, 5.4)) * content;
    const x = COLX(pr.c);
    ringAt(ctx, x, lineYAt(pr.r, x, t), 9, PAL.foam, 2, 0.85 * ap);
  }

  // Selected dots ride their crests
  for (const tp of TAPS) {
    const dt = t - tp.t;
    if (dt < 0) continue;
    const x = COLX(tp.c);
    const y = lineYAt(tp.r, x, t);
    const s = settle(dt, 2.6, 0.4);
    dot(ctx, x, y, 12 * s, PAL.flare, 1, 26);
  }

  // Optional details: present, never in the way
  const oa = smooth(win(t, 5.15, 5.55)) * content;
  mono(ctx, '+  NOTE  ·  PLACE  ·  TIME', LX0, 1588 + drift, 20, { alpha: 0.5 * oa, tracking: 0.12 });
  mono(ctx, 'OPTIONAL', LX1, 1588 + drift, 16, { align: 'right', alpha: 0.3 * oa, tracking: 0.24 });

  drawPill(ctx, t, q);

  // Fingers
  for (const tp of TAPS) finger(ctx, COLX(tp.c), ROWY[tp.r] - 14, t, tp.t);
  finger(ctx, 772, PILL.cy, t, T.saveTap);

  ctx.restore();
}

register(drawAct3);
