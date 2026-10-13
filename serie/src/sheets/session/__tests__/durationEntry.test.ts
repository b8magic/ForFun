import { buildTiming } from '@/domain/timing';
import { durationEntryText, durationValueFromDigits, editDurationEntry, formatDurationDigits } from '../durationEntry';
import { emptyTimingForm, evaluateTiming, formFromTiming, parseFormDuration } from '../timingForm';

const DATE = '2026-10-10';
const ZONE = 'Europe/Rome';

describe('unified numeric duration', () => {
  it.each([
    ['1', '1m', 60],
    ['12', '12m', 12 * 60],
    ['123', '1h23m', 3600 + 23 * 60],
    ['1237', '12h37m', 12 * 3600 + 37 * 60],
    ['005', '0h05m', 5 * 60],
    ['9900', '99h00m', 99 * 3600],
  ])('interprets the stream %s as %s', (digits, text, seconds) => {
    const value = durationValueFromDigits(digits);
    expect(formatDurationDigits(digits)).toBe(text);
    expect(durationEntryText(value)).toBe(text);
    expect(parseFormDuration(value)).toEqual({ ok: true, seconds });
  });

  it('formats every appended digit and keeps the caret before the minute suffix', () => {
    let value = '';
    let selection = { start: 0, end: 0 };
    for (const [digit, expected] of [['1', '1m'], ['2', '12m'], ['3', '1h23m'], ['7', '12h37m']]) {
      const text = durationEntryText(value);
      const next = text.slice(0, selection.start) + digit + text.slice(selection.end);
      const edit = editDurationEntry(value, next, selection);
      value = edit.value;
      selection = edit.selection;
      expect(durationEntryText(value)).toBe(expected);
      expect(selection).toEqual({ start: expected.length - 1, end: expected.length - 1 });
    }
    expect(parseFormDuration(value)).toEqual({ ok: true, seconds: 12 * 3600 + 37 * 60 });
  });

  it.each(['90', '260', '1299'])('keeps invalid minute digits %s visible until corrected', (digits) => {
    const value = durationValueFromDigits(digits);
    expect(durationEntryText(value)).toBe(formatDurationDigits(digits));
    expect(parseFormDuration(value)).toEqual({ ok: false, error: 'invalid' });
    expect(evaluateTiming(DATE, { ...emptyTimingForm(ZONE), mode: 'duration_only', duration: value }, ZONE)).toMatchObject({ ok: false, errors: { duration: 'duration' } });
  });

  it.each(['9901', '10000'])('rejects %s above the 99-hour domain maximum without truncation', (digits) => {
    const edit = editDurationEntry('', digits, { start: 0, end: 0 });
    expect(durationEntryText(edit.value)).toBe(formatDurationDigits(digits));
    expect(parseFormDuration(edit.value)).toEqual({ ok: false, error: 'too_long' });
  });

  it('distinguishes blank unknown duration from an explicit zero', () => {
    const blank = editDurationEntry('1:30', '', { start: 0, end: 5 });
    expect(blank).toEqual({ value: '', selection: { start: 0, end: 0 } });
    expect(evaluateTiming(DATE, { ...emptyTimingForm(ZONE), mode: 'start_duration', start: '08:00', duration: blank.value }, ZONE)).toMatchObject({ ok: true, effective: 'start_only' });
    expect(parseFormDuration(durationValueFromDigits('000'))).toEqual({ ok: false, error: 'non_positive' });
  });
});

describe('duration deletion and selection', () => {
  it('backspaces a numeric digit at the end of the stream', () => {
    const edit = editDurationEntry('12:37', '12h3m', { start: 5, end: 5 });
    expect(durationEntryText(edit.value)).toBe('1h23m');
    expect(edit.selection).toEqual({ start: 4, end: 4 });
  });

  it('backspaces through the generated m suffix and eventually clears the field', () => {
    let value = '12:37';
    for (const expected of ['1h23m', '12m', '1m', '']) {
      const text = durationEntryText(value);
      const edit = editDurationEntry(value, text.slice(0, -1), { start: text.length, end: text.length });
      value = edit.value;
      expect(durationEntryText(value)).toBe(expected);
    }
  });

  it('backspace and forward delete at h remove the intended adjacent digit', () => {
    expect(durationEntryText(editDurationEntry('1:23', '123m', { start: 2, end: 2 }).value)).toBe('23m');
    expect(durationEntryText(editDurationEntry('1:23', '123m', { start: 1, end: 1 }).value)).toBe('13m');
  });

  it('replaces a selected minute digit without moving the caret to the end', () => {
    const edit = editDurationEntry('12:37', '12h47m', { start: 3, end: 4 });
    expect(edit.value).toBe('12:47');
    expect(edit.selection).toEqual({ start: 4, end: 4 });
  });

  it('uses the actual selection to locate edits among repeated digits', () => {
    const edit = editDurationEntry('11:11', '1h11m', { start: 1, end: 1 });
    expect(edit.value).toBe('1:11');
    expect(edit.selection).toEqual({ start: 0, end: 0 });
  });

  it('can infer a numeric deletion when the new selection arrived first', () => {
    expect(durationEntryText(editDurationEntry('12:37', '12h3m', { start: 4, end: 4 }).value)).toBe('1h23m');
  });
});

describe('duration paste and existing precision', () => {
  it.each([
    ['1237', '12h37m', 12 * 3600 + 37 * 60],
    ['12:37', '12h37m', 12 * 3600 + 37 * 60],
    ['12h37m', '12h37m', 12 * 3600 + 37 * 60],
    ['1h5m', '1h05m', 3600 + 5 * 60],
    ['2h', '2h00m', 7200],
    ['90 min', '1h30m', 5400],
    ['1,5', '1h30m', 5400],
  ])('accepts a whole pasted duration %s with explicit units respected', (pasted, text, seconds) => {
    const edit = editDurationEntry('1:30', pasted, { start: 0, end: 5 });
    expect(durationEntryText(edit.value)).toBe(text);
    expect(parseFormDuration(edit.value)).toEqual({ ok: true, seconds });
  });

  it.each(['cats12', '-130', '1h70m', '12:90'])('does not silently turn an invalid paste %s into a valid duration', (pasted) => {
    const edit = editDurationEntry('', pasted, { start: 0, end: 0 });
    expect(parseFormDuration(edit.value).ok).toBe(false);
    expect(durationEntryText(edit.value)).not.toBe('');
  });

  it.each([5437, 45])('keeps %i saved seconds during presentation, focus, blur, and unrelated edits', (seconds) => {
    const result = buildTiming(DATE, { state: 'start_duration', start: '07:00', timeZone: ZONE, declaredSec: seconds });
    if (!result.ok) throw new Error('fixture');
    const form = formFromTiming(result.timing, ZONE);
    const edit = editDurationEntry(form.duration, durationEntryText(form.duration), { start: 0, end: 0 });
    expect(edit.value).toBe(form.duration);
    expect(evaluateTiming(DATE, { ...form, duration: edit.value, start: '08:00' }, ZONE).timing?.declaredSec).toBe(seconds);
  });

  it('drops only second precision once duration digits are edited', () => {
    const edit = editDurationEntry('1:30:37', '1h31m', { start: 3, end: 4 });
    expect(edit.value).toBe('1:31');
    expect(parseFormDuration(edit.value)).toEqual({ ok: true, seconds: 5460 });
  });
});
