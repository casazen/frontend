import { ApiClient } from './client';
import type { DashboardIcalFeed, DashboardOverview, DashboardOverviewQuery, DashboardToday } from '@/types/dashboard.types';

/** Query string of the overview: `period` (`Month`, `Last30Days` or `Custom` with `from` and `to`) and, optionally, `propertyId`. */
export function dashboardOverviewParams(query: DashboardOverviewQuery): Record<string, string> {
  const params: Record<string, string> = { period: query.period };
  if (query.period === 'Custom') {
    params.from = query.from;
    params.to = query.to;
  }
  if (query.propertyId) params.propertyId = query.propertyId;
  return params;
}

/** A read that did not come back as an object (an answer of another kind) is an error to show, not data to draw. */
function asObject<T>(value: unknown): T {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Unexpected answer of the dashboard');
  return value as T;
}

export const dashboardApi = {
  /** The host's day in one read: arrivals, departures, interventions and the things to do, most pressing first (SR-03, SR-03b). */
  getToday: async () => asObject<DashboardToday>(await ApiClient.get<unknown>('/dashboard/today')),

  /** The numbers of the Home for a period, with the difference from the one before, the next arrivals and the revenue by week or month (SR-03b). */
  getOverview: async (query: DashboardOverviewQuery) =>
    asObject<DashboardOverview>(await ApiClient.get<unknown>('/dashboard/overview', dashboardOverviewParams(query))),

  /** The iCal import feeds of the host's properties, failures first. */
  getIcalFeeds: () => ApiClient.get<DashboardIcalFeed[]>('/dashboard/ical-feeds'),
};
