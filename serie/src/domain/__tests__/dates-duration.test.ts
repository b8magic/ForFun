import { addDays, daysInMonth, monthWeeks, weekdayMon0, isLocalDate, isoWeek, addMonths, monthRange } from '@/domain/dates';
import { parseDurationInput, formatDuration, formatHoursInput } from '@/domain/duration';

describe('dates', () => {
  it('handles leap years and month/year boundaries', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
  });
  it('builds Monday-first month grids', () => {
    const w = monthWeeks({ y: 2026, m: 10 });
    expect(w[0][0]).toBe('2026-09-28');
    expect(w[0][3]).toBe('2026-10-01');
    expect(w.length).toBe(5);
    expect(weekdayMon0('2026-10-10')).toBe(5);
    expect(monthWeeks({ y: 2026, m: 3 }).length).toBe(6);
  });
  it('iterates months across years', () => {
    expect(addMonths({ y: 2026, m: 12 }, 1)).toEqual({ y: 2027, m: 1 });
    expect(addMonths({ y: 2026, m: 1 }, -1)).toEqual({ y: 2025, m: 12 });
    expect(monthRange({ y: 2025, m: 11 }, { y: 2026, m: 2 }).length).toBe(4);
  });
  it('computes ISO weeks', () => {
    expect(isoWeek('2026-01-01').key).toBe('2026-W01');
    expect(isoWeek('2027-01-01').key).toBe('2026-W53');
  });
});

describe('duration input', () => {
  it.each([
    ['1,5', 5400], ['1.5', 5400], ['1:30', 5400], ['1h30', 5400], ['1 h 30 min', 5400],
    ['90 min', 5400], ['90m', 5400], ['2h', 7200], [',75', 2700], ['2', 7200], ['0,25 ore', 900],
  ])('parses %s', (input, sec) => {
    expect(parseDurationInput(input)).toEqual({ ok: true, seconds: sec });
  });
  it('treats blank as not provided and rejects non-positive values', () => {
    expect(parseDurationInput('  ')).toEqual({ ok: false, error: 'empty' });
    expect(parseDurationInput('0')).toEqual({ ok: false, error: 'non_positive' });
    expect(parseDurationInput('abc')).toEqual({ ok: false, error: 'invalid' });
    expect(parseDurationInput('120')).toEqual({ ok: false, error: 'too_long' });
  });
  it('formats for display and editing', () => {
    expect(formatDuration(5400)).toBe('1 h 30 min');
    expect(formatDuration(2700)).toBe('45 min');
    expect(formatDuration(10800)).toBe('3 h');
    expect(formatDuration(7500)).toBe('2 h 05 min');
    expect(formatHoursInput(5400)).toBe('1,5');
  });
});
