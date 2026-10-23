import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { calendarApi } from '@/api/calendar.api';
import { retryTransientErrors } from '@/lib/query-client';
import type { HostCalendarQuery } from '@/types/host-calendar.types';

/**
 * Under the key of the calendar views of the bookings, so that whatever already refreshes those (a block, a feed that syncs,
 * a change of mode) refreshes this one too; a booking written anywhere refreshes the whole `bookings` family.
 */
const HOST_CALENDAR_KEY = ['bookings', 'calendar', 'host'] as const;

interface HostCalendarOptions {
  /**
   * `always` (the default): the calendar is read again each time the page is shown, because bookings, blocks and interventions
   * change on other screens where it is not watched. A drawer that reads the same query passes `false`: it opens over a page
   * that has just read it.
   */
  refetchOnMount?: boolean | 'always';
}

/**
 * The Timeline of the host calendar: every short-rent property (or one) and what has a day in the range. The previous range stays
 * on screen while the next one loads, so that moving the window does not blink.
 */
export function useHostCalendar(query: HostCalendarQuery | undefined, options: HostCalendarOptions = {}) {
  return useQuery({
    queryKey: [...HOST_CALENDAR_KEY, query],
    queryFn: () => calendarApi.getHostCalendar(query!),
    enabled: !!query,
    placeholderData: keepPreviousData,
    retry: retryTransientErrors(1),
    refetchOnMount: options.refetchOnMount ?? 'always',
  });
}
