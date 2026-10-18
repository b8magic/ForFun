import { formatDate, parseDate } from '@/domain/dates';
import type { LocalDate } from '@/domain/types';

/** Native pickers use instants in the device zone; stored periods use calendar dates. */
export function toPickerDate(value: LocalDate): Date {
  const { y, m, d } = parseDate(value);
  const date = new Date(0);
  // setFullYear avoids the Date constructor's special handling of years 0–99.
  date.setFullYear(y, m - 1, d);
  // Noon avoids missing/repeated midnight hours around timezone transitions.
  date.setHours(12, 0, 0, 0);
  return date;
}

export function fromPickerDate(value: Date): LocalDate | null {
  if (!Number.isFinite(value.getTime())) return null;
  return formatDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
}
