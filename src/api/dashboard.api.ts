import { ApiClient } from './client';
import type { DashboardIcalFeed, DashboardOverview, DashboardOverviewQuery, DashboardToday } from '@/types/dashboard.types';

export function dashboardOverviewParams(query: DashboardOverviewQuery): Record<string, string> {
  const params: Record<string, string> = { period: query.period };
  if (query.period === 'Custom') {
    params.from = query.from;
    params.to = query.to;
  }
  if (query.propertyId) params.propertyId = query.propertyId;
  return params;
}

function asObject<T>(value: unknown): T {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unexpected answer of the dashboard');
  return value as T;
}

export const dashboardApi = {
  getToday: async (signal?: AbortSignal) => asObject<DashboardToday>(await ApiClient.get<unknown>('/dashboard/today', undefined, { signal })),

  getOverview: async (query: DashboardOverviewQuery) =>
    asObject<DashboardOverview>(await ApiClient.get<unknown>('/dashboard/overview', dashboardOverviewParams(query))),

  getIcalFeeds: () => ApiClient.get<DashboardIcalFeed[]>('/dashboard/ical-feeds'),
};
