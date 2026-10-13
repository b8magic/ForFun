import { summarize } from './stats';
import type { NamedPeriod, PeriodSummary, Session } from './types';

/** A period is a view: edits, imports and deletions are reflected immediately. */
export function sessionsForNamedPeriod(sessions: readonly Session[], period: NamedPeriod): Session[] {
  const selected = new Set(period.categoryIds);
  return sessions.filter((session) => session.date >= period.startDate && session.date <= period.endDate && (period.scope === 'all' || selected.has(session.categoryId)));
}

export function summarizeNamedPeriod(sessions: readonly Session[], period: NamedPeriod): PeriodSummary {
  return summarize(sessionsForNamedPeriod(sessions, period));
}
