import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { dataVersion } from '@/src/services/dataVersion';

/** A screen that fetched this recently, with nothing written since, does not fetch again on focus. */
export const STALE_MS = 60_000;

/**
 * `useFocusEffect` for data loads (W3-03). The loader runs on focus only when it has never run,
 * when something was written through `dataService` since it last ran, or when the last run is
 * older than `staleMs`. Every focus used to refetch: switching tabs was 4–5 requests each way,
 * and the 24-hour cache never saved a call because it was read-through.
 *
 * `refresh()` bypasses all of that — it is what pull-to-refresh calls.
 */
export function useFocusRefresh(load: () => void | Promise<unknown>, staleMs = STALE_MS) {
  const lastRun     = useRef(0);
  const lastVersion = useRef(-1);

  const run = useCallback(() => {
    lastRun.current     = Date.now();
    lastVersion.current = dataVersion();
    return load();
  }, [load]);

  useFocusEffect(useCallback(() => {
    const fresh = Date.now() - lastRun.current < staleMs && lastVersion.current === dataVersion();
    if (!fresh) run();
  }, [run, staleMs]));

  return { refresh: run };
}
