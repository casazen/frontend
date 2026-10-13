import { ApiClient } from './client';
import type { DashboardIcalFeed, DashboardKpis, DashboardPeriodSelection } from '@/types/dashboard.types';

/** Query string of a period: `period=Month[&month=yyyy-MM]` or `period=Last30Days`. */
export function dashboardPeriodParams(selection: DashboardPeriodSelection): Record<string, string> {
  if (selection.kind === 'Last30Days') return { period: 'Last30Days' };
  return selection.month ? { period: 'Month', month: selection.month } : { period: 'Month' };
}

export const dashboardApi = {
  /** Host KPIs of the period, computed on the server (PC-16): never the whole list of bookings. */
  getKpis: (selection: DashboardPeriodSelection) =>
    ApiClient.get<DashboardKpis>('/dashboard/kpis', dashboardPeriodParams(selection)),

  /** The iCal import feeds of the host's properties, failures first. */
  getIcalFeeds: () => ApiClient.get<DashboardIcalFeed[]>('/dashboard/ical-feeds'),
};
