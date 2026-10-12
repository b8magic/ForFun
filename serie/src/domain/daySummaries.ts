import type { Category, DurationSummary, ID, LocalDate, PatternKind, Session } from './types';

export interface DayCategorySummary {
  categoryId: ID;
  color: string;
  pattern: PatternKind;
  count: number;
  sessionIds: ID[];
  duration: DurationSummary;
}

export interface DaySummary {
  date: LocalDate;
  count: number;
  sessionIds: ID[];
  duration: DurationSummary;
  categories: DayCategorySummary[];
}

const emptyDuration = (): DurationSummary => ({ knownSec: 0, knownCount: 0, totalCount: 0 });

function addDuration(summary: DurationSummary, session: Session) {
  summary.totalCount++;
  const duration = session.timing.durationSec;
  if (duration != null && Number.isFinite(duration) && duration > 0) {
    summary.knownSec += duration;
    summary.knownCount++;
  }
}

/** Shared calendar/day-sheet data. Activity focus never changes its ordering or geometry. */
export function buildDaySummaries(sessions: readonly Session[], categories: readonly Category[]): Map<LocalDate, DaySummary> {
  const ordered = [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const categoryById = new Map(ordered.map((category, index) => [category.id, { category, index }]));
  const days = new Map<LocalDate, { day: DaySummary; byCategory: Map<ID, DayCategorySummary> }>();
  // Stable identities prevent marker order from depending on query/insertion order.
  const orderedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  for (const session of orderedSessions) {
    const metadata = categoryById.get(session.categoryId);
    if (!metadata) continue; // Foreign keys normally make an orphan impossible.
    let entry = days.get(session.date);
    if (!entry) {
      entry = { day: { date: session.date, count: 0, sessionIds: [], duration: emptyDuration(), categories: [] }, byCategory: new Map() };
      days.set(session.date, entry);
    }
    let category = entry.byCategory.get(session.categoryId);
    if (!category) {
      category = { categoryId: session.categoryId, color: metadata.category.color, pattern: metadata.category.pattern, count: 0, sessionIds: [], duration: emptyDuration() };
      entry.byCategory.set(session.categoryId, category);
      entry.day.categories.push(category);
    }
    entry.day.count++;
    entry.day.sessionIds.push(session.id);
    addDuration(entry.day.duration, session);
    category.count++;
    category.sessionIds.push(session.id);
    addDuration(category.duration, session);
  }
  const result = new Map<LocalDate, DaySummary>();
  for (const [date, { day }] of days) {
    day.categories.sort((a, b) => categoryById.get(a.categoryId)!.index - categoryById.get(b.categoryId)!.index);
    result.set(date, day);
  }
  return result;
}
