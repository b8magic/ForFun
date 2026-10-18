import { DATE_ONLY } from '../timing';
import type { Session } from '../types';
import { groupSessionsForDates } from '../sessionGroups';

function session(id: string, date: string, categoryId = 'surf', start?: string): Session {
  return { id, categoryId, date, timing: start ? { ...DATE_ONLY, state: 'start_only', start } : DATE_ONLY, place: null, notes: null, origin: 'manual', saveRequestId: null, createdAt: id, updatedAt: id };
}

const sessions = [
  session('late', '2026-10-08', 'surf', '16:00'),
  session('no-time', '2026-10-08'),
  session('earlier-day', '2026-10-06', 'corsa'),
  session('early', '2026-10-08', 'corsa', '08:00'),
  session('outside', '2026-10-10'),
];

describe('saved sessions for selected days', () => {
  it('groups every selected date once, in date/time order, including empty dates', () => {
    const original = sessions.slice();
    const groups = groupSessionsForDates(sessions, ['2026-10-09', '2026-10-08', '2026-10-06', '2026-10-08']);
    expect(groups.map(({ date, sessions: rows }) => [date, rows.map((row) => row.id)])).toEqual([
      ['2026-10-06', ['earlier-day']],
      ['2026-10-08', ['early', 'late', 'no-time']],
      ['2026-10-09', []],
    ]);
    expect(sessions).toEqual(original);
  });

  it('filters only the visible records, retaining days with no matching activity', () => {
    expect(groupSessionsForDates(sessions, ['2026-10-08', '2026-10-06'], 'surf')).toEqual([
      { date: '2026-10-06', sessions: [] },
      { date: '2026-10-08', sessions: [sessions[0], sessions[1]] },
    ]);
  });

  it('shows no records without selected dates', () => {
    expect(groupSessionsForDates(sessions, [])).toEqual([]);
  });
});
