import {
  durationInputFrom,
  durationSourceCopy,
  derivedEndCopy,
  emptyTimingForm,
  evaluateTiming,
  fieldErrorCopy,
  formFromTiming,
  normalizeTimeInput,
  previewSwitch,
  sameTiming,
  type TimingForm,
} from '../timingForm';
import { buildTiming, DATE_ONLY } from '@/domain/timing';
import { parseDurationInput } from '@/domain/duration';
import { t } from '@/i18n/it';

const TZ = 'Europe/Rome';
const D = '2026-10-10';
const form = (p: Partial<TimingForm>): TimingForm => ({ ...emptyTimingForm(TZ), ...p });

describe('normalizeTimeInput', () => {
  it.each([
    ['7:45', '07:45'],
    ['07:45', '07:45'],
    ['745', '07:45'],
    ['0745', '07:45'],
    ['1945', '19:45'],
    ['7.45', '07:45'],
    ['7h45', '07:45'],
    ['19', '19:00'],
    [' 6 ', '06:00'],
  ])('%s → %s', (raw, out) => expect(normalizeTimeInput(raw)).toBe(out));
  it.each(['24:00', '7:60', 'abc', '12345', '7:5'])('leaves unreadable %s for validation', (raw) => {
    expect(normalizeTimeInput(raw)).toBe(raw.trim());
  });
});

describe('durationInputFrom round-trips through parseDurationInput', () => {
  it.each([5400, 2700, 7200, 4800, 900, 3660, 99 * 3600])('%i s', (sec) => {
    const r = parseDurationInput(durationInputFrom(sec));
    expect(r).toEqual({ ok: true, seconds: sec });
  });
  it('uses the locale decimal comma for clean quarters', () => {
    expect(durationInputFrom(5400)).toBe('1,5');
    expect(durationInputFrom(4800)).toBe('1:20');
  });
});

describe('evaluateTiming', () => {
  it('date only is always valid with unknown duration', () => {
    const ev = evaluateTiming(D, form({ mode: 'date_only' }), TZ);
    expect(ev).toMatchObject({ ok: true, effective: 'date_only' });
    expect(ev.timing).toEqual(DATE_ONLY);
  });

  it('interval derives the duration from start and end', () => {
    const ev = evaluateTiming(D, form({ mode: 'interval', start: '7:30', end: '0900' }), TZ);
    expect(ev.ok).toBe(true);
    expect(ev.timing).toMatchObject({ state: 'interval', start: '07:30', end: '09:00', durationSec: 5400, durationSource: 'interval', timeZone: TZ });
  });

  it('never infers overnight: end before start is an error until next day is explicit', () => {
    const f = form({ mode: 'interval', start: '23:00', end: '01:00' });
    expect(evaluateTiming(D, f, TZ)).toMatchObject({ ok: false, errors: { end: 'end_before_start' } });
    expect(evaluateTiming(D, { ...f, nextDay: true }, TZ).timing).toMatchObject({ endDayOffset: 1, durationSec: 7200 });
  });

  it('equal times are an error, not 24 h', () => {
    expect(evaluateTiming(D, form({ mode: 'interval', start: '10:00', end: '10:00' }), TZ)).toMatchObject({ ok: false, errors: { end: 'equal_times' } });
  });

  it('accepts 1,5 / 1.5 / 1:30 as the same declared duration', () => {
    for (const d of ['1,5', '1.5', '1:30']) {
      const ev = evaluateTiming(D, form({ mode: 'duration_only', duration: d }), TZ);
      expect(ev.timing).toMatchObject({ state: 'duration_only', declaredSec: 5400, durationSec: 5400, durationSource: 'declared', start: null });
    }
  });

  it('blank duration means "not provided", never zero', () => {
    const ev = evaluateTiming(D, form({ mode: 'duration_only', duration: '  ' }), TZ);
    expect(ev).toMatchObject({ ok: true, effective: 'date_only' });
    expect(ev.timing?.durationSec).toBeNull();
  });

  it('zero or garbage duration is a visible error', () => {
    expect(evaluateTiming(D, form({ mode: 'duration_only', duration: '0' }), TZ).errors.duration).toBe('duration');
    expect(evaluateTiming(D, form({ mode: 'duration_only', duration: 'tanto' }), TZ).errors.duration).toBe('duration');
    expect(evaluateTiming(D, form({ mode: 'duration_only', duration: '120' }), TZ).errors.duration).toBe('duration_too_long');
  });

  it('blank fields fall back to the most specific state they support', () => {
    expect(evaluateTiming(D, form({ mode: 'interval', start: '08:00' }), TZ).effective).toBe('start_only');
    expect(evaluateTiming(D, form({ mode: 'interval' }), TZ).effective).toBe('date_only');
    expect(evaluateTiming(D, form({ mode: 'start_duration', start: '08:00' }), TZ).effective).toBe('start_only');
    expect(evaluateTiming(D, form({ mode: 'start_duration', duration: '2' }), TZ).effective).toBe('duration_only');
    expect(evaluateTiming(D, form({ mode: 'start_only' }), TZ).effective).toBe('date_only');
  });

  it('an end without a start asks for the start', () => {
    expect(evaluateTiming(D, form({ mode: 'interval', end: '09:00' }), TZ)).toMatchObject({ ok: false, errors: { start: 'needs_start' } });
  });

  it('bad clock text is reported on its field', () => {
    expect(evaluateTiming(D, form({ mode: 'start_only', start: '25:00' }), TZ).errors.start).toBe('time');
    expect(evaluateTiming(D, form({ mode: 'interval', start: '08:00', end: '9' + ':7' }), TZ).errors.end).toBe('time');
  });

  it('blank zone uses the device zone; an unknown zone is an error', () => {
    const ev = evaluateTiming(D, form({ mode: 'start_only', start: '08:00', zone: '' }), 'America/New_York');
    expect(ev.timing?.timeZone).toBe('America/New_York');
    expect(ev.zoneUsed).toBe('America/New_York');
    expect(evaluateTiming(D, form({ mode: 'start_only', start: '08:00', zone: 'Mars/Olympus' }), TZ).errors.zone).toBe('zone');
    // zone is irrelevant (and never validated) when there is no clock time
    expect(evaluateTiming(D, form({ mode: 'duration_only', duration: '1', zone: 'Mars/Olympus' }), TZ).ok).toBe(true);
  });

  it('derives DST-correct interval durations on the session date', () => {
    // 2026-10-25: Europe/Rome falls back at 03:00 → 02:00
    const ev = evaluateTiming('2026-10-25', form({ mode: 'interval', start: '01:00', end: '04:00' }), TZ);
    expect(ev.timing?.durationSec).toBe(4 * 3600);
  });

  it('flags a nonexistent wall time on spring-forward day', () => {
    const ev = evaluateTiming('2026-03-29', form({ mode: 'start_only', start: '02:30' }), TZ);
    expect(ev).toMatchObject({ ok: true, note: 'nonexistent_time' });
  });
});

