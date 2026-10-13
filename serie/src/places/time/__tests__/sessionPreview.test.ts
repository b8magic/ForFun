import { DATE_ONLY, buildTiming } from '@/domain/timing';
import type { Place, Session } from '@/domain/types';
import { compactDurationLine, durationLine, placeSummary, sessionPreview } from '../format';

const base: Session = {
  id: 'session', categoryId: 'surf', date: '2026-10-08', timing: DATE_ONLY,
  notes: null, place: null, origin: 'manual', saveRequestId: null,
  createdAt: '2026-10-08T12:00:00Z', updatedAt: '2026-10-08T12:00:00Z',
};
const place: Place = { label: null, address: null, mapUrl: null, coords: null, resolution: 'none', resolutionNote: null };

it('keeps complete inline totals compact and uses the canonical rounded duration', () => {
  expect(compactDurationLine({ knownSec: 5453, knownCount: 1, totalCount: 1 })).toBe('1 h 31 min');
  expect(compactDurationLine({ knownSec: 5400, knownCount: 2, totalCount: 2 })).toBe('1 h 30 min');
});

it('identifies partial and unknown inline durations without suggesting all sessions have a known duration', () => {
  const partial = { knownSec: 5400, knownCount: 1, totalCount: 3 };
  expect(compactDurationLine(partial)).toBe('1 h 30 min · 1 su 3 con durata');
  expect(durationLine(partial)).toBe('1 h 30 min di tempo registrato · durata disponibile per 1 di 3 sessioni');
  expect(compactDurationLine({ knownSec: 0, knownCount: 0, totalCount: 3 })).toBe('durata non indicata');
  expect(compactDurationLine({ knownSec: 0, knownCount: 0, totalCount: 0 })).toBe('');
});

it('does not turn a missing duration or place into an invented recorded value', () => {
  expect(sessionPreview(base)).toEqual({ timing: 'Solo data · durata non specificata', place: null, notes: null });
  const timing = buildTiming(base.date, { state: 'duration_only', declaredSec: 5400 });
  if (!timing.ok) throw new Error('invalid fixture');
  expect(sessionPreview({ ...base, timing: timing.timing }).timing).toBe('1 h 30 min · senza orario');
});

it('keeps a saved place visible independently of notes and duration, including map-only places', () => {
  expect(placeSummary({ ...place, label: '  La Fuente ', address: '  Via del mare 4 ' })).toBe('La Fuente · Via del mare 4');
  expect(placeSummary({ ...place, coords: { lat: 43, lng: 10 } })).toBe('Posizione salvata');
  expect(placeSummary({ ...place, mapUrl: 'https://maps.google.com/?q=La+Fuente' })).toBe('Link mappa salvato');
  expect(sessionPreview({ ...base, place: { ...place, label: 'La Fuente' }, notes: 'Onde pulite\nSeconda riga privata' })).toEqual({
    timing: 'Solo data · durata non specificata', place: 'La Fuente', notes: '“Onde pulite”',
  });
});

it.each(['\n', '\r\n', '\r'])('previews one bounded note line without changing the saved notes (%j)', (lineBreak) => {
  const notes = `  Prima riga ${lineBreak}Tutti gli altri dettagli restano nell’editor`;
  const session = { ...base, notes };
  expect(sessionPreview(session).notes).toBe('“Prima riga”');
  expect(session.notes).toBe(notes);
  expect(sessionPreview({ ...base, notes: ' \n ' }).notes).toBeNull();
  const long = sessionPreview({ ...base, notes: 'a'.repeat(500) }).notes!;
  expect(long).toHaveLength(162);
  expect(long.endsWith('…”')).toBe(true);
});
