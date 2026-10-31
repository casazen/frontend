import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  const timer = setInterval(onChange, 30_000);
  return () => clearInterval(timer);
}

const minuteNow = () => Math.floor(Date.now() / 60_000);

/**
 * The current minute (minutes since 1970), refreshed twice a minute: what a countdown that says "ancora 45 minuti" reads, so that the
 * figure moves on its own without a render per second. Pure for the page: it reads the clock only through the store.
 */
export function useMinuteClock(): number {
  return useSyncExternalStore(subscribe, minuteNow, minuteNow);
}
