import { buildTiming, type TimingInput } from '@/domain/timing';
import { summarize } from '@/domain/stats';
import type { Session } from '@/domain/types';
import { mkSession } from '@/test/factories';
import { zonedToEpoch } from '@/domain/zoned';
import {
  buildEventDraft,
  durationLabel,
  overrideToSessionPatch,
  placeToLocation,
  representTiming,
  snapshotFromDraft,
  wallAt,
  type DraftOptions,
  type ExportOverride,
} from '../representation';

const TZ = 'Europe/Rome';

function session(date: string, input?: TimingInput, extra: Partial<Session> = {}): Session {
  const r = input ? buildTiming(date, input) : null;
  if (r && !r.ok) throw new Error(`bad timing ${r.error}`);
  return deepFreeze(mkSession({ date, ...(r ? { timing: r.timing } : {}), ...extra }));
}

function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    for (const v of Object.values(o as object)) deepFreeze(v);
    Object.freeze(o);
  }
  return o;
}

const opts = (o: Partial<DraftOptions> = {}): DraftOptions => ({
  categoryName: 'Surf',
  opId: 'op1_test_000000000000',
  prefix: '',
  suffix: '',
  includeNotes: true,
  includeLocation: true,
  startOnlySpanMin: null,
  colorId: null,
  ...o,
});