describe('formFromTiming', () => {
  it('round-trips every state through the form', () => {
    const inputs = [
      { state: 'date_only' as const },
      { state: 'start_only' as const, start: '06:15', timeZone: TZ },
      { state: 'interval' as const, start: '22:00', end: '00:30', endDayOffset: 1 as const, timeZone: TZ },
      { state: 'duration_only' as const, declaredSec: 4800 },
      { state: 'start_duration' as const, start: '07:00', timeZone: TZ, declaredSec: 5400 },
    ];
    for (const i of inputs) {
      const r = buildTiming(D, i);
      if (!r.ok) throw new Error('fixture');
      const ev = evaluateTiming(D, formFromTiming(r.timing, 'UTC'), 'UTC');
      expect(ev.ok).toBe(true);
      expect(sameTiming(ev.timing!, r.timing)).toBe(true);
    }
  });
  it('fills the zone with the device zone only when the timing has none', () => {
    expect(formFromTiming(DATE_ONLY, 'Asia/Tokyo').zone).toBe('Asia/Tokyo');
  });
});

describe('previewSwitch', () => {
  it('interval → duration: drops start and end, keeps the computed duration as declared (prefilled, visible)', () => {
    const f = form({ mode: 'interval', start: '07:30', end: '09:00' });
    const pv = previewSwitch(D, f, 'duration_only', TZ);
    expect(pv.changes).toEqual(expect.arrayContaining(['drops_start', 'drops_end', 'keeps_duration_as_declared']));
    expect(pv.needsConfirm).toBe(true);
    expect(pv.next).toMatchObject({ mode: 'duration_only', start: '', end: '', duration: '1,5' });
    expect(pv.prefill).toEqual({ field: 'duration', text: '1 h 30 min' });
    expect(pv.lines).toEqual(
      expect.arrayContaining([t.sessionSheets.swDropsStart('07:30'), t.sessionSheets.swDropsEnd('09:00'), t.sessionSheets.swKeepsDeclared('1 h 30 min')]),
    );
    expect(evaluateTiming(D, pv.next, TZ).timing).toMatchObject({ durationSec: 5400, durationSource: 'declared' });
  });

  it('interval → start + duration keeps the start and the duration', () => {
    const pv = previewSwitch(D, form({ mode: 'interval', start: '07:30', end: '08:15' }), 'start_duration', TZ);
    expect(pv.next).toMatchObject({ start: '07:30', end: '', duration: '0,75' });
    expect(pv.changes).not.toContain('drops_start');
  });

  it('start + duration → interval prefills the end from the derived end, next day explicit', () => {
    const pv = previewSwitch(D, form({ mode: 'start_duration', start: '23:00', duration: '2' }), 'interval', TZ);
    expect(pv.next).toMatchObject({ mode: 'interval', start: '23:00', end: '01:00', nextDay: true, duration: '' });
    expect(pv.prefill?.field).toBe('end');
    expect(pv.lines).toContain(t.sessionSheets.swEndPrefilled(t.sessionSheets.derivedNextDay('01:00')));
    expect(evaluateTiming(D, pv.next, TZ).timing).toMatchObject({ durationSec: 7200, durationSource: 'interval' });
  });

  it('interval → start only drops the end and says the duration becomes unknown', () => {
    const pv = previewSwitch(D, form({ mode: 'interval', start: '07:30', end: '09:00', nextDay: true }), 'start_only', TZ);
    expect(pv.changes).toEqual(['drops_end', 'duration_becomes_unknown']);
    expect(pv.next).toMatchObject({ start: '07:30', end: '', nextDay: false });
  });

  it('date only → anything needs no confirmation (nothing is lost)', () => {
    const pv = previewSwitch(D, form({ mode: 'date_only' }), 'interval', TZ);
    expect(pv.needsConfirm).toBe(false);
    expect(pv.lines).toEqual([t.sessionSheets.swNeedsStart, t.sessionSheets.swNeedsEnd]);
  });

  it('switching to the same mode changes nothing', () => {
    expect(previewSwitch(D, form({ mode: 'start_only', start: '08:00' }), 'start_only', TZ).changes).toEqual([]);
  });

  it('describes a switch while another field is still invalid', () => {
    const pv = previewSwitch(D, form({ mode: 'interval', start: '07:30', end: '06:00' }), 'duration_only', TZ);
    expect(pv.changes).toEqual(expect.arrayContaining(['drops_start', 'drops_end', 'needs_duration']));
    expect(pv.prefill).toBeNull();
  });
});

