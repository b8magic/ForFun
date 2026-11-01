import { monthGroups, yearGroups, monthIndex } from '@/domain/history';
import { frequency, weekStreaks, weeklyBuckets, monthlyBuckets, distribution, summarize } from '@/domain/stats';
import { computeMilestones } from '@/domain/milestones';
import { buildTiming } from '@/domain/timing';
import { mkSession } from '@/test/factories';
import type { Category } from '@/domain/types';

const labels = { first: 'Prima', sessions: (n: number) => `${n} sessioni`, hours: (n: number) => `${n} ore`, weeks: (n: number) => `${n} settimane` };

describe('history grouping', () => {
  const list = [mkSession({ date: '2026-07-02' }), mkSession({ date: '2026-10-10' }), mkSession({ date: '2026-10-10' }), mkSession({ date: '2026-10-03' })];
  it('lists every month newest first without compressing empty months', () => {
    const g = monthGroups(list, '2026-10-11');
    expect(g.map((x) => x.key)).toEqual(['2026-10', '2026-09', '2026-08', '2026-07']);
    expect(g[1].summary.sessions).toBe(0);
    expect(g[0].summary).toMatchObject({ sessions: 3, activeDays: 2 });
    expect(g[0].perDay[10]).toBe(2);
    expect(monthIndex(g, { y: 2026, m: 8 })).toBe(2);
  });
  it('marks future months of the current year as future, not zero', () => {
    const y = yearGroups(list, '2026-10-11');
    expect(y).toHaveLength(1);
    expect(y[0].months[10]).toMatchObject({ future: true });
    expect(y[0].months[9]).toMatchObject({ future: false });
    expect(y[0].summary.sessions).toBe(4);
  });
  it('spans multiple years', () => {
    const y = yearGroups([mkSession({ date: '2019-03-01' }), ...list], '2026-10-11');
    expect(y.map((g) => g.year)).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]);
    expect(y.find((g) => g.year === 2022)!.summary.sessions).toBe(0);
  });
});

describe('frequency & consistency', () => {
  it('counts weekly buckets including empty weeks', () => {
    const list = [mkSession({ date: '2026-10-05' }), mkSession({ date: '2026-10-06' }), mkSession({ date: '2026-09-21' })];
    const w = weeklyBuckets(list, '2026-10-11', 4);
    expect(w.map((b) => b.weekStart)).toEqual(['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
    expect(w.map((b) => b.sessions)).toEqual([0, 1, 0, 2]);
    // complete weeks only: the week of 2026-10-05 (Mon–Sun 10-11) is the current week and is excluded
    expect(frequency(list, '2026-10-11', 4).activeWeeks).toBe(1);
  });
  it('frequency uses complete weeks and complete months, and says which', () => {
    const list = ['2026-07-03', '2026-08-10', '2026-08-20', '2026-09-01', '2026-09-28', '2026-10-01', '2026-10-09'].map((d) => mkSession({ date: d }));
    const f = frequency(list, '2026-10-11', 4, 3);
    expect(f.weeksRange).toEqual({ from: '2026-09-07', to: '2026-10-04' });
    expect(f.perWeek).toBeCloseTo(2 / 4); // 09-28 and 10-01 (week of 09-28); 10-09 is in the current week
    expect(f.monthsRange).toEqual({ from: '2026-07-01', to: '2026-09-30' });
    expect(f.perMonth).toBeCloseTo(5 / 3); // July 1, August 2, September 2; October is in progress
  });
  it('computes week streaks', () => {
    const list = ['2026-09-07', '2026-09-14', '2026-09-21', '2026-10-05', '2026-10-06'].map((d) => mkSession({ date: d }));
    expect(weekStreaks(list, '2026-10-11')).toEqual({ longest: 3, current: 1 });
  });
  it('monthly buckets end with the current month', () => {
    const m = monthlyBuckets([mkSession({ date: '2026-10-01' })], '2026-10-11', 3);
    expect(m.map((b) => b.key)).toEqual(['2026-08', '2026-09', '2026-10']);
  });
  it('distribution shares and per-activity hours with coverage', () => {
    const cats: Category[] = [
      { id: 'surf', name: 'Surf', color: '#f00', pattern: 'swell', sortOrder: 0, createdAt: '', updatedAt: '' },
      { id: 'run', name: 'Corsa', color: '#0f0', pattern: 'stride', sortOrder: 1, createdAt: '', updatedAt: '' },
    ];
    const t = buildTiming('2026-10-01', { state: 'duration_only', declaredSec: 3600 });
    if (!t.ok) throw new Error();
    const list = [mkSession({ date: '2026-10-01', categoryId: 'surf', timing: t.timing }), mkSession({ date: '2026-10-02', categoryId: 'surf' }), mkSession({ date: '2026-10-02', categoryId: 'run' })];
    const d = distribution(list, cats);
    expect(d[0]).toMatchObject({ categoryId: 'surf', share: 2 / 3 });
    expect(d[0].summary.duration).toEqual({ knownSec: 3600, knownCount: 1, totalCount: 2 });
    expect(summarize(list).duration.knownCount).toBe(1);
  });
});

describe('milestones follow explicit rules', () => {
  it('reports thresholds reached by chronological order and known hours only', () => {
    const t = buildTiming('2026-01-01', { state: 'duration_only', declaredSec: 4 * 3600 });
    if (!t.ok) throw new Error();
    const list = Array.from({ length: 12 }, (_, i) => mkSession({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, timing: i < 3 ? t.timing : undefined }));
    const m = computeMilestones(list, labels);
    expect(m.find((x) => x.id === 'first')).toMatchObject({ reached: true, reachedOn: '2026-01-01' });
    expect(m.find((x) => x.id === 'sessions-10')).toMatchObject({ reached: true, reachedOn: '2026-01-10' });
    expect(m.find((x) => x.id === 'sessions-25')).toMatchObject({ reached: false, reachedOn: null });
    expect(m.find((x) => x.id === 'hours-10')).toMatchObject({ reached: true, reachedOn: '2026-01-03' }); // 3 × 4 h known
    expect(m.find((x) => x.id === 'hours-25')).toMatchObject({ reached: false });
  });
  it('an empty history reaches nothing', () => {
    expect(computeMilestones([], labels).every((m) => !m.reached)).toBe(true);
  });
});
