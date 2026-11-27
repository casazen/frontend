import { useCallback, useMemo } from 'react';
import {
  mergeBookingSearchParams,
  parseBookingSearchParams,
  type BookingSearchParams,
} from '@/lib/booking-url';
import { useQueryWriter } from './use-query-writer';

export type { BookingSearchParams };

export function useBookingSearchParams() {
  const { searchParams, write } = useQueryWriter();

  const params = useMemo(() => parseBookingSearchParams(searchParams), [searchParams]);

  const setParams = useCallback(
    (next: Partial<BookingSearchParams>) => write((current) => mergeBookingSearchParams(current, next)),
    [write],
  );

  return { params, setParams };
}
