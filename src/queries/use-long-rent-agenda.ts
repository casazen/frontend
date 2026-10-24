import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { longRentAgendaApi } from '@/api/long-rent-agenda.api';
import type { LongRentDeadlinesParams } from '@/types';

export const LONG_RENT_OVERVIEW_KEY = 'long-rent-overview';
export const LONG_RENT_DEADLINES_KEY = 'long-rent-deadlines';

/**
 * The overview of the long-term area (LR-05). Contracts, rents and the registrations change on other pages, and the overview is
 * the page the area opens on, so it is read again every time it opens (the client does not read a list again on its own).
 */
export function useLongRentOverview() {
  return useQuery({
    queryKey: [LONG_RENT_OVERVIEW_KEY],
    queryFn: () => longRentAgendaApi.getOverview(),
    refetchOnMount: 'always',
  });
}

/**
 * The dates of a window of the agenda (LR-05). The dates of the last window stay on the screen while a longer one comes, and
 * the agenda is read again every time a page opens it. `enabled`: not for a landlord with no lease, who has no dates to read.
 */
export function useLongRentDeadlines(params: LongRentDeadlinesParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [LONG_RENT_DEADLINES_KEY, params],
    queryFn: () => longRentAgendaApi.getDeadlines(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    enabled: options.enabled,
  });
}
