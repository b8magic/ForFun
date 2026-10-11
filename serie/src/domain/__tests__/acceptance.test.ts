/**
 * Spec acceptance test: four sessions of one activity —
 * date-only; start-only at 08:00; interval 09:00–11:00; duration-only 1.5 h —
 * must yield 4 sessions, 3 h 30 min recorded, coverage 2 of 4.
 */
import { buildTiming } from '@/domain/timing';
import { summarize, durationState, averageKnown } from '@/domain/stats';
import { formatDuration, parseDurationInput } from '@/domain/duration';
import { mkSession } from '@/test/factories';
import type { Timing } from '@/domain/types';

const TZ = 'Europe/Rome';
const D = '2026-10-10';
const ok = (r: ReturnType<typeof buildTiming>): Timing => {
  if (!r.ok) throw new Error(r.error);
  return r.timing;
};

function fourSessions() {
  const dur = parseDurationInput('1,5');
  if (!dur.ok) throw new Error('parse');
  return [
    mkSession({ id: 'a', date: D, timing: ok(buildTiming(D, { state: 'date_only' })) }),
    mkSession({ id: 'b', date: D, timing: ok(buildTiming(D, { state: 'start_only', start: '08:00', timeZone: TZ })) }),
    mkSession({ id: 'c', date: D, timing: ok(buildTiming(D, { state: 'interval', start: '09:00', end: '11:00', endDayOffset: 0, timeZone: TZ })) }),
    mkSession({ id: 'd', date: D, timing: ok(buildTiming(D, { state: 'duration_only', declaredSec: dur.seconds })) }),
  ];
}

describe('statistics acceptance', () => {
  it('counts 4 sessions, 3 h 30 min recorded, duration on 2 of 4', () => {
    const s = summarize(fourSessions());
    expect(s.sessions).toBe(4);
    expect(s.activeDays).toBe(1);
    expect(s.duration.knownSec).toBe(3.5 * 3600);
    expect(s.duration.knownCount).toBe(2);
    expect(s.duration.totalCount).toBe(4);
    expect(formatDuration(s.duration.knownSec)).toBe('3 h 30 min');
    expect(durationState(s.duration)).toEqual({ kind: 'partial', knownSec: 12600, knownCount: 2, totalCount: 4 });
  });

  it('never treats unknown durations as zero or 24 h', () => {
    const [a, b] = fourSessions();
    expect(a.timing.durationSec).toBeNull();
    expect(b.timing.durationSec).toBeNull();
    expect(summarize([a, b]).duration).toEqual({ knownSec: 0, knownCount: 0, totalCount: 2 });
    expect(durationState(summarize([a, b]).duration)).toEqual({ kind: 'none' });
    expect(averageKnown(summarize([a, b]).duration)).toBeNull();
  });

  it('updates totals and coverage when a known duration is edited or removed', () => {
    const list = fourSessions();
    // edit interval to 09:00–10:00
    list[2] = { ...list[2], timing: ok(buildTiming(D, { state: 'interval', start: '09:00', end: '10:00', endDayOffset: 0, timeZone: TZ })) };
    let s = summarize(list);
    expect(s.duration.knownSec).toBe(2.5 * 3600);
    expect(s.duration.knownCount).toBe(2);
    // remove the declared duration (back to date only)
    list[3] = { ...list[3], timing: ok(buildTiming(D, { state: 'date_only' })) };
    s = summarize(list);
    expect(s.duration.knownSec).toBe(3600);
    expect(s.duration.knownCount).toBe(1);
    expect(s.sessions).toBe(4);
  });

  it('averages exclude unknown durations and expose the contributing count', () => {
    expect(averageKnown(summarize(fourSessions()).duration)).toEqual({ avgSec: 6300, count: 2 });
  });
});
