/** Pure colour math. HSV is editor state; stored activity colours remain hex strings. */
export interface Hsv { h: number; s: number; v: number }
export type ColorChannel = keyof Hsv;

export const clamp = (value: number, max = 1) => Math.max(0, Math.min(max, value));

/** Accept shorthand or full RGB; alpha is intentionally not an activity colour. */
export function normalizeHex(raw: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw.trim());
  if (!match) return null;
  const hex = match[1];
  return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex}`.toUpperCase();
}

export function hexToHsv(raw: string, previous?: Hsv): Hsv {
  const hex = normalizeHex(raw);
  if (!hex) return previous ?? { h: 0, s: 1, v: 1 };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  // Hue is undefined in greys and both hue and saturation are undefined in black.
  // Retaining them keeps the controls usable after dragging all the way to an edge.
  const h = delta === 0 ? previous?.h ?? 0 :
    ((max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60 + 360) % 360;
  return { h, s: max === 0 ? previous?.s ?? 0 : delta / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s);
  const value = clamp(v);
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const base = value - chroma;
  const rgb = hue < 60 ? [chroma, x, 0] : hue < 120 ? [x, chroma, 0] : hue < 180 ? [0, chroma, x] :
    hue < 240 ? [0, x, chroma] : hue < 300 ? [x, 0, chroma] : [chroma, 0, x];
  return `#${rgb.map((channel) => Math.round((channel + base) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Shared by keyboard and assistive controls; unrelated keys are left untouched. */
export function colorSliderKey(value: number, max: number, key: string, largeStep = false): number | null {
  const step = largeStep || key === 'PageUp' || key === 'PageDown' ? 10 : 1;
  if (key === 'Home') return 0;
  if (key === 'End') return max;
  if (key === 'ArrowRight' || key === 'ArrowUp' || key === 'PageUp') return clamp(value + step, max);
  if (key === 'ArrowLeft' || key === 'ArrowDown' || key === 'PageDown') return clamp(value - step, max);
  return null;
}
