import { useMutation } from '@tanstack/react-query';
import { reportsApi, type HostReportKind, type ReportPeriod } from '@/api/reports.api';

/** Downloads the CSV of a report of short rent (the caller saves the blob and shows the error). */
export function useDownloadHostReport() {
  return useMutation({
    mutationFn: (args: { kind: HostReportKind; period: ReportPeriod }) => reportsApi.downloadCsv(args.kind, args.period),
  });
}
