/**
 * The break — the save transformation, ported from the trailer.
 *
 * One curve (the skin) is integrated from its heading: flat → back slope →
 * crest → a clothoid lip whose curvature grows toward the tip. Every other
 * layer is an exact normal offset of the skin, so the water stays coherent
 * while it curls. The timeline `u` (0…1) runs:
 *   0.00–0.20 drawback   week-lines sink and gather into a band
 *   0.18–0.62 rise+curl  the band lifts into a wave and the lip throws
 *   0.58–0.86 release    the saved dots fly from the lip into history
 *   0.78–1.00 return     the calendar re-forms from the water
 * All functions are worklets.
 */
import type { SkPathBuilder } from '@shopify/react-native-skia';
import { clamp01, mix, win, easeInOutQuint, easeBuild, easeFlow } from '@/motion/grammar';

export const LAYERS = 12;

export interface WaveFrame {
  s: number; // scale (points per trailer unit)
  y0: number; // band bottom (innermost layer when flat)
  xStart: number;
}

export interface WaveParams {
  alpha: number;
  theta: number;
  p: number;
  Lb: number;
  Ll: number;
  SA: number;
  gap: number;
  taper: number;
}

const inOut = (t: number) => {
  'worklet';
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export function waveParams(u: number, s: number): WaveParams {
  'worklet';
  const alpha = 0.92 * inOut(win(u, 0.17, 0.48));
  const theta = 0.42 * Math.PI * inOut(win(u, 0.2, 0.4)) + 1.0 * Math.PI * inOut(win(u, 0.32, 0.62));
  const p = mix(0.62, 2.7, inOut(win(u, 0.3, 0.6)));
  return {
    alpha,
    theta,
    p,
    Lb: 1720 * s,
    Ll: 980 * s,
    SA: 640 * s,
    gap: mix(14, 19, inOut(win(u, 0.18, 0.4))) * s * 2.2,
    taper: 15 * s * 2.2 * inOut(win(u, 0.34, 0.62)),
  };
}

function heading(sArc: number, P: WaveParams): number {
  'worklet';
  if (sArc < P.SA) return 0;
  if (sArc < P.SA + P.Lb) return -P.alpha * Math.sin((Math.PI * (sArc - P.SA)) / P.Lb);
  const u = (sArc - P.SA - P.Lb) / P.Ll;
  return P.theta * Math.pow(Math.min(u, 1.2), P.p);
}

export interface Skin {
  X: number[];
  Y: number[];
  PH: number[];
  n: number;
  L: number;
  ds: number;
  P: WaveParams;
}

export function skin(u: number, F: WaveFrame): Skin {
  'worklet';
  const P = waveParams(u, F.s);
  const L = P.SA + P.Lb + P.Ll;
  const ds = Math.max(3, 9 * F.s * 2);
  const n = Math.ceil(L / ds);
  const X = new Array(n + 1);
  const Y = new Array(n + 1);
  const PH = new Array(n + 1);
  let x = F.xStart;
  let y = F.y0;
  X[0] = x;
  Y[0] = y;
  PH[0] = 0;
  for (let i = 1; i <= n; i++) {
    const sa = i * ds;
    const ph = heading(sa - ds / 2, P);
    x += Math.cos(ph) * ds;
    y += Math.sin(ph) * ds;
    X[i] = x;
    Y[i] = y;
    PH[i] = heading(sa, P);
  }
  return { X, Y, PH, n, L, ds, P };
}

export const layerEnd = (S: Skin, i: number) => {
  'worklet';
  return S.L - i * S.P.taper;
};

export function layerPoint(S: Skin, i: number, sArc: number): number[] {
  'worklet';
  const k = Math.max(0, Math.min(S.n, sArc / S.ds));
  const j = Math.min(S.n - 1, Math.floor(k));
  const f = k - j;
  const x = mix(S.X[j], S.X[j + 1], f);
  const y = mix(S.Y[j], S.Y[j + 1], f);
  const ph = mix(S.PH[j], S.PH[j + 1], f);
  const d = i * S.P.gap;
  return [x + Math.sin(ph) * d, y - Math.cos(ph) * d, ph];
}

/** Append layer i (arc range [s0, s1]) to a path builder. */
export function addLayer(b: SkPathBuilder, S: Skin, i: number, s0 = 0, s1 = -1) {
  'worklet';
  const end = s1 < 0 ? layerEnd(S, i) : Math.min(s1, layerEnd(S, i));
  const d = i * S.P.gap;
  let started = false;
  const j0 = Math.max(0, Math.floor(s0 / S.ds));
  for (let j = j0; j <= S.n; j++) {
    if (j * S.ds > end) {
      const p = layerPoint(S, i, end);
      b.lineTo(p[0], p[1]);
      break;
    }
    const x = S.X[j] + Math.sin(S.PH[j]) * d;
    const y = S.Y[j] - Math.cos(S.PH[j]) * d;
    if (!started) {
      b.moveTo(x, y);
      started = true;
    } else b.lineTo(x, y);
  }
}

/** Camera for the wave: pulls back and frames the curl. Returns [scale, tx, ty, pivotX, pivotY]. */
export function waveCamera(u: number, W: number, y0: number): number[] {
  'worklet';
  const k = inOut(win(u, 0.2, 0.55));
  const sc = mix(1, 0.78, k);
  const tx = mix(0, -W * 0.12, k);
  const ty = mix(0, -10, k);
  return [sc, tx, ty, W / 2, y0];
}

export function applyCam(cam: number[], x: number, y: number): number[] {
  'worklet';
  return [(x - cam[3]) * cam[0] + cam[3] + cam[1], (y - cam[4]) * cam[0] + cam[4] + cam[2]];
}

/** Progress helpers for the phases. */
export const phase = {
  drawback: (u: number) => {
    'worklet';
    return easeBuild(win(u, 0, 0.2));
  },
  waveAlpha: (u: number) => {
    'worklet';
    return u < 0.17 ? 0 : 1 - clamp01((u - 0.7) / 0.14);
  },
  calendarAlpha: (u: number) => {
    'worklet';
    return u < 0.2 ? 1 : u < 0.78 ? 0 : easeFlow(win(u, 0.78, 0.95));
  },
  returnOffset: (u: number) => {
    'worklet';
    return 1 - easeFlow(win(u, 0.78, 1));
  },
  contentAlpha: (u: number) => {
    'worklet';
    if (u >= 1) return 1;
    return u < 0.5 ? 1 - clamp01(u / 0.1) : easeInOutQuint(win(u, 0.82, 1));
  },
};
