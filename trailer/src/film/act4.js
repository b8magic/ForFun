// IV · BREAK — saving releases the accumulated energy.
// The week-lines (now a dense band of water) rise into a wave built from a
// single turtle curve: flat → back slope → crest → a clothoid lip whose
// curvature grows toward its tip. 26 layers are exact normal offsets of that
// skin, so the water stays coherent as it curls. The saved dots ride the outer
// layers over the lip, the camera dives into the barrel, and the barrel spits
// us out into white water.
import { T } from './timeline.js';
import { clamp, lerp, ease, win, smooth, settle, gauss, TAU, rng, hash, PAL, rgba } from '../lib/util.js';
import { W, H, strokeLine, dot, ringAt, type, mono } from './draw.js';
import { register } from './registry.js';
import { BAND_N, bandY, BAND_GAP, BAND_Y0, ROW_TO_LAYER, COLX } from './shared.js';
import { TAPS, pillLevel } from './act3.js';

const XSTART = -1400;
const SA = 640;        // arc length where the back of the wave begins
const DS = 7;          // integration step

export function waveParams(t) {
  const alpha = 0.92 * ease.inOut(win(t, T.rise[0], T.rise[1]));
  const theta = 0.42 * Math.PI * ease.inOut(win(t, 7.72, 8.12)) + 1.0 * Math.PI * ease.inOut(win(t, T.curl[0], T.curl[1]));
  const p = lerp(0.62, 2.7, ease.inOut(win(t, T.curl[0] - 0.1, T.curl[1] - 0.05)));
  const Lb = 1720;
  const Ll = 980;
  const gap = lerp(BAND_GAP, 12.5, ease.inOut(win(t, 7.7, 8.3)));
  const taper = 15 * ease.inOut(win(t, 8.0, 8.7));
  return { alpha, theta, p, Lb, Ll, gap, taper };
}

function heading(s, P) {
  if (s < SA) return 0;
  if (s < SA + P.Lb) return -P.alpha * Math.sin((Math.PI * (s - SA)) / P.Lb);
  const u = (s - SA - P.Lb) / P.Ll;
  return P.theta * Math.pow(Math.min(u, 1.2), P.p);
}

// Skin (layer 0): arrays of x, y, heading per sample.
export function skin(t) {
  const P = waveParams(t);
  const L = SA + P.Lb + P.Ll;
  const n = Math.ceil(L / DS);
  const X = new Float32Array(n + 1), Y = new Float32Array(n + 1), PH = new Float32Array(n + 1);
  let x = XSTART, y = BAND_Y0;
  X[0] = x; Y[0] = y; PH[0] = 0;
  for (let i = 1; i <= n; i++) {
    const s = i * DS;
    const ph = heading(s - DS / 2, P);
    x += Math.cos(ph) * DS; y += Math.sin(ph) * DS;
    X[i] = x; Y[i] = y; PH[i] = heading(s, P);
  }
  return { X, Y, PH, n, P, L };
}

// Point on layer i at arc length s.
export function layerPoint(S, i, s) {
  const k = clamp(s / DS, 0, S.n);
  const j = Math.min(S.n - 1, Math.floor(k));
  const f = k - j;
  const x = lerp(S.X[j], S.X[j + 1], f), y = lerp(S.Y[j], S.Y[j + 1], f);
  const ph = lerp(S.PH[j], S.PH[j + 1], f);
  const d = i * S.P.gap;
  return [x + Math.sin(ph) * d, y - Math.cos(ph) * d, ph];
}

export const layerEnd = (S, i) => S.L - i * S.P.taper;

function layerPts(S, i, s0 = 0, s1 = null) {
  const end = s1 ?? layerEnd(S, i);
  const pts = [];
  const d = i * S.P.gap;
  for (let j = Math.max(0, Math.floor(s0 / DS)); j <= S.n; j++) {
    if (j * DS > end) {
      const p = layerPoint(S, i, end);
      pts.push(p[0], p[1]);
      break;
    }
    pts.push(S.X[j] + Math.sin(S.PH[j]) * d, S.Y[j] - Math.cos(S.PH[j]) * d);
  }
  return pts;
}

