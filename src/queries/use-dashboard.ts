import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import type { DashboardOverviewQuery } from '@/types/dashboard.types';

const DASHBOARD_KEY = 'dashboard';

/**
 * The host's day (arrivals, departures, interventions, things to do), read again at every visit: bookings, check-ins and
 * the suppliers change it from other screens.
 */
export function useDashboardToday() {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'today'],
    queryFn: () => dashboardApi.getToday(),
    refetchOnMount: 'always',
  });
}

/** The numbers of the Home for a period and, optionally, one property; the previous ones stay on screen while the next load. */
export function useDashboardOverview(query: DashboardOverviewQuery) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'overview', query],
    queryFn: () => dashboardApi.getOverview(query),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** State of the iCal import feeds of the host's properties (last sync, status, error), read at every visit. */
export function useDashboardIcalFeeds(enabled = true) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'ical-feeds'],
    queryFn: () => dashboardApi.getIcalFeeds(),
    enabled,
    refetchOnMount: 'always',
  });
}

/** Reads the Home again (day, numbers, feeds): after an action taken on a row, which changes what the Home says. */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [DASHBOARD_KEY] });
  }, [queryClient]);
}
