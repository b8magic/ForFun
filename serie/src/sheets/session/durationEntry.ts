/** Numeric duration editing. The last two digits are minutes; earlier digits are hours. */
import { durationInputFrom, parseFormDuration } from './timingForm';

export interface DurationSelection {
  start: number;
  end: number;
}

export interface DurationEdit {
  value: string;
  selection: DurationSelection;
}

function digitsIn(text: string): string {
  return text.replace(/\D/g, '');
}

/** Keep partial/invalid minutes visible; validation belongs to the timing form. */
export function durationValueFromDigits(digits: string): string {
  if (!digits) return '';
  return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
}

export function formatDurationDigits(digits: string): string {
  if (!digits) return '';
  return digits.length > 2 ? `${digits.slice(0, -2)}h${digits.slice(-2)}m` : `${digits}m`;
}

/** Read canonical prefills without modifying their seconds or semantic value. */
export function durationEntryText(value: string): string {
  if (!value.trim()) return '';
  const parts = /^(\d*):(\d{0,2})(?::\d{2})?$/.exec(value);
  if (parts) {
    const [, hours, minutes] = parts;
    return formatDurationDigits(hours ? `${hours}${minutes.padStart(2, '0')}` : minutes);
  }
  const parsed = parseFormDuration(value);
  return parsed.ok ? durationEntryText(durationInputFrom(parsed.seconds)) : value;
}

function cursorAfterDigits(text: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (/\d/.test(text[i]) && ++seen === count) return i + 1;
  }
  return text.length;
}

interface TextEdit {
  start: number;
  end: number;
  inserted: string;
}

/** Prefer the real selection so repeated digits do not move an edit to another position. */
function textEdit(previous: string, next: string, selection: DurationSelection): TextEdit {
  const start = Math.min(selection.start, previous.length);
  const end = Math.min(Math.max(selection.end, start), previous.length);
  const insertedLength = next.length - (previous.length - (end - start));
  if (insertedLength >= 0) {
    const inserted = next.slice(start, start + insertedLength);
    if (next === previous.slice(0, start) + inserted + previous.slice(end)) return { start, end, inserted };
  }
  const removed = previous.length - next.length;
  if (start === end && removed > 0) {
    if (start >= removed && next === previous.slice(0, start - removed) + previous.slice(start)) return { start: start - removed, end: start, inserted: '' };
    if (next === previous.slice(0, start) + previous.slice(start + removed)) return { start, end: start + removed, inserted: '' };
  }
  // Platforms may deliver the new selection before the text event. Infer the edit then.
  let from = 0;
  while (from < previous.length && from < next.length && previous[from] === next[from]) from++;
  let to = previous.length;
  let nextEnd = next.length;
  while (to > from && nextEnd > from && previous[to - 1] === next[nextEnd - 1]) { to--; nextEnd--; }
  return { start: from, end: to, inserted: next.slice(from, nextEnd) };
}

function pastedValue(text: string): string {
  const raw = text.trim();
  if (/^\d*$/.test(raw)) return durationValueFromDigits(raw);
  // Explicit units/colon keep their meaning even when the minutes need correction.
  const hoursMinutes = /^(\d+)\s*[:h]\s*(\d{1,2})\s*(?:m|min|minuti)?$/i.exec(raw);
  if (hoursMinutes) return `${hoursMinutes[1]}:${hoursMinutes[2].padStart(2, '0')}`;
  const hours = /^(\d+)\s*h$/i.exec(raw);
  if (hours) return `${hours[1]}:00`;
  const parsed = parseFormDuration(raw);
  // New edits are minute precision; saved seconds remain untouched until an edit.
  return parsed.ok ? durationInputFrom(Math.floor(parsed.seconds / 60) * 60) : raw;
}

/**
 * Apply a native text change to the digit stream. Deleting a generated h/m also
 * deletes the adjacent digit, so backspace never gets stuck on a restored suffix.
 * Unsupported paste stays visible and invalid instead of becoming a different number.
 */
export function editDurationEntry(value: string, nextText: string, selection: DurationSelection): DurationEdit {
  const previous = durationEntryText(value);
  if (nextText === previous) return { value, selection };
  const edit = textEdit(previous, nextText, selection);
  const previousDigits = digitsIn(previous);
  const fromDigit = digitsIn(previous.slice(0, edit.start)).length;
  const toDigit = digitsIn(previous.slice(0, edit.end)).length;
  const replacesAllDigits = fromDigit === 0 && toDigit === previousDigits.length;

  if (replacesAllDigits || !/^[\dhm]*$/i.test(previous)) {
    const next = pastedValue(replacesAllDigits ? edit.inserted : nextText);
    const text = durationEntryText(next);
    const cursor = /^[\dhm]*$/i.test(text) ? cursorAfterDigits(text, digitsIn(text).length) : text.length;
    return { value: next, selection: { start: cursor, end: cursor } };
  }

  let digits = digitsIn(nextText);
  let cursorDigit = digitsIn(nextText.slice(0, edit.start + edit.inserted.length)).length;
  if (!/^[\dhm\s]*$/i.test(nextText)) {
    return { value: nextText, selection: { start: edit.start + edit.inserted.length, end: edit.start + edit.inserted.length } };
  }
  if (!edit.inserted && edit.end > edit.start && fromDigit === toDigit && selection.start === selection.end) {
    const backwards = edit.end <= selection.start || edit.start === previous.length - 1;
    const index = backwards ? fromDigit - 1 : fromDigit;
    if (index >= 0 && index < previousDigits.length) {
      digits = previousDigits.slice(0, index) + previousDigits.slice(index + 1);
      cursorDigit = index;
    }
  }
  const next = digits === previousDigits ? value : durationValueFromDigits(digits);
  const cursor = cursorAfterDigits(durationEntryText(next), cursorDigit);
  return { value: next, selection: { start: cursor, end: cursor } };
}
