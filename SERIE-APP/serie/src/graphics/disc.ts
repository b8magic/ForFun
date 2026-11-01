/**
 * Identity disc geometry: a circular window onto an activity's motion
 * pattern. Built as filled bands so every pattern (waves, dashes, breathing
 * thickness, drift, rings, grain) shares one renderer. Worklets.
 */
import type { FillType, SkPathBuilder } from '@shopify/react-native-skia';
import type { PatternKind } from '@/domain/types';

export const PATTERN_CODES: Record<PatternKind, number> = { swell: 0, stride: 1, pulse: 2, drift: 3, ripple: 4, grain: 5 };

/**
 * Append the disc stripes for `code` into `b` (to be filled and clipped to the circle).
 * t = seconds (pass 0 for a still disc).
 */
export function discStripes(b: SkPathBuilder, code: number, cx: number, cy: number, r: number, t: number, n = 7) {
  'worklet';
  const g = (2 * r) / (n + 0.6);
  const th = g * 0.36;
  const x0 = cx - r - 2;
  const x1 = cx + r + 2;
  const steps = 18;
  if (code === 4) {
    // ripple: concentric rings expanding from the centre. Even-odd fill makes
    // each inner circle a hole on every backend (CanvasKit ignores direction).
    b.setFillType(1 as FillType); // FillType.EvenOdd
    const phase = (t * 0.35) % 1;
    for (let k = 0; k < 5; k++) {
      const rr = ((k + phase) / 4.6) * r * 1.15;
      if (rr <= 0.5) continue;
      b.addCircle(cx, cy, rr + th * 0.5);
      b.addCircle(cx, cy, Math.max(0.1, rr - th * 0.5), true);
    }
    return;
  }
  if (code === 5) {
    // grain: rows of fine dots drifting slowly
    const drift = (t * 6) % (g * 0.8);
    for (let j = -1; j <= n + 1; j++) {
      const y = cy - r + j * g + g * 0.3;
      for (let x = x0 - g + drift; x < x1; x += g * 0.8) b.addCircle(x, y, th * 0.42);
    }
    return;
  }
  const scroll = ((t * 1.1) % 1) * g;
  const ang = code === 3 ? -0.5 : 0;
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  for (let j = -2; j <= n + 2; j++) {
    const base = cy - r + j * g + (code === 3 ? 0 : scroll) - g * 0.2;
    let thick = th;
    if (code === 2) thick = th * (0.55 + 0.9 * Math.max(0, Math.sin(t * 5.5 - j * 0.9)));
    const drift = code === 3 ? (t * 9) % g : 0;
    // dashes for stride: segments with gaps travelling in alternate directions
    const dash = code === 1;
    const dir = j % 2 === 0 ? 1 : -1;
    const period = g * 1.3;
    const off = dash ? ((t * 18 * dir) % period + period) % period : 0;
    const segs: number[] = [];
    if (dash) {
      for (let s0 = x0 - period + off; s0 < x1; s0 += period) segs.push(s0, s0 + period * 0.72);
    } else segs.push(x0, x1);
    for (let q = 0; q < segs.length; q += 2) {
      const a = Math.max(x0, segs[q]);
      const e = Math.min(x1, segs[q + 1]);
      if (e <= a) continue;
      // top edge left→right, bottom edge right→left
      for (let i = 0; i <= steps; i++) {
        const x = a + ((e - a) * i) / steps;
        let y = base - thick / 2 + drift;
        if (code === 0) {
          const u = (x - cx) / r;
          y += g * 0.3 * Math.sin(u * 3.2 - t * 3.2 + j * 0.55);
        }
        const px = cx + (x - cx) * ca - (y - cy) * sa;
        const py = cy + (x - cx) * sa + (y - cy) * ca;
        if (i === 0) b.moveTo(px, py);
        else b.lineTo(px, py);
      }
      for (let i = steps; i >= 0; i--) {
        const x = a + ((e - a) * i) / steps;
        let y = base + thick / 2 + drift;
        if (code === 0) {
          const u = (x - cx) / r;
          y += g * 0.3 * Math.sin(u * 3.2 - t * 3.2 + j * 0.55);
        }
        const px = cx + (x - cx) * ca - (y - cy) * sa;
        const py = cy + (x - cx) * sa + (y - cy) * ca;
        b.lineTo(px, py);
      }
      b.close();
    }
  }
}
