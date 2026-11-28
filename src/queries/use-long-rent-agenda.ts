import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { longRentAgendaApi } from '@/api/long-rent-agenda.api';
import type { LongRentDeadlinesParams } from '@/types';

const LONG_RENT_OVERVIEW_KEY = 'long-rent-overview';
const LONG_RENT_DEADLINES_KEY = 'long-rent-deadlines';

export function useLongRentOverview() {
  return useQuery({
    queryKey: [LONG_RENT_OVERVIEW_KEY],
    queryFn: () => longRentAgendaApi.getOverview(),
    refetchOnMount: 'always',
  });
}

export function useLongRentDeadlines(params: LongRentDeadlinesParams, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [LONG_RENT_DEADLINES_KEY, params],
    queryFn: () => longRentAgendaApi.getDeadlines(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    enabled: options.enabled,
  });
}
