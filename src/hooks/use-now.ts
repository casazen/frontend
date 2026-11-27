import { useEffect, useMemo, useState } from 'react';

/** The time now (ms), again every `intervalMs`: a countdown does not stay at "42 minutes" on a page that is left open. */
export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** `useNow` as a `Date`, the same object between two ticks and a new one at each tick: "3 minutes ago" does not stay "now" on a page or in a drawer that is left open. */
export function useNowDate(intervalMs: number = 60_000): Date {
  const now = useNow(intervalMs);
  return useMemo(() => new Date(now), [now]);
}
