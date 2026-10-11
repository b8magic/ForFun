import type { Session, Timing } from '@/domain/types';
import { DATE_ONLY } from '@/domain/timing';

let n = 0;
export function mkSession(p: Partial<Session> & { date: string }): Session {
  n++;
  return {
    id: p.id ?? `s${n}`,
    categoryId: p.categoryId ?? 'surf',
    date: p.date,
    timing: p.timing ?? ({ ...DATE_ONLY } as Timing),
    place: p.place ?? null,
    notes: p.notes ?? null,
    origin: p.origin ?? 'manual',
    saveRequestId: p.saveRequestId ?? null,
    createdAt: p.createdAt ?? `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}.000Z`,
    updatedAt: p.updatedAt ?? '2026-01-01T00:00:00.000Z',
  };
}
