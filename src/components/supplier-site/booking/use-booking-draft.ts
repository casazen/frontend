import { useCallback, useEffect, useRef, useState } from 'react';
import { clearBookingDraft, startingDraft, writeBookingDraft } from '@/lib/supplier-site/booking-draft';
import type { BookingDraft } from '@/lib/supplier-site/booking-flow';

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
