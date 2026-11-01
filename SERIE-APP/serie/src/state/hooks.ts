/**
 * Post-commit hooks. The calendar module registers its automatic-export
 * enqueue here; failures are contained and never affect the local save.
 */
import type { Session } from '@/domain/types';

type Hook = (sessions: Session[]) => Promise<void>;
const hooks: Hook[] = [];

export function onCommit(h: Hook) {
  hooks.push(h);
  return () => {
    const i = hooks.indexOf(h);
    if (i >= 0) hooks.splice(i, 1);
  };
}

export async function afterCommit(sessions: Session[]) {
  for (const h of hooks) {
    try {
      await h(sessions);
    } catch (e) {
      console.warn('post-commit hook failed', e);
    }
  }
}
