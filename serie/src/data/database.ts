import { openDriver } from './openDriver';
import { migrate } from './migrations';
import { createRepositories, type Repositories } from './repositories';
import { newId, nowIso } from '@/platform/ids';

let ready: Promise<Repositories> | null = null;

/** Opens, migrates and returns the repositories (singleton). */
export function getRepositories(): Promise<Repositories> {
  if (!ready) {
    ready = (async () => {
      const db = await openDriver();
      await migrate(db);
      return createRepositories(db, { newId, now: nowIso });
    })();
    ready.catch(() => (ready = null));
  }
  return ready;
}
