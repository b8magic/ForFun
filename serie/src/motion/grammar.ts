/**
 * Serie motion grammar — the ocean cycle as reusable timing.
 *
 * Every animated value in the app is built from these phases. Small
 * interactions use one or two (resistance, flow); only Save runs the full
 * swell → build → crest → break → flow → settle cycle.
 *
 * All functions are worklets so they can run on the UI thread.
 */
import { Easing } from 'react-native-reanimated';

export const TAU = Math.PI * 2;

/** Easing curves (cubic-bezier) named after the phase they express. */
export const curves = {
  /** Long, weighted in-out: energy moving under the surface. */
  swell: Easing.bezier(0.37, 0, 0.63, 1),
  /** Accelerating accumulation: water drawing back, a face steepening. */
  build: Easing.bezier(0.55, 0, 1, 0.45),
  /** Arrives fast and hangs at the top. */
  crest: Easing.bezier(0.3, 1.45, 0.6, 1),
  /** The snap of release. */
  break: Easing.bezier(0.87, 0, 0.13, 1),
  /** Fast departure, very long glide into place. */
  flow: Easing.bezier(0.22, 1, 0.36, 1),
  /** Quick resistance under the finger. */
  press: Easing.bezier(0.4, 0, 0.6, 1),
} as const;

/** Durations (ms). Hierarchy: touch < flow < transform < break. */
export const durations = {
  press: 90,
  touch: 160,
  flow: 520,
  transform: 760,
  swell: 1100,
  breakFull: 1650,
  reduced: 180,
} as const;

/** Spring configs derived from frequency (Hz) and damping ratio, mass 1. */
function spring(freq: number, zeta: number) {
  const w = TAU * freq;
  return { mass: 1, stiffness: w * w, damping: 2 * zeta * w };
}

export const springs = {
  /** A selected day lifting into its crest (water-heavy, one visible overshoot). */
  crest: spring(1.9, 0.36),
  /** Objects settling after a transformation. */
  settle: spring(1.4, 0.55),
  /** Slosh of liquid in the Save control. */
  slosh: spring(1.3, 0.28),
  /** Firm, nearly critically damped: for layout moves that must stay readable. */
  firm: spring(2.4, 0.85),
} as const;

// ─── Worklet helpers ───────────────────────────────────────────────────────

export function clamp01(x: number): number {
  'worklet';
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function mix(a: number, b: number, t: number): number {
  'worklet';
  return a + (b - a) * t;
}

/** Progress of t through [a, b], clamped. */
export function win(t: number, a: number, b: number): number {
  'worklet';
  return clamp01((t - a) / (b - a));
}

export function gauss(x: number, s: number): number {
  'worklet';
  return Math.exp(-(x * x) / (2 * s * s));
}

export function smooth(t: number): number {
  'worklet';
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function easeFlow(t: number): number {
  'worklet';
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 5);
}

export function easeBuild(t: number): number {
  'worklet';
  const x = clamp01(t);
  return x * x * x;
}

export function easeSwell(t: number): number {
  'worklet';
  const x = clamp01(t);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

export function easeInOutQuint(t: number): number {
  'worklet';
  const x = clamp01(t);
  return x < 0.5 ? 16 * x * x * x * x * x : 1 - Math.pow(-2 * x + 2, 5) / 2;
}

/** Damped spring step response 0 → 1 (closed form, for time-driven choreography). */
export function settleResponse(t: number, freq = 1.9, zeta = 0.36): number {
  'worklet';
  if (t <= 0) return 0;
  const w = TAU * freq;
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
}

/** A travelling ripple packet: displacement at distance d from the source, dt seconds after impulse. */
export function ripple(d: number, dt: number, speed = 520, amp = 9, width = 34, k = 0.12, decay = 2.6): number {
  'worklet';
  if (dt <= 0 || dt > 2) return 0;
  const front = d - dt * speed;
  return amp * Math.exp(-dt * decay) * Math.exp(-(front * front) / (2 * width * width)) * Math.sin(front * k);
}
