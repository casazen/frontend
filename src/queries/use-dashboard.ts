import { useCallback } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardApi } from '@/api/dashboard.api';
import type { DashboardOverviewQuery } from '@/types/dashboard.types';

export const DASHBOARD_KEY = 'dashboard';

export function useDashboardToday(enabled = true) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'today'],
    queryFn: () => dashboardApi.getToday(),
    enabled,
    refetchOnMount: 'always',
  });
}

export function useDashboardOverview(query: DashboardOverviewQuery, enabled = true) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'overview', query],
    queryFn: () => dashboardApi.getOverview(query),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useDashboardIcalFeeds(enabled = true) {
  return useQuery({
    queryKey: [DASHBOARD_KEY, 'ical-feeds'],
    queryFn: () => dashboardApi.getIcalFeeds(),
    enabled,
    refetchOnMount: 'always',
  });
}

export function useRefreshDashboard() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [DASHBOARD_KEY] });
  }, [queryClient]);
}
