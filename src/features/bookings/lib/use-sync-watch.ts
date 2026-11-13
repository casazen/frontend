import { useCallback, useState } from 'react';
import type { BookingOctorateSync } from '@/types';
import { syncPollInterval } from './octorate-sync';

/**
 * What a page that waits for the channel manager needs to know when to ask the booking again (`syncPollInterval`): when it opened, and when the host last asked
 * for something to be sent. `ask` is called by the handler of the action (the save, the cancellation, "Retry now"); `interval` is for `useBooking`. `openedAt` tells
 * a booking read after the page opened from one it still holds from an earlier visit.
 */
export function useSyncWatch() {
  const [openedAt] = useState(() => Date.now());
  const [askedAt, setAskedAt] = useState<number | null>(null);

  const ask = useCallback(() => setAskedAt(Date.now()), []);
  const interval = (sync: BookingOctorateSync | null | undefined) => syncPollInterval(sync, { openedAt, askedAt });

  return { ask, interval, openedAt };
}
