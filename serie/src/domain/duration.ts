/**
 * Duration entry and display.
 * Canonical unit: whole seconds. Display rounds to minutes only after summing.
 */

export const MAX_DURATION_SEC = 99 * 3600;

export type DurationParse = { ok: true; seconds: number } | { ok: false; error: 'empty' | 'invalid' | 'non_positive' | 'too_short' | 'too_long' };

/**
 * Parse user input for a duration in hours. Accepts locale decimals and common forms:
 *   "1,5"  "1.5"  "1:30"  "1h30"  "1 h 30 min"  "90 min"  "90m"  "2h"  ",75"
 * A blank field means "not provided" and is reported as `empty`, never as zero.
 */
export function parseDurationInput(raw: string): DurationParse {
  const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return { ok: false, error: 'empty' };

  let seconds: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,3}):([0-5]\d)$/.exec(s))) {
    seconds = +m[1] * 3600 + +m[2] * 60;
  } else if ((m = /^(\d{1,3})\s?(?:h(?:ours?)?|ore|ora)\s?(?:e\s?)?(?:([0-5]?\d)\s?(?:m|min|minuti?)?)?$/.exec(s))) {
    seconds = +m[1] * 3600 + (m[2] ? +m[2] * 60 : 0);
  } else if ((m = /^(\d{1,4})\s?(?:m|min|minuti?)$/.exec(s))) {
    seconds = +m[1] * 60;
  } else if ((m = /^(\d{0,3})(?:[.,](\d{1,4}))?\s?(?:h|ore|ora)?$/.exec(s)) && (m[1] || m[2])) {
    const hours = parseFloat(`${m[1] || '0'}.${m[2] || '0'}`);
    if (Number.isFinite(hours)) seconds = Math.round(hours * 3600);
  }
  if (seconds === null || !Number.isFinite(seconds)) return { ok: false, error: 'invalid' };
  if (seconds <= 0) return { ok: false, error: 'non_positive' };
  // stored durations stay displayable and re-editable: whole minutes, at least one
  if (seconds < 60) return { ok: false, error: 'too_short' };
  seconds = Math.round(seconds / 60) * 60;
  if (seconds > MAX_DURATION_SEC) return { ok: false, error: 'too_long' };
  return { ok: true, seconds };
}

/** "1 h 30 min", "45 min", "3 h". Rounds to the nearest minute. */
export function formatDuration(totalSec: number): string {
  const min = Math.round(totalSec / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/** Compact form for dense data: "3h30", "45m". */
export function formatDurationCompact(totalSec: number): string {
  const min = Math.round(totalSec / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/** Hours with the locale decimal separator, for prefilling an edit field ("1,5"). */
export function formatHoursInput(totalSec: number, decimalSeparator = ','): string {
  const hours = Math.round((totalSec / 3600) * 100) / 100;
  return String(hours).replace('.', decimalSeparator);
}
