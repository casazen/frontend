import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  mergeBookingSearchParams,
  parseBookingSearchParams,
  type BookingSearchParams,
} from '@/lib/booking-url';

export type { BookingSearchParams };

/** Stay selected on the public site (dates and guests), kept in the URL query. */
export function useBookingSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => parseBookingSearchParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (next: Partial<BookingSearchParams>) => {
      setSearchParams((current) => mergeBookingSearchParams(current, next), { replace: true });
    },
    [setSearchParams],
  );

  return { params, setParams };
}
