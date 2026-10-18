import { fromPickerDate, toPickerDate } from '../pickerDates';

describe('period picker calendar dates', () => {
  it.each([
    ['0099-01-01', 99, 0, 1],
    ['1900-01-01', 1900, 0, 1],
    ['2024-02-29', 2024, 1, 29],
    ['2026-03-08', 2026, 2, 8],
    ['2026-03-29', 2026, 2, 29],
    ['2026-10-25', 2026, 9, 25],
    ['2026-11-01', 2026, 10, 1],
    ['2099-12-31', 2099, 11, 31],
  ])('opens %s on the same local calendar day', (value, year, month, day) => {
    const date = toPickerDate(value as string);
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([year, month, day, 12]);
    expect(fromPickerDate(date)).toBe(value);
  });

  it.each([0, 23])('saves the selected calendar day at local hour %i without converting it to UTC', (hour) => {
    expect(fromPickerDate(new Date(2026, 9, 18, hour, 30))).toBe('2026-10-18');
  });

  it('ignores invalid native dates', () => {
    expect(fromPickerDate(new Date(NaN))).toBeNull();
  });
});