describe('copy', () => {
  it('maps errors to the required strings', () => {
    expect(fieldErrorCopy('end_before_start')).toBe(t.errEndBeforeStart);
    expect(fieldErrorCopy('equal_times')).toBe(t.errEqualTimes);
    expect(fieldErrorCopy('duration')).toBe(t.errDuration);
    expect(fieldErrorCopy('time')).toBe(t.errTime);
  });
  it('states the duration source unambiguously', () => {
    const iv = evaluateTiming(D, form({ mode: 'interval', start: '07:00', end: '08:00' }), TZ).timing;
    expect(durationSourceCopy(iv)).toEqual({ text: t.durationFromInterval, value: '1 h', known: true });
    const dec = evaluateTiming(D, form({ mode: 'duration_only', duration: '0,5' }), TZ).timing;
    expect(durationSourceCopy(dec)).toEqual({ text: t.durationDeclared, value: '30 min', known: true });
    expect(durationSourceCopy(DATE_ONLY)).toEqual({ text: t.durationUnknown, value: null, known: false });
  });
  it('marks the derived end as derived', () => {
    const tm = evaluateTiming(D, form({ mode: 'start_duration', start: '07:00', duration: '1:30' }), TZ).timing;
    expect(derivedEndCopy(D, tm)).toBe(t.derivedEnd('08:30'));
    const late = evaluateTiming(D, form({ mode: 'start_duration', start: '23:30', duration: '1' }), TZ).timing;
    expect(derivedEndCopy(D, late)).toBe(t.derivedEnd(t.sessionSheets.derivedNextDay('00:30')));
  });
});

describe('previewSwitch confirmation', () => {
  it('duration only → start + duration loses nothing, so it switches without asking', () => {
    const pv = previewSwitch(D, form({ mode: 'duration_only', duration: '1,5' }), 'start_duration', TZ);
    expect(pv.needsConfirm).toBe(false);
    expect(pv.next).toMatchObject({ mode: 'start_duration', duration: '1,5' });
  });
  it('start only → interval needs only an end, no confirmation', () => {
    expect(previewSwitch(D, form({ mode: 'start_only', start: '08:00' }), 'interval', TZ).needsConfirm).toBe(false);
  });
});
