import { useQuery } from '@tanstack/react-query';
import { reportChannelCostsApi } from '@/api/report-channel-costs.api';
import type { ReportPeriod } from '@/api/reports.api';

export const REPORT_CHANNEL_COSTS_KEY = 'report-channel-costs';

/**
 * What each channel costs between two days (NF-98): gross, commission and net, the card fees of the direct stays and how each channel
 * settles its commission, every figure the server's. `enabled` is false while the person may not read payments or the days are not a
 * period the server accepts (the page says why, and the server is not asked). The report is read again at every visit and soon again on
 * the same page. The data is `null` when the server answers 403 ("not for this caller"). The query keeps its old data on a failed
 * refetch (a 404 for a property outside the person's reach included): the page reads `isError` first (`reportView`), so the previous
 * figures never stay on screen next to an error.
 */
export function useChannelCostsReport(period: ReportPeriod, propertyId: string, enabled: boolean) {
  return useQuery({
    queryKey: [REPORT_CHANNEL_COSTS_KEY, period.from, period.to, propertyId],
    queryFn: () => reportChannelCostsApi.getChannelCosts(period, propertyId),
    enabled,
    staleTime: 30_000,
    refetchOnMount: 'always',
  });
}
