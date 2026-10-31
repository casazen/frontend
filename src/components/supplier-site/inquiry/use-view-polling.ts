import { useEffect, useRef } from 'react';

interface ViewPollingOptions {
  /** Nothing is asked while this is false. */
  enabled: boolean;
  /** The wait between two readings while things change. */
  baseMs: number;
  /** The most the wait grows to while nothing changes (it doubles twice). */
  maxMs: number;
  /** One reading. Gives what it saw (a string that is the same while nothing changes), or null when it asked nothing or failed. */
  tick: () => Promise<string | null>;
}

/** A tab that comes back to the front asks at once, but not twice in this many milliseconds. */
const MIN_GAP_MS = 5_000;

/**
 * Reads again, by itself, what a conversation shows (SP-12c): every `baseMs` while the tab is in front, and less often (the wait doubles
 * twice, up to `maxMs`) while the readings are all the same; it starts from the beginning when something changes. A tab in the background
 * asks **nothing**: the timer keeps ticking, but a tick that finds the page hidden does no request, and the tab asks at once when it is
 * back in front. The latest `tick` is always the one called, so the page may pass a new function at every render without restarting
 * the clock.
 */
export function useViewPolling({ enabled, baseMs, maxMs, tick }: ViewPollingOptions) {
  const latest = useRef(tick);
  useEffect(() => {
    latest.current = tick;
  });

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let timer: number | undefined;
    let unchanged = 0;
    let last: string | null = null;
    let lastAt = 0;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void read(), Math.min(baseMs * 2 ** Math.min(unchanged, 2), maxMs));
    };

    const read = async () => {
      if (stopped) return;
      if (document.visibilityState !== 'visible') {
        schedule();
        return;
      }
      lastAt = Date.now();
      const seen = await latest.current().catch(() => null);
      if (stopped) return;
      if (seen !== null) {
        unchanged = seen === last ? unchanged + 1 : 0;
        last = seen;
      }
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAt >= MIN_GAP_MS) void read();
    };

    document.addEventListener('visibilitychange', onVisible);
    schedule();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, baseMs, maxMs]);
}
