import type { Place, Session } from '@/domain/types';
import { bulkTimingForDate, type BulkDetailsPatch } from '@/domain/bulkDetails';
import { DATE_ONLY } from '@/domain/timing';
import { compactPlace, samePlace } from './placeForm';
import { evaluateTiming, formFromTiming, type TimingForm } from './timingForm';

export type BulkField = 'notes' | 'place' | 'timing';
export type BulkOperation = 'keep' | 'set' | 'clear';
export type BulkOperations = Record<BulkField, BulkOperation>;
export const KEEP_DETAILS: BulkOperations = { notes: 'keep', place: 'keep', timing: 'keep' };

export interface BulkForm {
  operations: BulkOperations;
  notes: string;
  place: Place | null;
  timing: TimingForm;
}

/** Mixed values never prefill one session's details as though they were shared. */
export function commonDetails(sessions: readonly Session[], deviceZone: string) {
  const first = sessions[0];
  const timingKey = (session: Session) => JSON.stringify(formFromTiming(session.timing, deviceZone));
  const mixed = {
    notes: sessions.some((session) => session.notes !== first?.notes),
    place: sessions.some((session) => !samePlace(session.place, first?.place ?? null)),
    timing: first ? sessions.some((session) => timingKey(session) !== timingKey(first)) : false,
  };
  return {
    mixed,
    notes: mixed.notes ? '' : first?.notes ?? '',
    place: mixed.place ? null : first?.place ?? null,
    timing: formFromTiming(mixed.timing ? DATE_ONLY : first?.timing ?? DATE_ONLY, deviceZone),
  };
}

export function evaluateBulkDetails(sessions: readonly Session[], form: BulkForm, deviceZone: string) {
  const patch: BulkDetailsPatch = {};
  const errors: Partial<Record<BulkField, string>> = {};
  const badDates: string[] = [];
  const ambiguousDates: string[] = [];
  if (form.operations.notes === 'clear') patch.notes = null;
  if (form.operations.notes === 'set') {
    const notes = form.notes.trim();
    if (!notes) errors.notes = 'Scrivi una nota oppure scegli Rimuovi.';
    else patch.notes = notes;
  }
  if (form.operations.place === 'clear') patch.place = null;
  if (form.operations.place === 'set') {
    const place = compactPlace(form.place);
    if (!place) errors.place = 'Indica un luogo oppure scegli Rimuovi.';
    else patch.place = place;
  }
  if (form.operations.timing === 'clear') patch.timing = { ...DATE_ONLY };
  if (form.operations.timing === 'set') {
    for (const date of new Set(sessions.map((session) => session.date))) {
      const evaluated = evaluateTiming(date, form.timing, deviceZone);
      if (!evaluated.ok || !evaluated.timing || evaluated.timing.state === 'date_only') {
        errors.timing = 'Completa l’orario o la durata, oppure scegli Rimuovi.';
        badDates.push(date);
      } else if (!bulkTimingForDate(date, evaluated.timing)) {
        errors.timing = 'Questo orario non esiste in tutte le date selezionate.';
        badDates.push(date);
      } else {
        patch.timing ??= evaluated.timing;
        if (evaluated.note === 'ambiguous_time') ambiguousDates.push(date);
      }
    }
  }
  return { patch, errors, badDates, ambiguousDates, ok: sessions.length > 0 && !Object.keys(errors).length, dirty: Object.values(form.operations).some((operation) => operation !== 'keep') };
}
