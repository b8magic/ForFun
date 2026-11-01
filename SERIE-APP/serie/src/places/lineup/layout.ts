/**
 * Lineup geometry (points). Everything that moves on the UI thread reads
 * these plain numbers, so worklets and React layout agree to the pixel.
 */
import { space } from '@/ui/theme';

export const MAX_WEEKS = 6;
export const CELLS = MAX_WEEKS * 7;

export interface LineupLayout {
  W: number;
  H: number;
  G: number;
  headerY: number; // vertical centre of the activity header
  discX: number;
  discY: number;
  discR: number;
  titleTop: number;
  weekdayY: number;
  firstLineY: number;
  lineGap: number;
  colX: number[];
  colW: number;
  lineX0: number;
  lineX1: number;
  numeralOffset: number; // numeral centre above its line
  detailsY: number;
  pillCX: number;
  pillCY: number;
  pillW: number;
  pillH: number;
  handleY: number;
  bandBottom: number; // where the water gathers before breaking
}

export function computeLayout(W: number, H: number, insetTop: number, insetBottom: number, weeks: number): LineupLayout {
  const G = space.gutter;
  const headerY = insetTop + 30;
  const titleTop = headerY + 30;
  const weekdayY = titleTop + 86;
  const handleY = H - Math.max(insetBottom, 10) - 14;
  const pillH = 60;
  const pillCY = handleY - 50;
  const detailsY = pillCY - pillH / 2 - 26;
  const top = weekdayY + 58;
  const usable = detailsY - 34 - top;
  const lineGap = Math.max(52, Math.min(96, usable / Math.max(1, weeks - 1 + 0.35)));
  // centre the set of lines in whatever height remains
  const firstLineY = top + Math.max(0, (usable - lineGap * (weeks - 1 + 0.35)) * 0.5);
  const colW = (W - 2 * G) / 7;
  return {
    W,
    H,
    G,
    headerY,
    discX: G + 17,
    discY: headerY,
    discR: 17,
    titleTop,
    weekdayY,
    firstLineY,
    lineGap,
    colX: Array.from({ length: 7 }, (_, c) => G + colW * (c + 0.5)),
    colW,
    lineX0: G - 6,
    lineX1: W - G + 6,
    numeralOffset: 24,
    detailsY,
    pillCX: W / 2,
    pillCY,
    pillW: W - 2 * G,
    pillH,
    handleY,
    bandBottom: pillCY - pillH / 2 - 8,
  };
}

export const rowY = (L: LineupLayout, r: number) => L.firstLineY + r * L.lineGap;
