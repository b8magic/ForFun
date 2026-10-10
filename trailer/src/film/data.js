// Illustrative session history for the film (clearly labelled as such on the
// end card). Deterministic, internally consistent: every number shown on screen
// is computed from these records, durations are null when unknown, and unknown
// durations never contribute to hour totals.
import { rng } from '../lib/util.js';

export const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

// Sessions already in the history before the film's save moment.
export const PRIOR_OCT = [1, 4];
// The four dates selected and saved in the film.
export const SELECTED = [3, 6, 7, 10];
export const TODAY = { y: 2026, m: 9, d: 10 };

function build() {
  const r = rng(20261010);
  const sessions = [];
  // Atlantic-Europe surfer: autumn/winter swell, lighter summer.
  const season = [1.25, 1.1, 1.05, 0.9, 0.7, 0.55, 0.5, 0.6, 0.95, 1.3, 1.35, 1.2];
  YEARS.forEach((y, yi) => {
    const base = 0.105 + yi * 0.012;
    for (let m = 0; m < 12; m++) {
      const n = daysIn(y, m);
      for (let d = 1; d <= n; d++) {
        if (y === 2026 && (m > 9 || (m === 9 && d >= 1))) continue; // Oct 2026 handled explicitly
        // swell arrives in pulses: neighbouring days correlate
        const pulse = 0.65 + 0.7 * Math.max(0, Math.sin((d + m * 7.3 + yi * 3.1) * 0.55));
        if (r() < base * season[m] * pulse) {
          const reps = r() < 0.07 ? 2 : 1;
          for (let k = 0; k < reps; k++) sessions.push(mk(y, m, d, r));
        }
      }
    }
  });
  PRIOR_OCT.forEach((d) => sessions.push(mk(2026, 9, d, r)));
  return sessions;
}

function mk(y, m, d, r) {
  // ~70% of sessions carry a known duration (interval or declared); the rest are date-only / start-only.
  const known = r() < 0.7;
  const sec = known ? Math.round((0.75 + r() * 2.25) * 4) * 900 : null; // 45 min .. 3 h, quarter-hour steps
  return { y, m, d, durationSec: sec };
}

export const PRIOR = build();
export const NEW = SELECTED.map((d) => ({ y: 2026, m: 9, d, durationSec: null }));
export const ALL = PRIOR.concat(NEW);

export function stats(list) {
  let known = 0, sec = 0;
  for (const s of list) if (s.durationSec != null) { known++; sec += s.durationSec; }
  return { count: list.length, known, sec };
}
export const fmtHours = (sec) => {
  const h = Math.floor(sec / 3600), mi = Math.round((sec % 3600) / 60);
  return `${h} h ${String(mi).padStart(2, '0')} min`;
};

// Per (year, month): array of day → session count, and month totals.
export function grid(list) {
  const g = {};
  for (const y of YEARS) g[y] = Array.from({ length: 12 }, (_, m) => ({ days: new Array(daysIn(y, m) + 1).fill(0), count: 0 }));
  for (const s of list) { g[s.y][s.m].days[s.d]++; g[s.y][s.m].count++; }
  return g;
}
export const GRID_PRIOR = grid(PRIOR);
export const GRID_ALL = grid(ALL);
export const yearCount = (g, y) => g[y].reduce((a, b) => a + b.count, 0);
