import { useCallback, useEffect, useRef, useState } from 'react';

export interface LiveQuery<T> {
  /** Most recent successful payload (kept across transient errors). */
  data: T | null;
  /** Last error, cleared on the next success. */
  error: Error | null;
  /** True until the first response (success or error) arrives. */
  loading: boolean;
  /** Trigger an immediate out-of-band refresh. */
  refresh: () => void;
}

/**
 * Poll `fetcher` every `intervalMs` and expose the latest result. The default
 * live-data transport for service dashboards (robust through the Caddy gateway;
 * no streaming infra). Overlapping requests are suppressed, the last good value
 * survives transient errors, and the timer is cleaned up on unmount.
 *
 * `deps` re-arms the poller when inputs change (e.g. a selected window/range).
 */
export function useLiveQuery<T>(fetcher: () => Promise<T>, intervalMs = 2000, deps: unknown[] = []): LiveQuery<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);

  // Keep the latest fetcher without re-arming the interval on every render.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const inFlight = useRef(false);
  const wantRerun = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) {
      // Coalesce: an explicit refresh() during a poll re-runs once it finishes.
      wantRerun.current = true;
      return;
    }
    inFlight.current = true;
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
      inFlight.current = false;
      if (wantRerun.current) {
        wantRerun.current = false;
        void run();
      }
    }
  }, []);

  const [forced, setForced] = useState(0);
  const refresh = useCallback(() => setForced((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void run();
    const id = setInterval(() => {
      if (active) void run();
    }, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, intervalMs, forced, ...deps]);

  return { data, error, loading, refresh };
}
