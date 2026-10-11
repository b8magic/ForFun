/**
 * The water: a small physical model run on the UI thread.
 *
 * Each day cell owns a crest spring (0 = flat, 1 = lifted). Taps add
 * ripples that travel along the week-lines and leak into neighbours, the
 * number of selected days raises a global tension that makes every line
 * undulate a little more, and the Save control holds a liquid whose level
 * follows the selection. Everything is a function of state + time, so any
 * interaction can interrupt any other.
 */
import type { SharedValue } from 'react-native-reanimated';
import { springs, gauss, ripple, clamp01 } from '@/motion/grammar';
import { CELLS } from './layout';

export const CREST_H = 25; // crest height in points
export const SIG = 15; // crest half-width
export const MAX_RIPPLES = 10;

export interface Water {
  clock: SharedValue<number>;
  crest: SharedValue<number[]>;
  crestVel: SharedValue<number[]>;
  target: SharedValue<number[]>;
  press: SharedValue<number[]>;
  pressTarget: SharedValue<number[]>;
  recorded: SharedValue<number[]>;
  /** flat triples [x, y, t0] */
  ripples: SharedValue<number[]>;
  tension: SharedValue<number>;
  tensionTarget: SharedValue<number>;
  /** [level, velocity, target, slosh] */
  pill: SharedValue<number[]>;
  /** month swell: [t0, direction] */
  swell: SharedValue<number[]>;
  ambient: SharedValue<number>;
  firstLineY: SharedValue<number>;
  lineGap: SharedValue<number>;
  weeks: SharedValue<number>;
  /** active activity's pattern code (see graphics/disc.ts) */
  kind: SharedValue<number>;
  centerX: SharedValue<number>;
}

export function zeros(n = CELLS): number[] {
  'worklet';
  const a = new Array(n);
  for (let i = 0; i < n; i++) a[i] = 0;
  return a;
}

/** Advance the simulation by dt seconds. */
export function stepWater(w: Water, dt: number) {
  'worklet';
  const k = springs.crest.stiffness;
  const c = springs.crest.damping;
  const tgt = w.target.value;
  const pos = w.crest.value.slice();
  const vel = w.crestVel.value.slice();
  let moving = false;
  for (let i = 0; i < pos.length; i++) {
    const a = k * (tgt[i] - pos[i]) - c * vel[i];
    vel[i] += a * dt;
    pos[i] += vel[i] * dt;
    if (Math.abs(pos[i] - tgt[i]) < 0.0005 && Math.abs(vel[i]) < 0.0005) {
      pos[i] = tgt[i];
      vel[i] = 0;
    } else moving = true;
  }
  if (moving || pos.some((v, i) => v !== w.crest.value[i])) {
    w.crest.value = pos;
    w.crestVel.value = vel;
  }
  const pt = w.pressTarget.value;
  const pr = w.press.value.slice();
  const rate = 1 - Math.exp(-dt * 28);
  let pressMoving = false;
  for (let i = 0; i < pr.length; i++) {
    const d = (pt[i] - pr[i]) * rate;
    if (Math.abs(d) > 1e-4) pressMoving = true;
    pr[i] = Math.abs(pt[i] - pr[i]) < 1e-3 ? pt[i] : pr[i] + d;
  }
  if (pressMoving) w.press.value = pr;
  w.tension.value += (w.tensionTarget.value - w.tension.value) * (1 - Math.exp(-dt * 3));
  const ks = springs.slosh.stiffness;
  const cs = springs.slosh.damping;
  const p = w.pill.value.slice();
  const a = ks * (p[2] - p[0]) - cs * p[1];
  p[1] += a * dt;
  p[0] += p[1] * dt;
  p[3] *= Math.exp(-dt * 1.8);
  w.pill.value = p;
}

/** Add a ripple impulse at (x, y) now. */
export function addRipple(w: Water, x: number, y: number) {
  'worklet';
  const now = w.clock.value;
  const r = w.ripples.value.slice();
  r.push(x, y, now);
  while (r.length > MAX_RIPPLES * 3) r.splice(0, 3);
  w.ripples.value = r;
}

export function rowYw(w: Water, r: number) {
  'worklet';
  return w.firstLineY.value + r * w.lineGap.value;
}

/**
 * Vertical displacement of week-line `row` at x (negative = up).
 * colX: the 7 column centres.
 */
export function lineDisp(w: Water, colX: number[], row: number, x: number): number {
  'worklet';
  const t = w.clock.value;
  const pos = w.crest.value;
  const press = w.press.value;
  const rec = w.recorded.value;
  let y = 0;
  for (let c = 0; c < 7; c++) {
    const i = row * 7 + c;
    const dx = x - colX[c];
    if (dx > 70 || dx < -70) continue;
    const g = gauss(dx, SIG);
    y -= pos[i] * CREST_H * g;
    y += press[i] * 7 * g;
    if (rec[i] > 0) y -= Math.min(rec[i], 3) * 2.2 * gauss(dx, 11);
  }
  const amb = w.ambient.value;
  if (amb > 0) {
    const ry = rowYw(w, row);
    const rp = w.ripples.value;
    for (let k = 0; k < rp.length; k += 3) {
      const dt = t - rp[k + 2];
      if (dt <= 0 || dt > 1.8) continue;
      const dy = (ry - rp[k + 1]) * 1.15;
      const d = Math.sqrt((x - rp[k]) * (x - rp[k]) + dy * dy);
      y += ripple(d, dt) * amb;
    }
    const ten = w.tension.value;
    const a = (1.1 + 1.25 * ten) * amb;
    const kind = w.kind.value;
    if (kind === 3) {
      // drift: the swell travels on a heading
      y += a * Math.sin(x * 0.016 - t * 2.3 + row * 0.4);
    } else if (kind === 4) {
      // ripple: rings spreading from the centre of the set
      const cy = rowYw(w, Math.max(0, (w.weeks.value - 1) / 2));
      const dd = Math.sqrt((x - w.centerX.value) * (x - w.centerX.value) + (ry - cy) * (ry - cy));
      y += a * 1.2 * Math.sin(dd * 0.05 - t * 2.4);
    } else {
      y += a * Math.sin(x * 0.021 + t * 1.45 + row * 0.85);
    }
    // month change: a swell passing through the set
    const sw = w.swell.value;
    const st = t - sw[0];
    if (st > 0 && st < 1.1) {
      const front = sw[1] > 0 ? -60 + st * 620 : 450 - st * 620;
      y -= 12 * amb * Math.exp(-st * 2.2) * gauss(x - front, 46);
    }
  }
  return y;
}

/** Pill liquid surface offset at x (points). */
export function pillSurface(w: Water, x: number): number {
  'worklet';
  const t = w.clock.value;
  const p = w.pill.value;
  const amb = w.ambient.value;
  const level = clamp01(p[0]);
  const slosh = p[3];
  return (2.2 + 7 * slosh + 3 * Math.abs(p[1])) * Math.min(1, level * 4) * (0.35 + 0.65 * amb) * Math.sin(x * 0.045 - t * 4.6) + 1.2 * amb * Math.sin(x * 0.11 + t * 3);
}
