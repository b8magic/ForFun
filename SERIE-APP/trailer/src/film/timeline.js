// One timeline drives picture and sound. Seconds.
export const FPS = 60;
export const DURATION = 15.6;

export const T = {
  // I · SWELL — anticipation
  act1: 0.0,
  lineDraw: [0.12, 0.62],
  unfoldField: [0.5, 1.55],
  sunRise: [0.75, 1.4],
  swellPass: [0.85, 2.35],

  // II · BUILD — awakening
  act2: 2.2,
  tilt: [1.9, 2.85],
  disc: [2.35, 3.05],
  word: [2.98, 3.55],
  flick: [3.45, 4.05],
  flickSteps: [3.45, 3.57, 3.69, 3.81, 3.93],
  dock: [4.0, 4.75],

  // III · CREST — transformation into the calendar
  act3: 4.4,
  unfold: [4.15, 5.3],
  taps: [5.42, 5.82, 6.2, 6.56],
  saveTap: 7.22,

  // IV · BREAK — climax
  act4: 7.22,
  drawback: [7.28, 7.7],
  rise: [7.6, 8.25],
  curl: [7.95, 8.72],
  tube: [8.55, 9.34],
  impact: 9.32,

  // V · FLOW — expansion into history
  act5: 9.34,
  settle: [9.34, 10.35],
  land: [9.95, 10.6],
  zoomOut: [10.9, 11.95],
  counter: [11.0, 12.1],
  pulse: [11.85, 12.75],

  // VI · CALM — resolution
  act6: 12.65,
  flatten: [12.5, 13.25],
  logo: [12.95, 14.0],
  period: 14.02,
  tagline: [14.2, 14.95],
};

export const ACTS = [
  { at: T.act1, n: '01', name: 'SWELL' },
  { at: T.act2, n: '02', name: 'BUILD' },
  { at: T.act3, n: '03', name: 'CREST' },
  { at: T.act4, n: '04', name: 'BREAK' },
  { at: T.act5, n: '05', name: 'FLOW' },
  { at: T.act6, n: '06', name: 'CALM' },
];

// Motion-blur subframes per output frame (more where velocity is extreme).
export function subframes(t) {
  if (t > 7.25 && t < 10.0) return 8;
  if (t > 1.8 && t < 5.6) return 5;
  if (t > 10.8 && t < 12.2) return 5;
  return 4;
}
