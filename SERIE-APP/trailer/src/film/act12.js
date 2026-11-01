// I · SWELL and II · BUILD
// A single horizon line multiplies into a perspective field of swell lines
// ("corduroy to the horizon"). The camera cranes up and over until the field
// is seen from above, then a circular window closes on it: the Surf identity
// is literally a porthole onto the moving swell.
import { T } from './timeline.js';
import { clamp, lerp, ease, win, smooth, settle, TAU, gauss, noise1, PAL, rgba } from '../lib/util.js';
import { W, H, strokeLine, dot, type, mono } from './draw.js';
import { measure } from '../lib/text.js';

const F = 1400;          // focal length, px
const DZ = 0.5;          // spacing between swell lines on the plane
const ZT = 30;           // camera target on the plane

export const ACTS = {
  surf: { name: 'Surf', color: PAL.flare },
  run: { name: 'Run', color: '#C9F06A' },
  train: { name: 'Train', color: '#B9A8FF' },
  travel: { name: 'Travel', color: '#F3C46E' },
};
const FLICK = ['surf', 'run', 'train', 'travel', 'surf'];

// Camera orbit: elevation phi, distance R, screen centre cy.
function camera(t) {
  const k = ease.inOutQuint(win(t, T.tilt[0], T.tilt[1]));
  const phi = lerp(0.1, Math.PI / 2, k);
  // crane: lift during the tilt, then drop back in as the disc window closes
  const descend = ease.inOut(win(t, T.disc[0], T.disc[1]));
  const R = lerp(lerp(10, 24, ease.swell(win(t, T.tilt[0] - 0.1, T.tilt[1]))), (F * DZ * 7.6) / 500, descend);
  const cy = lerp(840, 820, k);
  // the passing swell lifts the camera a little
  const ride = 0.35 * gauss(t - 1.95, 0.32) * (1 - k);
  return { phi, R, cy, ride, k };
}

function height(X, Z, t) {
  let h = 0.05 * Math.sin(0.9 * X + 1.6 * Z - 2.2 * t)
    + 0.035 * Math.sin(-0.6 * X + 2.3 * Z - 2.9 * t)
    + 0.018 * Math.sin(1.7 * X + 0.7 * Z - 3.4 * t);
  const sp = win(t, T.swellPass[0], T.swellPass[1]);
  if (sp > 0 && sp < 1) {
    const Zs = lerp(ZT + 45, ZT - 6, ease.swell(sp));
    const bend = 0.004 * X * X;
    h += 1.05 * Math.exp(-Math.pow((Z - Zs - bend) / 2.0, 2)) * (1 + 0.2 * Math.sin(0.25 * X + t));
  }
  return h;
}

function project(cam, X, Y, Z) {
  // camera position on the orbit around (0, 0, ZT)
  const cp = Math.cos(cam.phi), sp = Math.sin(cam.phi);
  const Cy = cam.R * sp + cam.ride, Cz = ZT - cam.R * cp;
  const dy = Y - Cy, dz = Z - Cz;
  // forward = (0, -sp, cp), up = (0, cp, sp)
  const zc = -dy * sp + dz * cp;
  const yc = dy * cp + dz * sp;
  if (zc < 0.15) return null;
  return [540 + (F * X) / zc, cam.cy - (F * yc) / zc, zc];
}

// The scrolling field of lines as screen polylines.
function fieldLines(t, cam) {
  const scroll = (t * 0.55) % DZ;
  const lines = [];
  const unfold = win(t, T.unfoldField[0], T.unfoldField[1]);
  const Zfar = ZT + 70;
  const nMax = 150;
  for (let i = 0; i < nMax; i++) {
    const Zreal = ZT - 9.4 + i * DZ - scroll;
    if (Zreal > Zfar) break;
    const depth = (Zreal - (ZT - 10)) / 80; // 0 near .. 1 far
    // lines peel off the horizon line and cascade toward the viewer
    const d0 = T.unfoldField[0] + (1 - depth) * 0.0 + depth * 0.05;
    const pk = cam.k > 0 ? 1 : ease.flow(clamp((t - d0 - (1 - Math.pow(depth, 0.6)) * 0.35) / 0.75));
    const Z = t < T.unfoldField[0] ? Zfar : lerp(Zfar, Zreal, pk);
    const pts = [];
    let zc0 = 0;
    const N = 72;
    // sample in X so the line spans the screen at its depth
    const pc = project(cam, 0, 0, Z);
    if (!pc) continue;
    const span = (720 * pc[2]) / F + 0.5;
    for (let s = 0; s <= N; s++) {
      const X = -span + (2 * span * s) / N;
      const p = project(cam, X, height(X, Z, t), Z);
      if (!p) continue;
      pts.push(p[0], p[1]);
      zc0 = p[2];
    }
    lines.push({ pts, zc: zc0, Z, i, pk, depth });
  }
  return lines;
}

