import { useCallback, useMemo } from 'react';
import { todayInRome } from '@/lib/stay-dates';
import { useQueryWriter } from '../hooks/use-query-writer';
import { readStay, stayHref, writeStay, type StayLimits, type StayState } from './stay-state';

/**
 * The stay of the public site (dates, adults, children, pets) kept in the address (DB-20), made sound and ready to hand over.
 *
 * It is written with `replace`, so the Back button leaves the page and does not step through every date (`push: true` adds an
 * entry for a decisive change, as the search does). Quick successive edits (the arrival, the departure and the guests in the same
 * moment) all land: each one starts from the last query written, not from the last rendered (the race of the first calendar that
 * lost an edit). `linkTo(path)` is a link to another page of the site that carries the stay.
 */
export function useStayState(limits: Partial<Pick<StayLimits, 'maxGuests' | 'petsAllowed'>> & { today?: string } = {}) {
  const { searchParams, write } = useQueryWriter();
  const today = limits.today ?? todayInRome();
  const { maxGuests, petsAllowed } = limits;

  const { stay, problems } = useMemo(
    () => readStay(searchParams, { today, maxGuests, petsAllowed }),
    [searchParams, today, maxGuests, petsAllowed],
  );

  const setStay = useCallback(
    (patch: Partial<StayState>, options: { push?: boolean } = {}) =>
      write((current) => writeStay(current, patch), { replace: !options.push }),
    [write],
  );

  const clearDates = useCallback(() => setStay({ checkIn: '', checkOut: '' }), [setStay]);

  const linkTo = useCallback((path: string) => stayHref(path, stay), [stay]);

  return { stay, problems, guests: stay.adults + stay.children, setStay, clearDates, linkTo };
}
