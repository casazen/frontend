import { useEffect, useMemo, useState } from 'react';

export function useNow(intervalMs: number = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export function useNowDate(intervalMs: number = 60_000): Date {
  const now = useNow(intervalMs);
  return useMemo(() => new Date(now), [now]);
}
