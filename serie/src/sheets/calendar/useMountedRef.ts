import { useEffect, useRef } from 'react';

/**
 * True while the component is mounted. For async loads started by an effect that re-runs before
 * they finish (often because the load itself set state the effect depends on): a per-run "live"
 * flag would drop the result, and a once-only guard would then never load again. Native providers
 * answer later than a microtask (EventKit, the network), which is exactly when that bites.
 */
export function useMountedRef() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return mounted;
}
