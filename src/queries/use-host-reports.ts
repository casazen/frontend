import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { reportsApi, type HostReportKind, type PerformanceQuery, type ReportPeriod } from '@/api/reports.api';

export const HOST_REPORTS_KEY = 'host-reports';

/** Downloads the CSV of a report of short rent (the caller saves the blob and shows the error). */
export function useDownloadHostReport() {
  return useMutation({
    mutationFn: (args: { kind: HostReportKind; period: ReportPeriod }) => reportsApi.downloadCsv(args.kind, args.period),
  });
}

/**
 * Occupancy, revenue, ADR and RevPAR of the Home for the days of `query`, next to the same days one year earlier when it asks (NF-96).
 * `enabled` is false while the days are not a period the server accepts (the page says why, the server is not asked). The numbers are
 * read again at every visit, since the bookings change them from other screens, and the previous ones stay on screen while the next
 * load.
 */
export function usePerformanceReport(query: PerformanceQuery, enabled = true) {
  return useQuery({
    queryKey: [HOST_REPORTS_KEY, 'performance', query],
    queryFn: () => reportsApi.getPerformance(query),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** The same figures week by week or month by month (NF-96): one line for the whole scope, or for each property or channel. */
export function useTrendReport(query: PerformanceQuery, enabled = true) {
  return useQuery({
    queryKey: [HOST_REPORTS_KEY, 'trend', query],
    queryFn: () => reportsApi.getTrend(query),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}