// Eye of the barrel: centre of curvature at the tip of the skin.
export function eye(S) {
  const P = S.P;
  const k = Math.max(1e-4, (P.theta * P.p) / P.Ll);
  const rho = Math.min(600, 1 / k);
  const tip = layerPoint(S, 0, S.L);
  return [tip[0] - Math.sin(tip[2]) * rho * 0.75, tip[1] + Math.cos(tip[2]) * rho * 0.75];
}

// ── Camera ────────────────────────────────────────────────────────────────
export function cam4(t, S) {
  const back = ease.inOut(win(t, 7.62, 8.5));
  let sc = lerp(1, 0.74, back);
  let rot = lerp(0, -0.04, back);
  let px = 540, py = 1500;            // pivot in world
  let tx = lerp(540, 440, back), ty = lerp(1500, 1440, back);
  const z = win(t, T.tube[0], T.tube[0] + 0.62);
  if (z > 0) {
    const E = eyeAt(T.tube[0]);
    const zz = Math.pow(z, 1.8);
    px = lerp(px, E[0], ease.inOut(clamp(z * 3)));
    py = lerp(py, E[1], ease.inOut(clamp(z * 3)));
    tx = lerp(tx, 540, ease.inOut(clamp(z * 2.2)));
    ty = lerp(ty, 960, ease.inOut(clamp(z * 2.2)));
    sc = sc * Math.exp(4.6 * zz);
    rot += 1.1 * zz;
  }
  return { sc, rot, px, py, tx, ty, z };
}
const eyeCache = new Map();
function eyeAt(t) {
  if (!eyeCache.has(t)) eyeCache.set(t, eye(skin(t)));
  return eyeCache.get(t);
}
export function applyCam(ctx, C) {
  ctx.translate(C.tx, C.ty);
  ctx.rotate(C.rot);
  ctx.scale(C.sc, C.sc);
  ctx.translate(-C.px, -C.py);
}

// ── Spray ─────────────────────────────────────────────────────────────────
const SPRAY = (() => {
  const r = rng(77);
  const arr = [];
  for (let i = 0; i < 520; i++) {
    arr.push({ tb: lerp(8.05, 8.85, Math.pow(r(), 0.8)), layer: Math.floor(r() * BAND_N), v: 0.55 + r() * 0.8, jx: r() - 0.5, jy: r() - 0.5, len: 6 + r() * 18, hot: r() < 0.05, life: 0.35 + r() * 0.5 });
  }
  return arr;
})();
const tipCache = new Map();
function tipState(tb, layer) {
  const key = `${Math.round(tb * 240)}|${layer}`;
  let v = tipCache.get(key);
  if (!v) {
    const tq = Math.round(tb * 240) / 240;
    const S0 = skin(tq), S1 = skin(tq + 1 / 120);
    const a = layerPoint(S0, layer, layerEnd(S0, layer)), b = layerPoint(S1, layer, layerEnd(S1, layer));
    v = { x: a[0], y: a[1], vx: (b[0] - a[0]) * 120, vy: (b[1] - a[1]) * 120, ph: a[2] };
    tipCache.set(key, v);
    if (tipCache.size > 6000) tipCache.clear();
  }
  return v;
}

