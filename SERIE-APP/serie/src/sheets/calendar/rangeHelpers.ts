/** Pure date-range helpers for the calendar tools (unit-tested). */
import type { LocalDate } from '@/domain/types';
import { addDays, compareDates, EARLIEST_DATE, isLocalDate, parseDate } from '@/domain/dates';

export type RangePreset = '3m' | '1y' | '5y' | 'custom';
export const RANGE_PRESETS: { key: RangePreset; label: string }[] = [
  { key: '3m', label: '3 mesi' },
  { key: '1y', label: '1 anno' },
  { key: '5y', label: '5 anni' },
  { key: 'custom', label: 'Scegli' },
];

export function presetRange(p: Exclude<RangePreset, 'custom'>, today: LocalDate): { from: LocalDate; to: LocalDate } {
  const { y, m, d } = parseDate(today);
  const back = (years: number, months: number) => {
    let yy = y - years, mm = m - months;
    while (mm < 1) {
      mm += 12;
      yy -= 1;
    }
    const dim = new Date(Date.UTC(yy, mm, 0)).getUTCDate();
    return addDays(`${yy}-${String(mm).padStart(2, '0')}-${String(Math.min(d, dim)).padStart(2, '0')}`, 1);
  };
  if (p === '3m') return { from: back(0, 3), to: today };
  if (p === '1y') return { from: back(1, 0), to: today };
  return { from: back(5, 0), to: today };
}

export type RangeCheck = { ok: true; from: LocalDate; to: LocalDate } | { ok: false; error: string };

export function checkRange(from: string, to: string, latest?: LocalDate): RangeCheck {
  if (!isLocalDate(from.trim())) return { ok: false, error: 'Data iniziale non valida: usa AAAA-MM-GG.' };
  if (!isLocalDate(to.trim())) return { ok: false, error: 'Data finale non valida: usa AAAA-MM-GG.' };
  if (compareDates(from.trim(), to.trim()) > 0) return { ok: false, error: 'La data iniziale viene dopo quella finale.' };
  if (compareDates(from.trim(), EARLIEST_DATE) < 0) return { ok: false, error: 'La data iniziale è troppo lontana nel passato: controlla l’anno.' };
  // sessions are things already done: an import never creates future sessions (logging refuses them too)
  if (latest && compareDates(to.trim(), latest) > 0) return { ok: false, error: 'La data finale non può essere nel futuro: si importano solo attività già svolte.' };
  return { ok: true, from: from.trim(), to: to.trim() };
}

