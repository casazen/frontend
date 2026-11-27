import { useCallback, useEffect, useState } from 'react';
import type { BookingOctorateSync } from '@/types';
import { syncPollInterval, syncWaitEndsAt } from './octorate-sync';

/**
 * What a page that waits for the channel manager needs to know when to ask the booking again (`syncPollInterval`): when it opened, and when the host last asked
 * for something to be sent. `ask` is called by the handler of the action (the save, the cancellation, "Retry now", "Check again"); `interval` is for `useBooking`.
 * `openedAt` tells a booking read after the page opened from one it still holds from an earlier visit. `waitOver` says that the page has stopped waiting for a push
 * that is still `Pending` (`SYNC_PENDING_LIMIT_MS`): it turns true by a timer, so the page is drawn again at that moment, and false again when the host asks once more.
 */
export function useSyncWatch() {
  const [openedAt] = useState(() => Date.now());
  const [askedAt, setAskedAt] = useState<number | null>(null);
  // The time the wait was last found over: it moves only when the timer below fires, never during a render.
  const [overAt, setOverAt] = useState(openedAt);
  const endsAt = syncWaitEndsAt({ openedAt, askedAt });

  useEffect(() => {
    // A little after the end, so that the clock is never found a few milliseconds short of it.
    const timer = setTimeout(() => setOverAt(Date.now()), Math.max(endsAt - Date.now(), 0) + 50);
    return () => clearTimeout(timer);
  }, [endsAt]);

  const ask = useCallback(() => setAskedAt(Date.now()), []);
  const interval = (sync: BookingOctorateSync | null | undefined) => syncPollInterval(sync, { openedAt, askedAt });

  return { ask, interval, openedAt, waitOver: overAt >= endsAt };
}
