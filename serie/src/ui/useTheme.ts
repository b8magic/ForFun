import { useMemo } from 'react';
import { useApp } from '@/state/store';
import { surfaceFor, type Surface, type ThemePref } from './theme';

export function useThemePref(): ThemePref {
  return useApp((s) => s.themePref);
}

export function useSurface(): Surface {
  return surfaceFor(useThemePref());
}

/** Keep each component's layout styles stable until its surface changes. */
export function useThemedStyles<T>(factory: (surface: Surface) => T): T {
  const surface = useSurface();
  return useMemo(() => factory(surface), [factory, surface]);
}
