import type { Category, NamedPeriod } from '@/domain/types';
import { sessionsForNamedPeriod } from '@/domain/namedPeriods';
import { mkSession } from '@/test/factories';
import { draftForPeriod, evaluatePeriodDraft, samePeriodDraft, type PeriodDraft } from '../model';

const categories = [{ id: 'surf' }, { id: 'run' }] as Category[];
const draft = (patch: Partial<PeriodDraft> = {}): PeriodDraft => ({ name: 'Autunno', startDate: '2026-09-20', endDate: '2026-10-12', scope: 'all', categoryIds: [], note: '', ...patch });
const storedPeriod = (patch: Partial<NamedPeriod> = {}): NamedPeriod => ({ id: 'period', name: 'Solo surf', startDate: '2026-09-20', endDate: '2026-10-12', scope: 'selected', categoryIds: [], note: null, createdAt: '2026-10-12T00:00:00.000Z', updatedAt: '2026-10-12T00:00:00.000Z', ...patch });

describe('personal period form', () => {
  it('accepts a single day, future intervals, duplicate names, and overlapping dates', () => {
    expect(evaluatePeriodDraft(draft({ startDate: '2026-10-12', endDate: '2026-10-12' }), categories).valid).toBe(true);
    expect(evaluatePeriodDraft(draft({ startDate: '2027-01-01', endDate: '2027-12-31' }), categories).valid).toBe(true);
    expect(evaluatePeriodDraft(draft(), categories).valid).toBe(true);
    expect(evaluatePeriodDraft(draft({ startDate: '2026-10-01' }), categories).valid).toBe(true);
  });

  it('rejects impossible, inverted, and unsupported early dates', () => {
    expect(evaluatePeriodDraft(draft({ startDate: '2026-02-29' }), categories).errors.startDate).toBeTruthy();
    expect(evaluatePeriodDraft(draft({ startDate: '2026-10-13' }), categories).errors.endDate).toBeTruthy();
    expect(evaluatePeriodDraft(draft({ startDate: '1899-12-31' }), categories).errors.startDate).toBeTruthy();
    expect(evaluatePeriodDraft(draft({ startDate: '2024-02-29' }), categories).valid).toBe(true);
  });

  it('requires a name within 80 characters while allowing a real preview before naming', () => {
    const unnamed = evaluatePeriodDraft(draft({ name: ' ' }), categories);
    expect(unnamed.valid).toBe(false);
    expect(unnamed.preview?.startDate).toBe('2026-09-20');
    expect(evaluatePeriodDraft(draft({ name: 'a'.repeat(80) }), categories).valid).toBe(true);
    expect(evaluatePeriodDraft(draft({ name: 'a'.repeat(81) }), categories).errors.name).toBeTruthy();
  });

  it('requires at least one surviving selected activity and never falls back to all', () => {
    const missing = evaluatePeriodDraft(draft({ scope: 'selected', categoryIds: ['deleted'] }), categories);
    expect(missing.valid).toBe(false);
    expect(missing.preview).toBeNull();
    const scoped = evaluatePeriodDraft(draft({ scope: 'selected', categoryIds: ['deleted', 'surf', 'surf'] }), categories);
    expect(scoped.valid).toBe(true);
    expect(scoped.input.categoryIds).toEqual(['surf']);
  });

  it('trims text and clears subset IDs when all activities are included', () => {
    const evaluated = evaluatePeriodDraft(draft({ name: '  Autunno  ', note: '  un ricordo  ', categoryIds: ['surf'] }), categories);
    expect(evaluated.input.name).toBe('Autunno');
    expect(evaluated.input.note).toBe('un ricordo');
    expect(evaluated.input.categoryIds).toEqual([]);
  });

  it('keeps a saved empty selection editable through metadata-only updates and a zero-session preview', () => {
    const period = storedPeriod();
    const evaluated = evaluatePeriodDraft({ ...draftForPeriod(period), name: 'Surf passato', note: 'Un ricordo', endDate: '2026-10-31' }, categories, period);
    expect(evaluated.valid).toBe(true);
    expect(evaluated.patch).toEqual({ name: 'Surf passato', startDate: '2026-09-20', endDate: '2026-10-31', note: 'Un ricordo' });
    expect(evaluated.patch).not.toHaveProperty('scope');
    expect(evaluated.patch).not.toHaveProperty('categoryIds');
    expect(evaluated.preview).toMatchObject({ scope: 'selected', categoryIds: [] });
    expect(sessionsForNamedPeriod([mkSession({ date: '2026-10-10', categoryId: 'run' })], evaluated.preview!)).toEqual([]);
  });

  it('also preserves an unchanged selection if its activity is deleted while the editor is open', () => {
    const period = storedPeriod({ categoryIds: ['deleted'] });
    const evaluated = evaluatePeriodDraft({ ...draftForPeriod(period), name: 'Rinominato' }, categories, period);
    expect(evaluated.valid).toBe(true);
    expect(evaluated.preview).toMatchObject({ scope: 'selected', categoryIds: [] });
    expect(evaluated.patch).not.toHaveProperty('categoryIds');
  });

  it('requires explicit activity selection for new periods and for cleared or changed membership', () => {
    const empty = draft({ scope: 'selected', categoryIds: [] });
    expect(evaluatePeriodDraft(empty, categories).valid).toBe(false);
    expect(evaluatePeriodDraft(empty, categories, storedPeriod({ categoryIds: ['surf'] })).valid).toBe(false);
    expect(evaluatePeriodDraft(empty, categories, storedPeriod({ scope: 'all' })).valid).toBe(false);
    const restored = evaluatePeriodDraft({ ...empty, categoryIds: ['run'] }, categories, storedPeriod());
    expect(restored.valid).toBe(true);
    expect(restored.patch).toMatchObject({ scope: 'selected', categoryIds: ['run'] });
  });

  it('recognizes a restored draft independently of activity selection order', () => {
    expect(samePeriodDraft(draft({ scope: 'selected', categoryIds: ['surf', 'run'] }), draft({ scope: 'selected', categoryIds: ['run', 'surf'] }))).toBe(true);
    expect(samePeriodDraft(draft(), draft({ name: 'Inverno' }))).toBe(false);
    expect(samePeriodDraft(draft(), draft({ note: 'Modifica' }))).toBe(false);
  });
});
