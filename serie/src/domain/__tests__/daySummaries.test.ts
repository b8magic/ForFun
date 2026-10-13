import { buildDaySummaries } from '@/domain/daySummaries';
import { buildTiming, DATE_ONLY } from '@/domain/timing';
import type { Category, Session, Timing } from '@/domain/types';

const categories: Category[] = [
  { id: 'z', name: 'Surf', color: '#FF4D1F', pattern: 'swell', sortOrder: 2, createdAt: 'a', updatedAt: 'a' },
  { id: 'b', name: 'Corsa', color: '#C9F06A', pattern: 'stride', sortOrder: 0, createdAt: 'a', updatedAt: 'a' },
  { id: 'a', name: 'Allenamento', color: '#B9A8FF', pattern: 'pulse', sortOrder: 0, createdAt: 'a', updatedAt: 'a' },
];
const session = (id: string, categoryId: string, date: string, timing: Timing = DATE_ONLY): Session => ({ id, categoryId, date, timing, notes: null, place: null, origin: 'manual', saveRequestId: null, createdAt: id, updatedAt: id });

it('has stable category/date ordering, exact counts and duration coverage across mixed activities', () => {
  const known = buildTiming('2026-10-02', { state: 'duration_only', declaredSec: 1800 });
  if (!known.ok) throw new Error('invalid fixture');
  const sessions = [session('4', 'z', '2026-10-02'), session('3', 'b', '2026-10-02', known.timing), session('2', 'a', '2026-10-02'), session('1', 'b', '2026-10-01'), session('5', 'b', '2026-10-02')];
  const summaries = buildDaySummaries(sessions, categories);
  expect([...summaries.keys()]).toEqual(['2026-10-01', '2026-10-02']);
  const day = summaries.get('2026-10-02')!;
  expect(day.count).toBe(4);
  expect(day.sessionIds).toEqual(['2', '3', '4', '5']);
  expect(day.duration).toEqual({ knownSec: 1800, knownCount: 1, totalCount: 4 });
  expect(day.categories.map((category) => category.categoryId)).toEqual(['a', 'b', 'z']);
  expect(day.categories[1]).toEqual({ categoryId: 'b', color: '#C9F06A', pattern: 'stride', count: 2, sessionIds: ['3', '5'], duration: { knownSec: 1800, knownCount: 1, totalCount: 2 } });
  expect(buildDaySummaries([...sessions].reverse(), [...categories].reverse())).toEqual(summaries);
  const recolored = buildDaySummaries(sessions, categories.map((category) => category.id === 'b' ? { ...category, color: '#123456' } : category));
  expect(recolored.get('2026-10-02')!.categories[1].color).toBe('#123456');
  expect(recolored.get('2026-10-02')!.categories.map((category) => category.categoryId)).toEqual(['a', 'b', 'z']);
});

it('attributes a next-day interval wholly to its recorded date and leaves unknown duration unknown', () => {
  const interval = buildTiming('2026-10-02', { state: 'interval', start: '23:00', end: '01:00', endDayOffset: 1, timeZone: 'Europe/Rome' });
  if (!interval.ok) throw new Error('invalid fixture');
  const summaries = buildDaySummaries([session('1', 'z', '2026-10-02', interval.timing), session('2', 'z', '2026-10-03')], categories);
  expect(summaries.get('2026-10-02')!.duration).toEqual({ knownSec: 7200, knownCount: 1, totalCount: 1 });
  expect(summaries.get('2026-10-03')!.duration).toEqual({ knownSec: 0, knownCount: 0, totalCount: 1 });
  expect(buildDaySummaries([], categories).size).toBe(0);
});
