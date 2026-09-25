import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import type { DashboardPeriodSelection } from '@/types/dashboard.types';

const DASHBOARD_KEY = 'dashboard';

/**
 * KPIs of the host dashboard for a period (PC-16); the previous period stays on screen while the next one loads.
 * Read again at every visit: bookings and syncs change them, and no booking mutation invalidates this key.
 */
export function useDashboardKpis(selection: DashboardPeriodSelection) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'kpis', selection],
    queryFn: () => dashboardApi.getKpis(selection),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** State of the iCal import feeds of the host's properties (last sync, status, error), read at every visit. */
export function useDashboardIcalFeeds() {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'ical-feeds'],
    queryFn: () => dashboardApi.getIcalFeeds(),
    refetchOnMount: 'always',
  });
}
