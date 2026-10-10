// Geometry shared across acts so objects keep their identity between them.
export const LX0 = 72, LX1 = 1008;
export const COLX = (c) => 80 + (920 / 7) * (c + 0.5);
export const ROWY = [770, 940, 1110, 1280, 1450];
// October 2026 starts on a Thursday (Mon-first grid).
export const dayAt = (r, c) => 7 * r + c - 2;
export const cellOf = (d) => { const i = d + 2; return { r: Math.floor(i / 7), c: i % 7 }; };

// The breaking-wave band: line 0 is the innermost skin of the wave.
export const BAND_N = 26;
export const BAND_Y0 = 1790;
export const BAND_GAP = 9;
export const bandY = (i) => BAND_Y0 - i * BAND_GAP;
// calendar row → band layer (top rows become the outer layers of the lip)
export const ROW_TO_LAYER = [22, 17, 12, 7, 2];
// the band's lines start this far left of the frame (arc length origin)
export const BAND_XSTART = -260;

export const PILL = { cx: 540, cy: 1712, w: 936, h: 128 };