describe('representTiming', () => {
  it('date only → all-day date marker on the date, disclosed, no placeholder', () => {
    const s = session('2026-07-04');
    const r = representTiming(s);
    expect(r).toMatchObject({
      status: 'ready',
      kind: 'date_marker',
      allDay: true,
      start: { date: '2026-07-04', time: null, timeZone: null },
      end: { date: '2026-07-05', time: null, timeZone: null },
      schedulingPlaceholder: false,
      spanMin: null,
    });
    if (r.status === 'ready') expect(r.disclosure).toMatch(/non indica che sia durata tutto il giorno/);
  });

  it('start only without an approved span → pending_representation and no draft', () => {
    const s = session('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    expect(representTiming(s).status).toBe('pending_representation');
    const d = buildEventDraft(s, opts());
    expect(d.status).toBe('pending_representation');
    expect(d.draft).toBeNull();
    // Invalid spans are never treated as approved.
    for (const bad of [0, -30, 1.5, 2000, NaN]) expect(representTiming(s, { startOnlySpanMin: bad }).status).toBe('pending_representation');
  });

  it('start only with an approved span → timed placeholder; per-item approval wins over the batch preset', () => {
    const s = session('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const batch = buildEventDraft(s, opts({ startOnlySpanMin: 90 }));
    expect(batch.status).toBe('ready');
    expect(batch.draft).toMatchObject({
      allDay: false,
      start: { date: '2026-07-04', time: '07:00', timeZone: TZ },
      end: { date: '2026-07-04', time: '08:30', timeZone: TZ },
      appMeta: { timingState: 'start_only', durationSec: null, durationSource: null, schedulingPlaceholder: true },
    });
    expect(batch.representation).toMatchObject({ kind: 'scheduling_span', spanMin: 90 });
    expect(batch.representation.disclosure).toContain('90 min');
    const item = buildEventDraft(s, opts({ startOnlySpanMin: 90, override: { startOnlySpanMin: 45 } }));
    expect(item.draft?.end.time).toBe('07:45');
    // Late start: the span crosses midnight.
    const late = session('2026-07-04', { state: 'start_only', start: '23:30', timeZone: TZ });
    expect(buildEventDraft(late, opts({ startOnlySpanMin: 60 })).draft?.end).toEqual({ date: '2026-07-05', time: '00:30', timeZone: TZ });
  });

  it('interval → recorded start/end in the session zone; next-day end; DST-correct span', () => {
    const s = session('2026-07-04', { state: 'interval', start: '07:15', end: '09:00', endDayOffset: 0, timeZone: TZ });
    const d = buildEventDraft(s, opts());
    expect(d.draft).toMatchObject({
      allDay: false,
      start: { date: '2026-07-04', time: '07:15', timeZone: TZ },
      end: { date: '2026-07-04', time: '09:00', timeZone: TZ },
      appMeta: { timingState: 'interval', durationSec: 6300, durationSource: 'interval', schedulingPlaceholder: false },
    });
    const night = session('2026-07-04', { state: 'interval', start: '22:00', end: '01:00', endDayOffset: 1, timeZone: TZ });
    expect(buildEventDraft(night, opts()).draft?.end).toEqual({ date: '2026-07-05', time: '01:00', timeZone: TZ });
    // Fall-back night in Rome: 01:30 → 03:30 lasts three hours.
    const dst = session('2026-10-25', { state: 'interval', start: '01:30', end: '03:30', endDayOffset: 0, timeZone: TZ });
    expect(representTiming(dst)).toMatchObject({ status: 'ready', spanMin: 180 });
    // Another zone is kept as recorded.
    const ny = session('2026-07-04', { state: 'interval', start: '06:00', end: '07:00', endDayOffset: 0, timeZone: 'America/New_York' });
    expect(buildEventDraft(ny, opts()).draft?.start.timeZone).toBe('America/New_York');
  });

  it('duration only → all-day marker with "Durata: 1 h 30 min" in the description; never a start time', () => {
    const s = session('2026-07-04', { state: 'duration_only', declaredSec: 5400 }, { notes: 'Mare mosso' });
    const d = buildEventDraft(s, opts());
    expect(d.draft).toMatchObject({
      allDay: true,
      start: { date: '2026-07-04', time: null },
      end: { date: '2026-07-05', time: null },
      notes: 'Durata: 1 h 30 min\n\nMare mosso',
      appMeta: { timingState: 'duration_only', durationSec: 5400, durationSource: 'declared', schedulingPlaceholder: false },
    });
    expect(d.representation.kind).toBe('duration_marker');
    // The duration line is timing content: it stays when notes are excluded.
    expect(buildEventDraft(s, opts({ includeNotes: false })).draft?.notes).toBe('Durata: 1 h 30 min');
  });

  it('duration only + explicit outgoing time → timed export-only event, session timing untouched', () => {
    const s = session('2026-07-04', { state: 'duration_only', declaredSec: 5400 });
    const d = buildEventDraft(s, opts({ override: { time: { start: '18:00' } }, defaultTimeZone: TZ }));
    expect(d.draft).toMatchObject({
      allDay: false,
      start: { time: '18:00', timeZone: TZ },
      end: { time: '19:30' },
      notes: 'Durata: 1 h 30 min',
      appMeta: { timingState: 'duration_only', durationSec: 5400, schedulingPlaceholder: true },
    });
    expect(d.representation.kind).toBe('outgoing_time');
    expect(s.timing.start).toBeNull();
  });

  it('start + declared duration → timed start…derived end', () => {
    const s = session('2026-07-04', { state: 'start_duration', start: '23:30', timeZone: TZ, declaredSec: 7200 });
    const d = buildEventDraft(s, opts());
    expect(d.draft).toMatchObject({
      start: { date: '2026-07-04', time: '23:30' },
      end: { date: '2026-07-05', time: '01:30' },
      appMeta: { timingState: 'start_duration', durationSec: 7200, durationSource: 'declared', schedulingPlaceholder: false },
    });
    expect(d.representation.kind).toBe('start_duration');
  });

  it('outgoing date/time overrides are validated and only change the outgoing event', () => {
    const s = session('2026-07-04', { state: 'interval', start: '07:00', end: '08:00', endDayOffset: 0, timeZone: TZ });
    const moved = buildEventDraft(s, opts({ override: { date: '2026-07-05', time: { start: '10:00', end: '11:30' } } }));
    expect(moved.draft).toMatchObject({ start: { date: '2026-07-05', time: '10:00' }, end: { date: '2026-07-05', time: '11:30' } });
    expect(moved.draft?.appMeta).toMatchObject({ timingState: 'interval', durationSec: 3600, schedulingPlaceholder: true });
    expect(s.date).toBe('2026-07-04');
    expect(s.timing).toMatchObject({ start: '07:00', end: '08:00', durationSec: 3600 });

    expect(buildEventDraft(s, opts({ override: { date: '2026-02-30' } })).status).toBe('invalid');
    expect(buildEventDraft(s, opts({ override: { time: { start: '25:00' } } })).representation).toMatchObject({ status: 'invalid', error: 'invalid_time' });
    expect(buildEventDraft(s, opts({ override: { time: { start: '10:00', end: '09:00' } } })).representation).toMatchObject({ status: 'invalid', error: 'end_not_after_start' });
    // A date-only session given a time but no span stays pending; with a span it becomes a placeholder.
    const d0 = session('2026-07-04');
    expect(buildEventDraft(d0, opts({ override: { time: { start: '09:00' } }, defaultTimeZone: TZ })).status).toBe('pending_representation');
    expect(buildEventDraft(d0, opts({ override: { time: { start: '09:00', spanMin: 60 } }, defaultTimeZone: TZ })).draft).toMatchObject({
      start: { time: '09:00', timeZone: TZ },
      end: { time: '10:00' },
      appMeta: { timingState: 'date_only', durationSec: null, schedulingPlaceholder: true },
    });
  });
});

describe('content', () => {
  const place = { label: 'La Fuente', address: 'Villaviciosa, Asturias', mapUrl: 'https://maps.app.goo.gl/abc', coords: null, resolution: 'unresolved' as const, resolutionNote: null };

  it('maps notes and location, preserving the map link, with explicit omit controls', () => {
    const s = session('2026-07-04', undefined, { notes: 'Onde da 1 m', place });
    const d = buildEventDraft(s, opts({ prefix: '🌊 ', suffix: ' ·', colorId: '7' }));
    expect(d.draft).toMatchObject({
      title: '🌊 Surf ·',
      notes: 'Onde da 1 m\n\nMappa: https://maps.app.goo.gl/abc',
      location: 'La Fuente, Villaviciosa, Asturias',
      colorId: '7',
    });
    const none = buildEventDraft(s, opts({ includeNotes: false, includeLocation: false }));
    expect(none.draft).toMatchObject({ notes: null, location: null });
    const ov = buildEventDraft(s, opts({ override: { baseTitle: 'Surf al tramonto', notes: 'Solo per il calendario', location: 'Gijón' } }));
    expect(ov.draft).toMatchObject({ title: 'Surf al tramonto', notes: 'Solo per il calendario', location: 'Gijón' });
    // Excluding notes for the batch also hides per-item notes (privacy first); the map link belongs to the location.
    expect(buildEventDraft(s, opts({ includeNotes: false, override: { notes: 'x' } })).draft?.notes).toBe('Mappa: https://maps.app.goo.gl/abc');
  });

  it('placeToLocation handles link-only, coordinates-only and duplicated label/address', () => {
    expect(placeToLocation({ ...place, label: null, address: null })).toEqual({ location: 'https://maps.app.goo.gl/abc', mapLine: null });
    expect(placeToLocation({ label: null, address: null, mapUrl: null, coords: { lat: 43.5, lng: -5.66 }, resolution: 'manual', resolutionNote: null })).toEqual({ location: '43.500000, -5.660000', mapLine: null });
    expect(placeToLocation({ ...place, label: 'La Fuente', address: 'La Fuente, Asturias', mapUrl: null }).location).toBe('La Fuente, Asturias');
    expect(placeToLocation(null)).toEqual({ location: null, mapLine: null });
  });

  it('labels the recorded duration separately from any calendar span', () => {
    expect(durationLabel(session('2026-07-04'))).toBe('Durata non specificata');
    expect(durationLabel(session('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ }))).toBe('Durata non specificata');
    expect(durationLabel(session('2026-07-04', { state: 'duration_only', declaredSec: 5400 }))).toBe('1 h 30 min');
  });

  it('snapshots keep the true timing provenance and use instants for timed events', () => {
    const s = session('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ });
    const d = buildEventDraft(s, opts({ startOnlySpanMin: 60 })).draft!;
    expect(snapshotFromDraft(d, 'Surf')).toEqual({
      title: 'Surf',
      notes: null,
      location: null,
      allDay: false,
      start: '2026-07-04T05:00:00.000Z',
      end: '2026-07-04T06:00:00.000Z',
      timeZone: TZ,
      timingState: 'start_only',
      durationSec: null,
      durationSource: null,
      schedulingPlaceholder: true,
      categoryName: 'Surf',
    });
    const allDay = buildEventDraft(session('2026-07-04'), opts()).draft!;
    expect(snapshotFromDraft(allDay, 'Surf')).toMatchObject({ allDay: true, start: '2026-07-04', end: '2026-07-05', timeZone: null });
  });
});

describe('scheduling placeholders never affect statistics', () => {
  it('summaries of the sessions are identical before and after building placeholder drafts', () => {
    const sessions = [
      session('2026-07-01', { state: 'start_only', start: '07:00', timeZone: TZ }),
      session('2026-07-02'),
      session('2026-07-03', { state: 'duration_only', declaredSec: 5400 }),
      session('2026-07-03', { state: 'interval', start: '17:00', end: '18:00', endDayOffset: 0, timeZone: TZ }),
    ];
    const before = summarize(sessions);
    const drafts = sessions.map((s) => buildEventDraft(s, opts({ startOnlySpanMin: 120, override: s.timing.state === 'date_only' ? { time: { start: '09:00', spanMin: 90 } } : null, defaultTimeZone: TZ })));
    expect(drafts.every((d) => d.status === 'ready')).toBe(true);
    expect(summarize(sessions)).toEqual(before);
    expect(before.duration).toEqual({ knownSec: 5400 + 3600, knownCount: 2, totalCount: 4 });
    // Placeholder spans exist only on the drafts, flagged, with unknown duration in the metadata.
    const placeholders = drafts.filter((d) => d.draft?.appMeta.schedulingPlaceholder);
    expect(placeholders).toHaveLength(2);
    expect(placeholders.map((d) => d.draft!.appMeta.durationSec)).toEqual([null, null]);
  });
});

describe('overrideToSessionPatch (explicit apply-back only)', () => {
  const s = session('2026-07-04', { state: 'start_only', start: '07:00', timeZone: TZ }, { notes: 'originale' });
  const override: ExportOverride = { baseTitle: 'Surf lungo', notes: 'nuove note', date: '2026-07-05', time: { start: '08:00', spanMin: 90 }, location: 'Lido' };

  it('patches only the fields the user chose; titles are never applied', () => {
    const r = overrideToSessionPatch(s, override, ['notes']);
    expect(r).toEqual({ ok: true, patch: { notes: 'nuove note' }, applied: ['notes'], timingChanges: [] });
    const none = overrideToSessionPatch(s, override, []);
    expect(none).toMatchObject({ ok: true, patch: {}, applied: [] });
    expect(s.notes).toBe('originale');
  });

  it('never turns an export-only span into a duration', () => {
    const r = overrideToSessionPatch(s, override, ['date', 'time']);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.patch.date).toBe('2026-07-05');
    expect(r.patch.timing).toMatchObject({ state: 'start_only', start: '08:00', durationSec: null, durationSource: null });
  });

  it('builds an interval from an explicit end, and keeps a declared duration as the source of truth', () => {
    const iv = overrideToSessionPatch(s, { time: { start: '08:00', end: '09:30' } }, ['time']);
    expect(iv.ok && iv.patch.timing).toMatchObject({ state: 'interval', durationSec: 5400, durationSource: 'interval' });
    expect(iv.ok && iv.timingChanges).toEqual(expect.arrayContaining(['needs_end']));
    const dur = session('2026-07-04', { state: 'duration_only', declaredSec: 3600 });
    const sd = overrideToSessionPatch(dur, { time: { start: '18:00' } }, ['time']);
    expect(sd.ok && sd.patch.timing).toMatchObject({ state: 'start_duration', start: '18:00', declaredSec: 3600, durationSource: 'declared' });
    const bad = overrideToSessionPatch(s, { time: { start: '10:00', end: '09:00' } }, ['time']);
    expect(bad).toEqual({ ok: false, error: 'end_before_start', field: 'time' });
  });

  it('applies location text as the place label, keeping the original map link', () => {
    const withPlace = session('2026-07-04', undefined, { place: { label: 'Vecchio', address: null, mapUrl: 'https://maps.app.goo.gl/x', coords: null, resolution: 'unresolved', resolutionNote: null } });
    const r = overrideToSessionPatch(withPlace, { location: 'Nuovo posto' }, ['location']);
    expect(r.ok && r.patch.place).toMatchObject({ label: 'Nuovo posto', mapUrl: 'https://maps.app.goo.gl/x' });
    const cleared = overrideToSessionPatch(withPlace, { location: '  ' }, ['location']);
    expect(cleared.ok && cleared.patch.place).toBeNull();
  });
});

describe('DST: derived ends that fall in a repeated hour (regression)', () => {
  // Rome falls back on 2026-10-25: 03:00 CEST → 02:00 CET, so 02:00–02:59 happens twice.
  const instant = (p: { date: string; time: string | null; timeZone: string | null }) => zonedToEpoch(p.date, p.time!, p.timeZone!).epochMs;

  it('start + declared 2 h from 01:30 on the fall-back night is a 2 h event, not 1 h', () => {
    const s = session('2026-10-25', { state: 'start_duration', start: '01:30', timeZone: TZ, declaredSec: 7200 });
    const d = buildEventDraft(s, opts());
    if (d.status !== 'ready') throw new Error(d.status);
    expect(d.representation.spanMin).toBe(120);
    // Read back the way providers do (date + wall time + zone): exactly start + 2 h.
    expect(instant(d.draft.end) - instant(d.draft.start)).toBe(7200 * 1000);
    expect(d.draft.end).toEqual({ date: '2026-10-25', time: '02:30', timeZone: 'Etc/GMT-1' });
    expect(d.draft.start.timeZone).toBe(TZ);
    const snap = snapshotFromDraft(d.draft, 'Surf');
    expect(Date.parse(snap.end) - Date.parse(snap.start)).toBe(7200 * 1000);
  });

  it('approved start-only span and outgoing spans are DST-safe too; ordinary ends keep the session zone', () => {
    const so = session('2026-10-25', { state: 'start_only', start: '01:45', timeZone: TZ });
    const d = buildEventDraft(so, opts({ startOnlySpanMin: 90 }));
    if (d.status !== 'ready') throw new Error(d.status);
    expect(instant(d.draft.end) - instant(d.draft.start)).toBe(90 * 60 * 1000);
    expect(d.draft.appMeta).toMatchObject({ durationSec: null, schedulingPlaceholder: true });
    const dur = session('2026-10-25', { state: 'duration_only', declaredSec: 5400 });
    const o = buildEventDraft(dur, opts({ override: { time: { start: '01:30' } }, defaultTimeZone: TZ }));
    if (o.status !== 'ready') throw new Error(o.status);
    expect(instant(o.draft.end) - instant(o.draft.start)).toBe(5400 * 1000);
    // First pass through the repeated hour, or any ordinary time, stays in the session zone.
    expect(buildEventDraft(session('2026-10-25', { state: 'start_duration', start: '01:00', timeZone: TZ, declaredSec: 3600 }), opts()).draft?.end).toEqual({ date: '2026-10-25', time: '02:00', timeZone: TZ });
    expect(wallAt(Date.parse('2026-07-04T06:00:00Z'), TZ)).toEqual({ date: '2026-07-04', time: '08:00', timeZone: TZ });
    // Spring forward (02:00 → 03:00): 01:30 + 1 h is 03:30, an ordinary wall time.
    expect(buildEventDraft(session('2026-03-29', { state: 'start_duration', start: '01:30', timeZone: TZ, declaredSec: 3600 }), opts()).draft?.end).toEqual({ date: '2026-03-29', time: '03:30', timeZone: TZ });
  });
});
