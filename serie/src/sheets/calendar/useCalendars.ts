import { useEffect, useState } from 'react';
import type { Connection, ExternalCalendar, LabelOption, ProviderKind, CalendarProvider } from '@/calendar/types';
import { usable } from './parts';

/**
 * Calendars (and Google labels) of every provider that is usable for `need`.
 * Reads only after the user connected; never prompts by itself.
 */
export function useCalendars(providers: Record<ProviderKind, CalendarProvider> | null, connections: Partial<Record<ProviderKind, Connection>>, need: 'read' | 'write') {
  const [calendars, setCalendars] = useState<Partial<Record<ProviderKind, ExternalCalendar[]>>>({});
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [errors, setErrors] = useState<Partial<Record<ProviderKind, string>>>({});
  const key = (['google', 'apple'] as ProviderKind[]).map((k) => `${k}:${connections[k]?.status}:${connections[k]?.accountId}`).join('|');
  useEffect(() => {
    if (!providers) return;
    let live = true;
    (async () => {
      const next: Partial<Record<ProviderKind, ExternalCalendar[]>> = {};
      const errs: Partial<Record<ProviderKind, string>> = {};
      for (const k of ['google', 'apple'] as ProviderKind[]) {
        if (!usable(connections[k], need)) continue;
        try {
          next[k] = await providers[k].listCalendars();
          if (k === 'google' && providers[k].capabilities.eventLabels) {
            const l = await providers[k].listLabels().catch(() => []);
            if (live) setLabels(l);
          }
        } catch (e) {
          errs[k] = e instanceof Error ? e.message : String(e);
        }
      }
      if (!live) return;
      setCalendars(next);
      setErrors(errs);
    })();
    return () => {
      live = false;
    };
  }, [providers, key, need]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = [...(calendars.google ?? []), ...(calendars.apple ?? [])];
  return { calendars, all, labels, errors };
}
