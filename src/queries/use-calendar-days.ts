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
  enabled?: boolean;
}

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
