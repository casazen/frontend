import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  mergeBookingSearchParams,
  parseBookingSearchParams,
  type BookingSearchParams,
} from '@/lib/booking-url';

export type { BookingSearchParams };

interface WrittenQuery {
  /** Last query written, rendered or not. */
  latest: URLSearchParams;
  /** Queries written and not rendered yet, oldest first. */
  pending: string[];
}

/** Stay selected on the public site (dates and guests), kept in the URL query. */
export function useBookingSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  // The router renders navigations in a transition: quick successive edits (check-in, check-out,
  // guests) must build on the last query written, not on the last one rendered, or an edit is lost.
  const written = useRef<WrittenQuery>({ latest: searchParams, pending: [] });

  useEffect(() => {
    const state = written.current;
    const index = state.pending.indexOf(searchParams.toString());
    if (index >= 0) {
      // One of our writes is now rendered; the later ones are still on their way.
      state.pending = state.pending.slice(index + 1);
      if (state.pending.length > 0) return;
    } else {
      // Navigation from elsewhere (link, back button): it becomes the base of the next edit.
      state.pending = [];
    }
    state.latest = searchParams;
  }, [searchParams]);

  const params = useMemo(() => parseBookingSearchParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (next: Partial<BookingSearchParams>) => {
      const state = written.current;
      const updated = mergeBookingSearchParams(state.latest, next);
      const query = updated.toString();
      state.latest = updated;
      if (state.pending[state.pending.length - 1] !== query) state.pending.push(query);
      setSearchParams(updated, { replace: true });
    },
    [setSearchParams],
  );

  return { params, setParams };
}
