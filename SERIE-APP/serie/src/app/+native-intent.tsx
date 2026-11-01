/**
 * System links into Serie.
 *  - `serie://export?m=…` is the metadata link Serie writes into the events it exports to
 *    iPhone calendars. Tapping it in Calendario opens that session when it still exists,
 *    otherwise the Lineup (never an unmatched-route screen).
 *  - OAuth redirects are consumed by the auth session and never navigate.
 */
import { metaFromUrl } from '@/calendar/apple/meta';
import { getRepositories } from '@/data/database';

export async function redirectSystemPath({ path }: { path: string; initial: boolean }): Promise<string | null> {
  try {
    if (/oauthredirect/i.test(path)) return null;
    if (/^(serie:\/\/)?\/?export\b/i.test(path)) {
      const meta = metaFromUrl(path.startsWith('serie://') ? path : `serie://${path.replace(/^\//, '')}`);
      if (meta) {
        const repos = await getRepositories();
        if (await repos.sessions.get(meta.sessionId)) return `/session/${meta.sessionId}`;
      }
      return '/';
    }
    return path;
  } catch {
    return '/';
  }
}
