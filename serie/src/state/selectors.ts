import { useMemo } from 'react';
import { useApp } from './store';
import type { Category, Session } from '@/domain/types';

export function useActive(): Category | null {
  const categories = useApp((s) => s.categories);
  const activeId = useApp((s) => s.activeId);
  return useMemo(() => categories.find((c) => c.id === activeId) ?? null, [categories, activeId]);
}

export function useSessionsFor(categoryId: string | null): Session[] {
  const sessions = useApp((s) => s.sessions);
  return useMemo(() => (categoryId ? sessions.filter((s) => s.categoryId === categoryId) : sessions), [sessions, categoryId]);
}

/** Per-date session counts for one activity. */
export function useCountsByDate(categoryId: string | null): Map<string, number> {
  const list = useSessionsFor(categoryId);
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const s of list) m.set(s.date, (m.get(s.date) ?? 0) + 1);
    return m;
  }, [list]);
}

/** Reduced motion: system setting unless overridden in Impostazioni. */
export function useMotionReduced(): boolean {
  const pref = useApp((s) => s.motionPref);
  // the live system setting (Reanimated's useReducedMotion only reads it once, at launch)
  const system = useApp((s) => s.systemReducedMotion);
  return pref === 'reduced' ? true : pref === 'full' ? false : system;
}
