import { useCallback, useEffect, useState } from 'react';
import type { CalendarProvider, Connection, ProviderKind } from '@/calendar/types';
import { getProviders } from '@/calendar/registry';
import { getRepositories } from '@/data/database';
import { runAutoExportNow } from '@/calendar/autoRuntime';

/** A (re)connection is the moment failed automatic exports for that provider can succeed: retry them now, not after their backoff. */
async function wakeFailedJobs(k: ProviderKind) {
  try {
    const repos = await getRepositories();
    const failed = (await repos.exportJobs.list(['failed'])).filter((j) => j.provider === k && j.kind === 'auto');
    for (const j of failed) await repos.exportJobs.update(j.id, { nextAttemptAt: null });
    if (failed.length) await runAutoExportNow();
  } catch {
    // best effort: the periodic run still retries them
  }
}

export interface ConnState {
  providers: Record<ProviderKind, CalendarProvider> | null;
  connections: Partial<Record<ProviderKind, Connection>>;
  busy: ProviderKind | null;
  error: string | null;
}

/** Connection state of both providers, refreshed on demand. Never prompts by itself. */
export function useConnections() {
  const [s, setS] = useState<ConnState>({ providers: null, connections: {}, busy: null, error: null });
  const refresh = useCallback(async () => {
    try {
      const providers = await getProviders();
      const entries = await Promise.all((Object.keys(providers) as ProviderKind[]).map(async (k) => [k, await providers[k].getConnection()] as const));
      setS((p) => ({ ...p, providers, connections: Object.fromEntries(entries), error: null }));
    } catch (e) {
      setS((p) => ({ ...p, error: e instanceof Error ? e.message : String(e) }));
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);
  const connect = useCallback(
    async (k: ProviderKind, access: 'read' | 'readwrite') => {
      const providers = s.providers ?? (await getProviders());
      setS((p) => ({ ...p, busy: k, error: null }));
      try {
        const c = await providers[k].connect(access);
        setS((p) => ({ ...p, busy: null, connections: { ...p.connections, [k]: c } }));
        if (c.status === 'connected' || c.status === 'write_only') void wakeFailedJobs(k);
        return c;
      } catch (e) {
        setS((p) => ({ ...p, busy: null, error: e instanceof Error ? e.message : String(e) }));
        return null;
      }
    },
    [s.providers],
  );
  const disconnect = useCallback(
    async (k: ProviderKind) => {
      const providers = s.providers ?? (await getProviders());
      setS((p) => ({ ...p, busy: k }));
      try {
        await providers[k].disconnect();
      } finally {
        const c = await providers[k].getConnection();
        setS((p) => ({ ...p, busy: null, connections: { ...p.connections, [k]: c } }));
      }
    },
    [s.providers],
  );
  return { ...s, refresh, connect, disconnect };
}
