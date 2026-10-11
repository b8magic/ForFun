/**
 * Provider registry: one instance per provider for the app's lifetime.
 * Created lazily, only when the user opens a calendar feature (no permission
 * prompts or OAuth at launch).
 */
import type { CalendarProvider, ProviderKind } from './types';
import { getRepositories } from '@/data/database';
import { memoryCalendarEnabled } from './memory';

let cache: Promise<Record<ProviderKind, CalendarProvider>> | null = null;

export function getProviders(): Promise<Record<ProviderKind, CalendarProvider>> {
  if (!cache) {
    cache = (async () => {
      if (memoryCalendarEnabled()) {
        // automated UI verification build only (EXPO_PUBLIC_SERIE_E2E_CALENDAR=1)
        const { createMemoryProvider } = await import('./memory');
        return { google: createMemoryProvider('google'), apple: createMemoryProvider('apple') };
      }
      const repos = await getRepositories();
      // imported lazily so expo-auth-session / expo-calendar load only when needed
      const { createGoogleCalendarProvider } = await import('./google');
      const { createAppleCalendarProvider } = await import('./apple');
      return {
        google: createGoogleCalendarProvider(),
        apple: createAppleCalendarProvider({ settings: repos.settings }),
      };
    })();
    cache.catch(() => (cache = null));
  }
  return cache;
}

export const PROVIDER_ORDER: ProviderKind[] = ['google', 'apple'];
