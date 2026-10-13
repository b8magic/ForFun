import { mkSession } from '@/test/factories';
import { DATE_ONLY, buildTiming } from '@/domain/timing';
import { commonDetails, evaluateBulkDetails, KEEP_DETAILS, type BulkForm } from '../bulkForm';
import { emptyTimingForm, formFromTiming } from '../timingForm';

const zone = 'Europe/Rome';
const form = (overrides: Partial<BulkForm> = {}): BulkForm => ({ operations: { ...KEEP_DETAILS }, notes: '', place: null, timing: emptyTimingForm(zone), ...overrides });

it('starts with no patch even when existing values differ and editors hold common values', () => {
  const sessions = [mkSession({ date: '2026-10-01', notes: 'A' }), mkSession({ date: '2026-10-02', notes: 'B' })];
  expect(commonDetails(sessions, zone)).toMatchObject({ mixed: { notes: true, place: false, timing: false }, notes: '' });
  expect(evaluateBulkDetails(sessions, form({ notes: 'Unapplied' }), zone)).toMatchObject({ ok: true, dirty: false, patch: {} });
});

it('distinguishes blank replacement from explicit clear and never modifies kept fields', () => {
  const sessions = [mkSession({ date: '2026-10-01', notes: 'Keep' })];
  expect(evaluateBulkDetails(sessions, form({ operations: { ...KEEP_DETAILS, notes: 'set' } }), zone)).toMatchObject({ ok: false, errors: { notes: expect.any(String) }, patch: {} });
  expect(evaluateBulkDetails(sessions, form({ operations: { ...KEEP_DETAILS, notes: 'clear' } }), zone)).toMatchObject({ ok: true, patch: { notes: null } });
  expect(evaluateBulkDetails(sessions, form({ operations: { notes: 'keep', place: 'clear', timing: 'clear' } }), zone).patch).toEqual({ place: null, timing: DATE_ONLY });
});

it('requires a real replacement place and preserves an explicitly pasted map link', () => {
  const sessions = [mkSession({ date: '2026-10-01' })];
  const operations = { ...KEEP_DETAILS, place: 'set' as const };
  expect(evaluateBulkDetails(sessions, form({ operations }), zone)).toMatchObject({ ok: false, errors: { place: expect.any(String) } });
  const place = { label: null, address: null, mapUrl: 'https://maps.apple.com/?q=Beach', coords: null, resolution: 'unresolved' as const, resolutionNote: null };
  expect(evaluateBulkDetails(sessions, form({ operations, place }), zone)).toMatchObject({ ok: true, patch: { place } });
});

it('validates every date and detects nonexistent starts even when the domain can shift them forward', () => {
  const sessions = ['2026-03-28', '2026-03-29'].map((date) => mkSession({ date }));
  const timing = { ...emptyTimingForm(zone), mode: 'start_only' as const, start: '02:30' };
  expect(evaluateBulkDetails(sessions, form({ operations: { ...KEEP_DETAILS, timing: 'set' }, timing }), zone)).toMatchObject({ ok: false, badDates: ['2026-03-29'] });
});

it('prefills common clock inputs across DST while keeping exact declared seconds', () => {
  const before = buildTiming('2026-10-24', { state: 'interval', start: '01:30', end: '04:30', endDayOffset: 0, timeZone: zone });
  const during = buildTiming('2026-10-25', { state: 'interval', start: '01:30', end: '04:30', endDayOffset: 0, timeZone: zone });
  if (!before.ok || !during.ok) throw new Error('invalid test timing');
  const sessions = [mkSession({ date: '2026-10-24', timing: before.timing }), mkSession({ date: '2026-10-25', timing: during.timing })];
  expect(commonDetails(sessions, zone).mixed.timing).toBe(false);
  const precise = buildTiming('2026-10-01', { state: 'duration_only', declaredSec: 3671 });
  if (!precise.ok) throw new Error('invalid test timing');
  const evaluation = evaluateBulkDetails(sessions, form({ operations: { ...KEEP_DETAILS, timing: 'set' }, timing: formFromTiming(precise.timing, zone) }), zone);
  expect(evaluation.patch.timing?.declaredSec).toBe(3671);
});