function drawField(ctx, t, cam, alphaMul = 1, o = {}) {
  const lines = fieldLines(t, cam);
  const drawExtent = ease.flow(win(t, T.lineDraw[0], T.lineDraw[1]));
  const firstOnly = t < T.unfoldField[0] + 0.02;
  const sun = o.sun ?? 0;
  const thickIn = o.thick ?? 0;
  // far → near so every crest hides what lies behind it (hidden-line swell)
  for (let n = lines.length - 1; n >= 0; n--) {
    const L = lines[n];
    if (firstOnly && n !== lines.length - 1) continue;
    const next = lines[n + 1];
    const yc = L.pts.length > 70 ? L.pts[73] : L.pts[1];
    const spacing = next && next.pts.length > 70 ? Math.abs(yc - next.pts[73]) : 20;
    const fog = clamp(1.15 - L.zc / 60) ** 1.2 * smooth((spacing - 0.8) / 9);
    let a = fog * alphaMul;
    let w = clamp(26 / L.zc, 0.6, 3.0);
    if (firstOnly) { a = 1; w = 2.2; }
    w = lerp(w, 3.0, cam.k);
    if (thickIn) w = lerp(w, thickIn, 1);
    a = lerp(a, 0.9 * alphaMul, cam.k);
    if (!firstOnly && cam.k === 0) { a = lerp(0.95, a, ease.flowIn(L.pk)); w = lerp(2.2, w, L.pk); }
    let pts = L.pts;
    if (drawExtent < 1) {
      const half = 560 * drawExtent;
      const out = [];
      for (let j = 0; j < pts.length; j += 2) if (Math.abs(pts[j] - 540) <= half) out.push(pts[j], pts[j + 1]);
      pts = out;
    }
    if (pts.length < 4) continue;
    if (!firstOnly && cam.k < 0.98 && !o.noFill) {
      ctx.fillStyle = PAL.ink;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let j = 2; j < pts.length; j += 2) ctx.lineTo(pts[j], pts[j + 1]);
      ctx.lineTo(pts[pts.length - 2], H + 20);
      ctx.lineTo(pts[0], H + 20);
      ctx.closePath();
      ctx.fill();
    }
    strokeLine(ctx, pts, PAL.foam, w, a);
    // sun path: glints of flare on the water under the sun
    if (sun > 0 && !firstOnly && a > 0.02) {
      const half = 34 + 150 / L.zc;
      const seg = [];
      for (let j = 0; j < pts.length; j += 2) if (Math.abs(pts[j] - 540) < half) seg.push(pts[j], pts[j + 1]);
      if (seg.length >= 4) {
        const flick = 0.35 + 0.65 * noise1(t * 5 + L.i * 1.37, 3);
        ctx.save();
        const r = (L.i * 7919) % 97;
        ctx.setLineDash([6 + (r % 23), 4 + (r % 11), 3 + (r % 7), 9 + (r % 13)]);
        ctx.lineDashOffset = r * 3 + t * 40;
        strokeLine(ctx, seg, PAL.flareHot, w * 1.2, sun * flick * Math.min(1, a * 1.6));
        ctx.restore();
      }
    }
  }
}

