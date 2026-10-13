import { EARLIEST_DATE, isLocalDate } from '@/domain/dates';
import type { Category, NamedPeriod, NamedPeriodInput, NamedPeriodPatch, Session } from '@/domain/types';
import { compareSessions } from '@/sheets/day/sessionOrder';

export interface PeriodDraft {
  name: string;
  startDate: string;
  endDate: string;
  scope: 'all' | 'selected';
  categoryIds: string[];
  note: string;
}

export function draftForPeriod(period: NamedPeriod): PeriodDraft {
  return {
    name: period.name,
    startDate: period.startDate,
    endDate: period.endDate,
    scope: period.scope,
    categoryIds: period.categoryIds.slice(),
    note: period.note ?? '',
  };
}

export function samePeriodDraft(a: PeriodDraft, b: PeriodDraft): boolean {
  return a.name === b.name
    && a.startDate === b.startDate
    && a.endDate === b.endDate
    && a.scope === b.scope
    && a.note === b.note
    && (a.scope === 'all' || a.categoryIds.slice().sort().join('\n') === b.categoryIds.slice().sort().join('\n'));
}

/** Validate a view interval independently of the restrictions on session logging. */
export function evaluatePeriodDraft(draft: PeriodDraft, categories: readonly Category[], existing?: NamedPeriod) {
  const name = draft.name.trim();
  const startDate = draft.startDate.trim();
  const endDate = draft.endDate.trim();
  const available = new Set(categories.map((c) => c.id));
  const categoryIds = draft.scope === 'all' ? [] : [...new Set(draft.categoryIds.filter((id) => available.has(id)))];
  // Deleting an activity can leave a saved view empty. Metadata edits must keep
  // that empty view editable without changing its activity membership.
  const preservesEmptySelection = !!existing
    && existing.scope === 'selected'
    && draft.scope === 'selected'
    && categoryIds.length === 0
    && [...new Set(draft.categoryIds)].sort().join('\n') === [...new Set(existing.categoryIds)].sort().join('\n');
  const errors = {
    name: !name ? 'Scrivi un nome per il periodo.' : name.length > 80 ? 'Il nome può avere al massimo 80 caratteri.' : null,
    startDate: !isLocalDate(startDate) ? 'Usa una data valida: AAAA-MM-GG.' : startDate < EARLIEST_DATE ? 'La data deve essere dal 1900 in poi.' : null,
    endDate: !isLocalDate(endDate) ? 'Usa una data valida: AAAA-MM-GG.' : endDate < EARLIEST_DATE ? 'La data deve essere dal 1900 in poi.' : null,
    scope: draft.scope === 'selected' && !categoryIds.length && !preservesEmptySelection ? 'Scegli almeno un’attività, oppure tutte le attività.' : null,
  };
  if (!errors.startDate && !errors.endDate && endDate < startDate) errors.endDate = 'La fine non può precedere l’inizio.';
  const intervalValid = !errors.startDate && !errors.endDate && !errors.scope;
  const input: NamedPeriodInput = { name, startDate, endDate, scope: draft.scope, categoryIds, note: draft.note.trim() || null };
  const patch: NamedPeriodPatch = preservesEmptySelection
    ? { name, startDate, endDate, note: input.note }
    : input;
  const preview: NamedPeriod | null = intervalValid ? { ...input, categoryIds, note: input.note ?? null, id: 'preview', createdAt: '', updatedAt: '' } : null;
  return { errors, valid: intervalValid && !errors.name, input, patch, preview, preservesEmptySelection };
}

export function groupPeriodSessions(sessions: readonly Session[]): [string, Session[]][] {
  const groups = new Map<string, Session[]>();
  for (const session of sessions.slice().sort(compareSessions)) {
    const day = groups.get(session.date);
    if (day) day.push(session);
    else groups.set(session.date, [session]);
  }
  return [...groups];
}

export function activityScopeLabel(period: Pick<NamedPeriod, 'scope' | 'categoryIds'>, categories: readonly Category[]): string {
  if (period.scope === 'all') return 'Tutte le attività';
  const ids = new Set(period.categoryIds);
  const names = categories.filter((c) => ids.has(c.id)).map((c) => c.name);
  return names.length ? names.join(' · ') : 'Nessuna attività disponibile';
}
