import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { calendarDaysApi } from '@/api/calendar-days.api';
import { retryTransientErrors } from '@/lib/query-client';
import type { CalendarDaysQuery } from '@/types/calendar-days.types';

/**
 * Under the key of the calendar views of the bookings (`['bookings', 'calendar', ...]`), so that whatever already refreshes those (a block, a feed that
 * syncs, a change of mode, and now a change of price or rules) refreshes the days too.
 */
export const CALENDAR_DAYS_KEY = ['bookings', 'calendar', 'days'] as const;

interface CalendarDaysOptions {
  /** `false` reads nothing: the days need `property.read`, and a read the caller may not make is never sent. */
  enabled?: boolean;
}

/**
 * The price and the rules of every night in a range, for the properties the caller reaches (E08/F05/US01/T02). The previous range stays on screen while the next one
 * loads. Other screens change what it holds (a block, a booking, a change made in the panel), and the client does not read an unobserved query again by default
 * (`refetchOnMount: false`), so it is read again whenever the calendar is shown.
 */
export function useCalendarDays(query: CalendarDaysQuery | undefined, options: CalendarDaysOptions = {}) {
  return useQuery({
    queryKey: [...CALENDAR_DAYS_KEY, query],
    queryFn: () => calendarDaysApi.getDays(query!),
    enabled: !!query && (options.enabled ?? true),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    retry: retryTransientErrors(1),
    refetchOnMount: 'always',
  });
}
