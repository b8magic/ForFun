// Shared math + the film's motion grammar.

export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invlerp(a, b, x));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const TAU = Math.PI * 2;

// ── Ocean easing vocabulary ────────────────────────────────────────────────
// swell     long, weighted in-out: energy moving under the surface
// build     accelerating accumulation (water drawing back, a face steepening)
// crest     arrives fast, hangs at the top (the moment before commitment)
// breakIn   / breakOut: the snap of release, asymmetric and violent
// flow      fast departure, very long glide into place
// settle    damped oscillation: dissipation after the energy has passed
export const ease = {
  swell: (t) => { t = clamp(t); return -(Math.cos(Math.PI * t) - 1) / 2; },
  build: (t) => { t = clamp(t); return t * t * t; },
  buildSoft: (t) => { t = clamp(t); return t * t; },
  crest: (t) => { t = clamp(t); const c = 1.25; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  breakIn: (t) => { t = clamp(t); return t === 0 ? 0 : Math.pow(2, 10 * t - 10); },
  breakOut: (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  breakInOut: (t) => { t = clamp(t); return t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2; },
  flow: (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 5); },
  flowIn: (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); },
  inOut: (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  inOutQuint: (t) => { t = clamp(t); return t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2; },
};

// Damped spring response to a unit step at t=0 (0 → 1), water-heavy by default.
export function settle(t, freq = 2.2, damp = 0.32) {
  if (t <= 0) return 0;
  const w = TAU * freq;
  const z = damp;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * t));
}

// Impulse ripple: 0 at t=0, rings and decays.
export function ring(t, freq = 2.5, decay = 1.6) {
  if (t <= 0) return 0;
  return Math.sin(TAU * freq * t) * Math.exp(-decay * t);
}

export const gauss = (x, s) => Math.exp(-(x * x) / (2 * s * s));

// Deterministic randomness.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// Smooth 1D value noise.
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i + seed * 57.3), b = hash(i + 1 + seed * 57.3);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

// Window helper: progress of t through [a, b].
export const win = (t, a, b) => clamp((t - a) / (b - a));
// Bell: 0 → 1 → 0 across [a, b] with soft edges of width e.
export const bell = (t, a, b, e) => smooth(win(t, a, a + e)) * (1 - smooth(win(t, b - e, b)));

export const PAL = {
  ink: '#0C0B09',
  ink2: '#14120F',
  foam: '#EEE8DA',
  bone: '#ECE5D6',
  flare: '#FF4D1F',
  flareHot: '#FF6B3D',
};
export const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
export const mixHex = (h1, h2, t) => {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return `rgb(${r},${g},${bl})`;
};
