import { useEffect, useState } from 'react';

/** The time now (ms), again every `intervalMs`: a countdown does not stay at "42 minutes" on a page that is left open. */
export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
