import { DEFAULT_SETTINGS, editSettings, linkSettings, resetAllTitles, setOverride, clearOverride, tapIntent, startOnlyCount } from '../exportModel';
import { checkRange, presetRange } from '../rangeHelpers';
import { mkSession } from '@/test/factories';
import type { ExportPlanRow } from '@/calendar/exportEngine';

const row = (over: Partial<ExportPlanRow>): ExportPlanRow => ({ action: 'create', allowedActions: ['create', 'skip'], selected: true, ...over }) as ExportPlanRow;

describe('export settings', () => {
  it('edits one destination or both when linked', () => {
    const base = { google: DEFAULT_SETTINGS, apple: DEFAULT_SETTINGS };
    const one = editSettings(base, ['google', 'apple'], 'google', false, (s) => ({ ...s, prefix: '🏄 ' }));
    expect(one.google?.prefix).toBe('🏄 ');
    expect(one.apple?.prefix).toBe('');
    const both = editSettings(base, ['google', 'apple'], 'google', true, (s) => ({ ...s, suffix: ' · Serie' }));
    expect(both.google?.suffix).toBe(' · Serie');
    expect(both.apple?.suffix).toBe(' · Serie');
  });

  it('linking copies the edited destination without sharing override objects', () => {
    const m = { google: setOverride(DEFAULT_SETTINGS, 's1', 'baseTitle', 'Alba'), apple: DEFAULT_SETTINGS };
    const l = linkSettings(m, ['google', 'apple'], 'google');
    expect(l.apple?.overrides.s1?.baseTitle).toBe('Alba');
    expect(l.apple?.overrides).not.toBe(l.google?.overrides);
  });

  it('overrides are removed when emptied and title resets keep other fields', () => {
    let s = setOverride(DEFAULT_SETTINGS, 's1', 'baseTitle', 'Alba');
    s = setOverride(s, 's1', 'notes', 'onda');
    s = resetAllTitles(s);
    expect(s.overrides.s1).toEqual({ notes: 'onda' });
    s = setOverride(s, 's1', 'notes', undefined);
    expect(s.overrides.s1).toBeUndefined();
    expect(clearOverride(setOverride(s, 's2', 'date', '2026-01-02'), 's2').overrides).toEqual({});
  });
});

describe('row tap intent', () => {
  it('toggles rows that already do something', () => {
    expect(tapIntent(row({ action: 'create', selected: true }))).toEqual({ kind: 'toggle', selected: false });
  });
  it('picks the only real action for a skipped row', () => {
    expect(tapIntent(row({ action: 'skip', allowedActions: ['skip', 'update'] }))).toEqual({ kind: 'action', action: 'update' });
  });
  it('asks the user to decide when several actions are possible (possible duplicates)', () => {
    expect(tapIntent(row({ action: 'skip', allowedActions: ['skip', 'link', 'create'] }))).toEqual({ kind: 'decide' });
  });
});

it('counts start-only sessions', () => {
  const a = mkSession({ date: '2026-09-01', timing: { state: 'start_only', start: '07:00', end: null, endDayOffset: 0, timeZone: 'Europe/Rome', declaredSec: null, durationSec: null, durationSource: null } });
  expect(startOnlyCount([a, mkSession({ date: '2026-09-02' })])).toBe(1);
});

describe('date ranges', () => {
  it('validates format and order', () => {
    expect(checkRange('2026-01-01', '2026-02-01')).toEqual({ ok: true, from: '2026-01-01', to: '2026-02-01' });
    expect(checkRange('2026-02-01', '2026-01-01').ok).toBe(false);
    expect(checkRange('2026-2-1', '2026-03-01').ok).toBe(false);
    expect(checkRange('2026-10-01', '2026-10-12', '2026-10-11').ok).toBe(false); // no future sessions from an import
    expect(checkRange('2026-10-01', '2026-10-11', '2026-10-11').ok).toBe(true);
  });
  it('presets end today and clamp month ends', () => {
    expect(presetRange('3m', '2026-05-31')).toEqual({ from: '2026-03-01', to: '2026-05-31' });
    expect(presetRange('1y', '2026-10-11')).toEqual({ from: '2025-10-12', to: '2026-10-11' });
    expect(presetRange('5y', '2024-02-29')).toEqual({ from: '2019-03-01', to: '2024-02-29' });
  });
});