function drawSpray(ctx, t, sc) {
  for (const p of SPRAY) {
    const dt = t - p.tb;
    if (dt < 0 || dt > p.life) continue;
    const s0 = tipState(p.tb, p.layer);
    const sp = Math.hypot(s0.vx, s0.vy) + 1;
    const vx = s0.vx * p.v + p.jx * 900 + Math.cos(s0.ph) * 500;
    const vy = s0.vy * p.v + p.jy * 900 + Math.sin(s0.ph) * 500 - 300;
    const g = 2600;
    const x = s0.x + vx * dt, y = s0.y + vy * dt + 0.5 * g * dt * dt;
    const cvx = vx, cvy = vy + g * dt;
    const cs = Math.hypot(cvx, cvy) + 1e-3;
    const L = p.len * (0.5 + cs / 2200);
    const a = (1 - dt / p.life) * 0.95;
    ctx.globalAlpha = a;
    ctx.strokeStyle = p.hot ? PAL.flareHot : PAL.foam;
    ctx.lineWidth = (p.hot ? 3 : 2) / Math.sqrt(sc);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - (cvx / cs) * L, y - (cvy / cs) * L);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ── Dots riding the lip ───────────────────────────────────────────────────
function dotState(S, k, t) {
  const tp = TAPS[k];
  const layer = ROW_TO_LAYER[tp.r];
  const s0 = COLX(tp.c) - XSTART;
  const end = layerEnd(S, layer);
  const e = ease.inOut(win(t, 7.72 + k * 0.025, 8.6 + k * 0.05));
  const s = lerp(s0, end + 120, e);
  if (s <= end) {
    const p = layerPoint(S, layer, s);
    return { x: p[0], y: p[1], s, layer, free: 0 };
  }
  // launched off the lip
  const tip = layerPoint(S, layer, end);
  const over = s - end;
  return { x: tip[0] + Math.cos(tip[2]) * over, y: tip[1] + Math.sin(tip[2]) * over, s, layer, free: over };
}

function drawDots(ctx, S, t, sc) {
  TAPS.forEach((tp, k) => {
    const D = dotState(S, k, t);
    // trail along the layer behind the dot
    const tl = 340;
    const segs = 8;
    for (let q = 0; q < segs; q++) {
      const a0 = Math.max(0, Math.min(D.s, layerEnd(S, D.layer)) - tl * (q + 1) / segs);
      const a1 = Math.max(0, Math.min(D.s, layerEnd(S, D.layer)) - tl * q / segs);
      if (a1 <= a0 + 1) continue;
      const pts = layerPts(S, D.layer, a0, a1);
      strokeLine(ctx, pts, PAL.flare, (5 - q * 0.45) / Math.sqrt(sc), (1 - q / segs) * 0.9 * smooth(win(t, 7.75, 7.95)));
    }
    if (D.free > 0) {
      const tip = layerPoint(S, D.layer, layerEnd(S, D.layer));
      strokeLine(ctx, [tip[0], tip[1], D.x, D.y], PAL.flare, 4 / Math.sqrt(sc), 0.6);
    }
    dot(ctx, D.x, D.y, 12 / Math.pow(sc, 0.3), PAL.flare, 1, 26);
  });
}

// ── Barrel interior ───────────────────────────────────────────────────────
function drawTube(ctx, t) {
  const k = win(t, T.tube[0] + 0.18, T.impact);
  if (k <= 0) return;
  const cx = 540, cy = 960;
  const appear = smooth(clamp(k * 4));
  const travel = (t - T.tube[0]) * 2.0 + Math.pow(k, 2.4) * 7;
  ctx.save();
  // rings: the swell lines wrapped around the camera, each open like a lip
  const NR = 44;
  for (let m = 0; m < NR; m++) {
    const ph = (m + travel * 4) % NR;
    const r = 5 * Math.exp(ph * 0.155);
    const a = appear * smooth(clamp((r - 10) / 70)) * (1 - smooth(clamp((r - 1500) / 900)));
    if (a <= 0.01) continue;
    const gapAng = 0.75 + 0.25 * Math.sin(m * 1.7);
    const rot = -t * 1.6 - ph * 0.13;
    const pts = [];
    const N = 96;
    for (let i = 0; i <= N; i++) {
      const th = rot + gapAng / 2 + ((TAU - gapAng) * i) / N;
      const rr = r * (1 + 0.022 * Math.sin(5 * th + m * 1.3 + t * 6)) * Math.exp(0.035 * (th - rot));
      pts.push(cx + Math.cos(th) * rr, cy + Math.sin(th) * rr);
    }
    const hot = m % 11 === 5;
    strokeLine(ctx, pts, hot ? PAL.flare : PAL.foam, clamp(r / 200, 0.8, 5), a * (hot ? 0.95 : 0.7));
  }
  // the energy line: a single flare spiral leading through the barrel
  {
    const pts = [];
    const rot = -t * 5.5;
    for (let th = 0; th < 46; th += 0.08) {
      const rr = 3 * Math.exp(0.155 * th);
      if (rr > 2600) break;
      pts.push(cx + Math.cos(th + rot) * rr, cy + Math.sin(th + rot) * rr);
    }
    strokeLine(ctx, pts, PAL.flare, 3.2, appear * 0.95);
  }
  // saved dates fly past the lens
  const dates = ['03', '06', '07', '10'];
  dates.forEach((d, i) => {
    const t0 = T.tube[0] + 0.3 + i * 0.09;
    const dt = t - t0;
    if (dt < 0 || dt > 0.3) return;
    const size = 18 * Math.exp(14 * dt);
    const ang = -0.9 + i * 1.75 - dt * 2;
    const rad = size * 0.42;
    const a = smooth(clamp(dt / 0.05)) * (1 - smooth(clamp((dt - 0.2) / 0.1)));
    type(ctx, d, cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad + size * 0.36, size, {
      align: 'center', vars: { wdth: 110, wght: 640, opsz: 144 }, color: i % 2 ? PAL.foam : PAL.flare, alpha: a,
    });
  });
  // the four dots orbit with us
  for (let i = 0; i < 4; i++) {
    const ang = i * (TAU / 4) - t * 7.5;
    const rr = 340 + 60 * Math.sin(t * 5 + i);
    dot(ctx, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 13, PAL.flare, appear, 30);
  }
  // light at the end of the tube
  if (t > T.impact - 0.42) {
    const lr = 5 * Math.exp(12.6 * (t - (T.impact - 0.42)));
    const g = ctx.createRadialGradient(cx, cy, lr * 0.55, cx, cy, lr * 1.3 + 30);
    g.addColorStop(0, PAL.bone);
    g.addColorStop(1, rgba(PAL.bone, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, lr * 1.3 + 30, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function drawAct4(ctx, t) {
  if (t < 7.38 || t > T.impact + 0.001) return;
  const S = skin(t);
  const C = cam4(t, S);
  const waveVis = 1 - smooth(win(t, T.tube[0] + 0.22, T.tube[0] + 0.42));

  if (waveVis > 0) {
    ctx.save();
    applyCam(ctx, C);
    const lw = 2.3 / Math.sqrt(C.sc);
    // water ahead of the wave: a few flat lines it rides over
    for (let j = 1; j <= 7; j++) {
      const y = BAND_Y0 + j * 14;
      const pts = [];
      for (let x = -900; x <= 2000; x += 30) pts.push(x, y + 4 * Math.sin(x * 0.01 + t * 3 + j) - 30 * gauss(x - 300, 400) * smooth(win(t, 7.7, 8.3)));
      strokeLine(ctx, pts, PAL.foam, lw * 0.8, 0.5 * smooth(win(t, 7.4, 7.7)) * waveVis);
    }
    for (let i = BAND_N - 1; i >= 0; i--) {
      const isCal = ROW_TO_LAYER.includes(i);
      // calendar layers are handed over by act III at the end of the drawback
      if (isCal && t < T.drawback[1]) continue;
      const fadeIn = isCal ? 1 : smooth(win(t, 7.4 + (i % 5) * 0.03, 7.7));
      const pts = layerPts(S, i);
      const hot = i === 0;
      const a = fadeIn * waveVis * (hot ? 1 : 0.55 + 0.45 * (i / BAND_N));
      // fracture: the outer end of each layer breaks into dashes as it curls
      const P = S.P;
      if (P.theta > 1.8 && !hot) {
        const end = layerEnd(S, i);
        const cut = end - lerp(0, 520, smooth((P.theta - 1.8) / 2.2));
        const solid = layerPts(S, i, 0, cut);
        strokeLine(ctx, solid, PAL.foam, lw, a);
        const frac = layerPts(S, i, cut, end);
        ctx.setLineDash([18 / C.sc, (10 + (i % 4) * 6) / C.sc]);
        ctx.lineDashOffset = -t * 300 / C.sc;
        strokeLine(ctx, frac, PAL.foam, lw, a);
        ctx.setLineDash([]);
      } else {
        strokeLine(ctx, pts, hot ? PAL.flare : PAL.foam, hot ? lw * 1.8 : lw, a);
      }
    }
    if (t > 8.0) drawSpray(ctx, t, C.sc);
    if (t >= T.drawback[1]) drawDots(ctx, S, t, C.sc);
    ctx.restore();
  }
  drawTube(ctx, t);
}

register(drawAct4);

export function act4Post(t) {
  const z = win(t, T.tube[0], T.impact);
  return {
    zoom: 0.11 * Math.pow(z, 1.3) * (t < T.impact ? 1 : 0),
    zoomC: [0.5, 0.5],
    ca: 9 * Math.pow(z, 2),
  };
}
