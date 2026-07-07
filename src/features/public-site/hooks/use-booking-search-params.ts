import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface BookingSearchParams {
  checkIn: string;
  checkOut: string;
  guests: number;
}

const GUESTS_DEFAULT = 2;

export function useBookingSearchParams() {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo<BookingSearchParams>(() => ({
    checkIn: searchParams.get('checkIn') ?? '',
    checkOut: searchParams.get('checkOut') ?? '',
    guests: Math.max(1, parseInt(searchParams.get('guests') ?? String(GUESTS_DEFAULT), 10) || GUESTS_DEFAULT),
  }), [searchParams]);

  const setParams = useCallback(
    (next: Partial<BookingSearchParams>) => {
      const updated = new URLSearchParams(searchParams);
      if (next.checkIn !== undefined) {
        if (next.checkIn) updated.set('checkIn', next.checkIn);
        else updated.delete('checkIn');
      }
      if (next.checkOut !== undefined) {
        if (next.checkOut) updated.set('checkOut', next.checkOut);
        else updated.delete('checkOut');
      }
      if (next.guests !== undefined) {
        updated.set('guests', String(Math.max(1, next.guests)));
      }
      setSearchParams(updated, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const toQueryString = useCallback(() => {
    const parts: string[] = [];
    if (params.checkIn) parts.push(`checkIn=${encodeURIComponent(params.checkIn)}`);
    if (params.checkOut) parts.push(`checkOut=${encodeURIComponent(params.checkOut)}`);
    if (params.guests !== GUESTS_DEFAULT) parts.push(`guests=${params.guests}`);
    return parts.length > 0 ? `?${parts.join('&')}` : '';
  }, [params]);

  return { params, setParams, toQueryString };
}
