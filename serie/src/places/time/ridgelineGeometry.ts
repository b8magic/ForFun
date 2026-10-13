export interface RidgePoint {
  x: number;
  regularRise: number;
  highlightRise: number;
}

const SAMPLE_COUNT = 96;

/** Fit the whole sampled curve, including neighboring peaks, inside its canvas. */
export function ridgelineGeometry(width: number, height: number, perDay: readonly number[], highlight: readonly number[] = []) {
  const days = Math.max(1, perDay.length - 1);
  const padding = Math.min(6, height / 2);
  const base = height - padding;
  const amplitude = Math.max(0, Math.min(13, (height - 10) / 3.2));
  const sigma = Math.max(3, width / days / 2.4);
  const highlighted = new Set(highlight);
  const at = (x: number): RidgePoint => {
    let regularRise = 0;
    let highlightRise = 0;
    for (let day = 1; day < perDay.length; day++) {
      const count = perDay[day];
      if (!count) continue;
      const dx = x - ((day - 0.5) / days) * width;
      if (Math.abs(dx) > sigma * 4) continue;
      const rise = Math.min(count, 4) * amplitude * Math.exp(-(dx * dx) / (2 * sigma * sigma));
      if (highlighted.has(day)) highlightRise += rise;
      else regularRise += rise;
    }
    return { x, regularRise, highlightRise };
  };
  const points = Array.from({ length: SAMPLE_COUNT + 1 }, (_, i) => at(i / SAMPLE_COUNT * width));
  const marks = [...highlighted].filter((day) => day > 0 && day < perDay.length && perDay[day] > 0).map((day) => at((day - 0.5) / days * width));
  let maximum = 0;
  for (const point of [...points, ...marks]) maximum = Math.max(maximum, point.regularRise + point.highlightRise);
  const scale = maximum > 0 ? Math.min(1, (base - padding) / maximum) : 1;
  for (const point of [...points, ...marks]) {
    point.regularRise *= scale;
    point.highlightRise *= scale;
  }
  return { base, padding, points, marks, dotRadius: Math.min(4.5, padding) };
}

/** Animation easing may overshoot; the rendered curve still respects its bounds. */
export function ridgelineY(point: RidgePoint, base: number, grow: number, glow: number): number {
  'worklet';
  return base - point.regularRise * Math.max(0, Math.min(1, grow)) - point.highlightRise * Math.max(0, Math.min(1, glow));
}
