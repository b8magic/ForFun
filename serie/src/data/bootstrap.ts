/**
 * First launch and every launch: seed starter activities once (never sessions),
 * then resolve the remembered activity without ever pointing at a missing id.
 */
import type { Category, ID, PatternKind } from '@/domain/types';
import type { Repositories } from './repositories';

export const STARTER_ACTIVITIES: { name: string; color: string; pattern: PatternKind }[] = [
  { name: 'Surf', color: '#FF4D1F', pattern: 'swell' },
  { name: 'Corsa', color: '#C9F06A', pattern: 'stride' },
  { name: 'Allenamento', color: '#B9A8FF', pattern: 'pulse' },
  { name: 'Viaggio', color: '#F3C46E', pattern: 'drift' },
];

export const KEYS = {
  seeded: 'seeded',
  lastActive: 'lastActiveCategoryId',
} as const;

export interface ActiveResolution {
  activeId: ID | null;
  /** True when the remembered activity no longer exists and another one was chosen. */
  changed: boolean;
}

export function resolveActive(categories: Category[], remembered: ID | null | undefined): ActiveResolution {
  // Explicit null is the user's all-activities viewing mode; missing preference
  // still chooses the first activity for an existing installation.
  if (remembered === null) return { activeId: null, changed: false };
  if (remembered && categories.some((c) => c.id === remembered)) return { activeId: remembered, changed: false };
  if (!categories.length) return { activeId: null, changed: remembered != null };
  return { activeId: categories[0].id, changed: remembered != null };
}

export async function bootstrap(repos: Repositories, options: { rememberResolution?: boolean } = {}): Promise<{ categories: Category[] } & ActiveResolution> {
  const seeded = await repos.settings.get<boolean>(KEYS.seeded, false);
  if (!seeded) {
    const existing = await repos.categories.list();
    if (!existing.length) {
      let surfId: string | null = null;
      for (const a of STARTER_ACTIVITIES) {
        const c = await repos.categories.create(a);
        if (a.name === 'Surf') surfId = c.id;
      }
      await repos.settings.set(KEYS.lastActive, surfId);
    }
    await repos.settings.set(KEYS.seeded, true);
  }
  const categories = await repos.categories.list();
  const remembered = await repos.settings.get<ID | null | undefined>(KEYS.lastActive, undefined);
  const r = resolveActive(categories, remembered);
  if (options.rememberResolution !== false && r.activeId !== remembered) await repos.settings.set(KEYS.lastActive, r.activeId);
  return { categories, ...r };
}
