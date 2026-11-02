import { useCallback, useEffect, useRef, useState } from 'react';
import { clearBookingDraft, startingDraft, writeBookingDraft } from '@/lib/supplier-site/booking-draft';
import type { BookingDraft } from '@/lib/supplier-site/booking-flow';

/**
 * The draft of the booking in the page: it starts from the address (the cards and the finder of the site pass what they know) over
 * what the device remembered of this supplier, writes itself back at every change, and can be dropped for good once the booking is sent.
 * Nothing in it is shared with another supplier's site, and the consent is not part of it (see `booking-draft.ts`).
 */
export function useBookingDraft(slug: string, seed: Partial<BookingDraft>) {
  const [draft, setDraft] = useState<BookingDraft>(() => startingDraft(slug, seed));
  const dropped = useRef(false);

  useEffect(() => {
    if (!dropped.current) writeBookingDraft(slug, draft);
  }, [slug, draft]);

  const update = useCallback((patch: Partial<BookingDraft>) => setDraft((current) => ({ ...current, ...patch })), []);

  const discard = useCallback(() => {
    dropped.current = true;
    clearBookingDraft(slug);
  }, [slug]);

  return { draft, update, discard };
}
