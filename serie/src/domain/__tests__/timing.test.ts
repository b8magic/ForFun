import { buildTiming, normalizeTiming, removeEnd, derivedEnd, describeSwitch, DATE_ONLY } from '@/domain/timing';
import { intervalSeconds, zonedToEpoch, epochToZoned } from '@/domain/zoned';

const TZ = 'Europe/Rome';

describe('timing states', () => {
  it('date only has unknown duration', () => {
    const r = buildTiming('2026-10-10', { state: 'date_only' });
    expect(r.ok && r.timing).toEqual(DATE_ONLY);
  });
  it('start only keeps the time and leaves duration unknown', () => {
    const r = buildTiming('2026-10-10', { state: 'start_only', start: '08:00', timeZone: TZ });
    expect(r.ok && r.timing).toMatchObject({ state: 'start_only', start: '08:00', end: null, durationSec: null, durationSource: null });
  });
  it('interval derives duration from the interval', () => {
    const r = buildTiming('2026-10-10', { state: 'interval', start: '09:00', end: '11:00', endDayOffset: 0, timeZone: TZ });
    expect(r.ok && r.timing).toMatchObject({ durationSec: 7200, durationSource: 'interval', declaredSec: null });
  });
  it('rejects an end before start unless the next-day flag is explicit', () => {
    expect(buildTiming('2026-10-10', { state: 'interval', start: '23:00', end: '01:00', endDayOffset: 0, timeZone: TZ })).toMatchObject({ ok: false, error: 'end_before_start' });
    const r = buildTiming('2026-10-10', { state: 'interval', start: '23:00', end: '01:00', endDayOffset: 1, timeZone: TZ });
    expect(r.ok && r.timing.durationSec).toBe(7200);
  });
  it('never treats equal clock times as 24 h unless next-day is explicit', () => {
    expect(buildTiming('2026-10-10', { state: 'interval', start: '10:00', end: '10:00', endDayOffset: 0, timeZone: TZ })).toMatchObject({ ok: false, error: 'equal_times' });
    const r = buildTiming('2026-10-10', { state: 'interval', start: '10:00', end: '10:00', endDayOffset: 1, timeZone: TZ });
    expect(r.ok && r.timing.durationSec).toBe(86400);
  });
  it('duration only never fabricates clock times', () => {
    const r = buildTiming('2026-10-10', { state: 'duration_only', declaredSec: 5400 });
    expect(r.ok && r.timing).toMatchObject({ start: null, end: null, timeZone: null, durationSec: 5400, durationSource: 'declared' });
  });
  it('rejects invalid durations', () => {
    for (const v of [0, -10, NaN, Infinity, 1.5]) expect(buildTiming('2026-10-10', { state: 'duration_only', declaredSec: v })).toMatchObject({ ok: false });
  });
  it('start + declared duration keeps the declared duration as source and derives the end', () => {
    const r = buildTiming('2026-10-10', { state: 'start_duration', start: '07:30', timeZone: TZ, declaredSec: 5400 });
    if (!r.ok) throw new Error();
    expect(r.timing).toMatchObject({ durationSec: 5400, durationSource: 'declared', end: null });
    expect(derivedEnd('2026-10-10', r.timing)).toEqual({ date: '2026-10-10', time: '09:00' });
  });
  it('removing the end of an interval returns to start-only with unknown duration', () => {
    const r = buildTiming('2026-10-10', { state: 'interval', start: '09:00', end: '11:00', endDayOffset: 0, timeZone: TZ });
    if (!r.ok) throw new Error();
    expect(removeEnd(r.timing)).toMatchObject({ state: 'start_only', start: '09:00', end: null, durationSec: null });
  });
  it('normalizes stale stored values conservatively', () => {
    expect(normalizeTiming('2026-10-10', { state: 'date_only', durationSec: 3600 } as never)).toEqual(DATE_ONLY);
    expect(normalizeTiming('2026-10-10', { state: 'start_only', start: '08:00', timeZone: TZ, durationSec: 999 } as never)).toMatchObject({ durationSec: null });
    expect(normalizeTiming('2026-10-10', { state: 'interval', start: '09:00', end: '08:00', endDayOffset: 0, timeZone: TZ } as never)).toMatchObject({ state: 'start_only', durationSec: null });
  });
  it('describes consequences of switching representation', () => {
    const r = buildTiming('2026-10-10', { state: 'interval', start: '09:00', end: '11:00', endDayOffset: 0, timeZone: TZ });
    if (!r.ok) throw new Error();
    expect(describeSwitch(r.timing, 'start_only')).toEqual(expect.arrayContaining(['drops_end', 'duration_becomes_unknown']));
    expect(describeSwitch(r.timing, 'duration_only')).toEqual(expect.arrayContaining(['drops_start', 'drops_end', 'keeps_duration_as_declared']));
  });
});

describe('DST-correct intervals', () => {
  it('spring forward in Rome: 01:00–04:00 lasts 2 h', () => {
    expect(intervalSeconds('2026-03-29', '01:00', '04:00', 0, TZ).seconds).toBe(2 * 3600);
  });
  it('fall back in Rome: 01:00–04:00 lasts 4 h', () => {
    expect(intervalSeconds('2026-10-25', '01:00', '04:00', 0, TZ).seconds).toBe(4 * 3600);
  });
  it('overnight across fall back: 22:00 → 06:00 next day lasts 9 h', () => {
    expect(intervalSeconds('2026-10-24', '22:00', '06:00', 1, TZ).seconds).toBe(9 * 3600);
  });
  it('resolves nonexistent and ambiguous wall times explicitly', () => {
    expect(zonedToEpoch('2026-03-29', '02:30', TZ).kind).toBe('nonexistent');
    expect(epochToZoned(zonedToEpoch('2026-03-29', '02:30', TZ).epochMs, TZ).time).toBe('03:30');
    expect(zonedToEpoch('2026-10-25', '02:30', TZ).kind).toBe('ambiguous');
  });
  it('works in a southern-hemisphere zone and in UTC', () => {
    expect(intervalSeconds('2026-04-05', '01:00', '04:00', 0, 'Australia/Sydney').seconds).toBe(4 * 3600);
    expect(intervalSeconds('2026-06-01', '23:30', '00:30', 1, 'UTC').seconds).toBe(3600);
  });
});