// ── The identity disc ──────────────────────────────────────────────────────
// A circular window over striped motion. Each activity has its own pattern.
export function discPattern(ctx, cx, cy, R, t, kind, o = {}) {
  const n = o.n ?? 7;
  const g = (2 * R) / (n + 0.6);
  const thick = o.thick ?? g * 0.34;
  const alpha = o.alpha ?? 1;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.clip();
  const ph = o.phase ?? (((t * 1.1 + 0.8) % 1) * g);
  ctx.lineCap = 'butt';
  for (let j = -n - 3; j < n + 3; j++) {
    const y0 = cy + ph + j * g;
    if (y0 < cy - R - g * 1.5 || y0 > cy + R + g * 1.5) continue;
    const pts = [];
    let wj = thick;
    if (kind === 'train') wj = thick * (0.55 + 0.9 * Math.max(0, Math.sin(t * 9 - j * 0.9)));
    for (let s = 0; s <= 40; s++) {
      const x = cx - R - 4 + ((2 * R + 8) * s) / 40;
      let y = y0;
      if (kind === 'surf') {
        const u = (x - cx) / R;
        const crest = 0.5 + 0.5 * Math.sin(-(y0 - cy) / R * 1.2 + 0.4);
        y += g * 0.32 * (o.amp ?? 1) * Math.sin(u * 3.2 - t * 3.2 + j * 0.55) * (0.6 + 0.6 * crest);
      }
      pts.push(x, y);
    }
    ctx.save();
    if (kind === 'travel') {
      ctx.translate(cx, cy); ctx.rotate(-0.5); ctx.translate(-cx, -cy);
      const drift = ((t * 140) % g);
      for (let s = 1; s < pts.length; s += 2) pts[s] += drift;
    }
    if (kind === 'run') {
      ctx.setLineDash([g * 0.9, g * 0.35]);
      ctx.lineDashOffset = (j % 2 ? 1 : -1) * t * 260;
    }
    strokeLine(ctx, pts, o.color || PAL.foam, wj, alpha);
    ctx.setLineDash([]);
    ctx.restore();
  }
  ctx.restore();
  if (o.rim) {
    ctx.globalAlpha = alpha * o.rim;
    ctx.strokeStyle = PAL.foam;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R + (o.rimGap ?? 10), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// Disc state over time (shared with the calendar act for continuity).
export function discState(t) {
  const form = ease.inOut(win(t, T.disc[0], T.disc[1]));
  const dock = ease.inOutQuint(win(t, T.dock[0], T.dock[1]));
  const R0 = lerp(1300, 250, form);
  const cx = lerp(540, 124, dock);
  const cy = lerp(820, 248, dock);
  const R = lerp(R0, 46, dock);
  // a little squash on every identity flick
  let squash = 0;
  for (const ts of T.flickSteps.slice(1)) squash += 0.11 * Math.exp(-Math.max(0, t - ts) * 14) * (t > ts ? Math.cos((t - ts) * 40) : 0);
  let kind = 'surf';
  for (let i = 0; i < T.flickSteps.length; i++) if (t >= T.flickSteps[i]) kind = FLICK[i];
  return { cx, cy, R, form, dock, squash, kind };
}

export function drawAct12(ctx, t) {
  if (t > T.drawback[1]) return;
  const cam = camera(t);
  const ds = discState(t);

  // Field before the disc window closes
  const discIn = smooth(win(t, T.disc[1] - 0.22, T.disc[1]));
  if (t < T.disc[1] + 0.02) {
    const sunAmt = smooth(win(t, 0.95, 1.4)) * (1 - smooth(win(t, T.tilt[0], T.tilt[0] + 0.45)));
    if (ds.form > 0) {
      const gF = (2 * 250) / 7.6;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(ds.cx, ds.cy, ds.R, 0, TAU, true); ctx.clip();
      drawField(ctx, t, cam, 1 - smooth(clamp(ds.form * 1.5)), {});
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.arc(ds.cx, ds.cy, ds.R, 0, TAU); ctx.clip();
      drawField(ctx, t, cam, 1 - discIn, { thick: lerp(3, gF * 0.34, smooth(ds.form)), noFill: true });
      ctx.restore();
    } else {
      drawField(ctx, t, cam, 1, { sun: sunAmt });
    }
  }

  // The sun: a single flare dot rising on the horizon
  if (t < T.disc[1]) {
    const k = cam.k;
    const horizonY = cam.cy - F * Math.tan(cam.phi);
    const rise = ease.flow(win(t, T.sunRise[0], T.sunRise[1]));
    let sx = 540, sy = Math.max(170, lerp(horizonY + 26, horizonY - 34, rise));
    // during the tilt the sun travels to the disc
    const toDisc = ease.inOut(win(t, T.tilt[0] + 0.2, T.disc[1] - 0.1));
    const target = discDotPos(ds);
    sx = lerp(sx, target[0], toDisc);
    sy = lerp(sy, target[1], toDisc);
    ctx.save();
    if (toDisc < 0.05) { ctx.beginPath(); ctx.rect(0, 0, W, horizonY - 1.5); ctx.clip(); }
    dot(ctx, sx, sy, lerp(15, 22, toDisc), PAL.flare, rise, 30);
    ctx.restore();
  }

  // Header exits upward as the water draws back
  const qb = ease.build(win(t, T.drawback[0], T.drawback[1]));
  ctx.save();
  ctx.translate(0, -qb * 340);
  // The disc
  if (ds.form > 0) {
    const R = ds.R * (1 + ds.squash);
    const fadeOut = 0;
    const flickIdx = T.flickSteps.findIndex((s, i) => t >= s && (i === T.flickSteps.length - 1 || t < T.flickSteps[i + 1]));
    const kind = ds.kind;
    const col = ACTS[kind].color;
    const thick = ((2 * R) / 7.6) * 0.34;
    discPattern(ctx, ds.cx, ds.cy, R, t, kind, { thick, alpha: discIn, amp: ease.swell(win(t, T.disc[1] - 0.02, T.disc[1] + 0.45)), rim: smooth(win(t, T.disc[1] - 0.2, T.disc[1] + 0.2)) * 0.35 * (1 - ds.dock * 0.5), rimGap: lerp(16, 8, ds.dock) });
    if (t >= T.disc[1] - 0.1) {
      const p = discDotPos(ds);
      dot(ctx, p[0], p[1], lerp(22, 9, ds.dock), col, 1, 24);
    }
  }

  // The word: Surf → Run → Train → Travel → Surf, then it docks into the header
  drawWord(ctx, t, ds);
  ctx.restore();
}

export function discDotPos(ds) {
  const a = -Math.PI / 4;
  const r = ds.R + lerp(46, 14, ds.dock);
  return [ds.cx + Math.cos(a) * r, ds.cy + Math.sin(a) * r];
}

const WORDS = { surf: 'Surf', run: 'Run', train: 'Train', travel: 'Travel' };
function drawWord(ctx, t, ds) {
  const appear = win(t, T.word[0], T.word[1]);
  if (appear <= 0) return;
  const dock = ds.dock;
  const size = lerp(250, 64, dock);
  const baseY = lerp(1290, 271, dock);
  const breath = ease.flow(appear);
  // exhale: compressed and heavy → open and light
  const wdth = lerp(lerp(25, 112, breath), 100, dock);
  const wght = lerp(lerp(860, 330, breath), 520, dock);
  const vars = { wdth, wght, opsz: 144 };

  // slot-reel flick between identities
  let idx = 0;
  for (let i = 0; i < T.flickSteps.length; i++) if (t >= T.flickSteps[i]) idx = i;
  const tIn = t - T.flickSteps[idx];
  const reel = idx === 0 ? 1 : ease.flow(clamp(tIn / 0.1));
  const cur = WORDS[FLICK[idx]];
  const prev = idx > 0 ? WORDS[FLICK[idx - 1]] : null;

  const wCur = measure('flex', cur, size, { vars });
  const leftC = 540 - wCur / 2;
  const left = lerp(leftC, 196, dock);

  ctx.save();
  // surfacing mask: letters rise out of a horizontal waterline
  const clipTop = baseY - size * 1.1, clipBot = baseY + size * 0.28;
  ctx.beginPath(); ctx.rect(0, clipTop, W, clipBot - clipTop); ctx.clip();
  const rise = (1 - ease.flow(appear)) * size * 1.0;
  type(ctx, cur, left, baseY + rise + (1 - reel) * size * 0.9, size, {
    vars, perGlyph: (i) => ({ dy: (1 - ease.flow(clamp((appear * 1.6) - i * 0.12))) * size * 0.6 }),
  });
  if (prev && reel < 1) {
    const wPrev = measure('flex', prev, size, { vars });
    type(ctx, prev, lerp(540 - wPrev / 2, 196, dock), baseY - reel * size * 1.0, size, { vars, alpha: 1 - reel });
  }
  ctx.restore();

  // caption under the hero word: which activity of how many
  const capA = smooth(win(t, T.word[0] + 0.3, T.word[1])) * (1 - smooth(win(t, T.dock[0], T.dock[0] + 0.25)));
  const order = { surf: 1, run: 2, train: 3, travel: 4 };
  mono(ctx, `ACTIVITY  0${order[FLICK[idx]]} / 04`, 540, 1380, 24, { align: 'center', alpha: capA * 0.55, tracking: 0.18 });

  // switching affordance appears once docked
  const chev = smooth(win(t, T.dock[1] - 0.15, T.dock[1] + 0.2));
  if (chev > 0) {
    const wDock = measure('flex', 'Surf', 64, { vars: { wdth: 100, wght: 520, opsz: 144 } });
    const x = 196 + wDock + 26, y = 250;
    ctx.globalAlpha = chev * 0.8;
    ctx.strokeStyle = PAL.foam; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - 6 + (1 - chev) * 8); ctx.lineTo(x + 11, y + 5 + (1 - chev) * 8); ctx.lineTo(x + 22, y - 6 + (1 - chev) * 8); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
