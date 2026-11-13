import { useQuery } from '@tanstack/react-query';
import { reportChannelCostsApi } from '@/api/report-channel-costs.api';
import type { ReportPeriod } from '@/api/reports.api';

export const REPORT_CHANNEL_COSTS_KEY = 'report-channel-costs';

/**
 * What the report holds changes from other screens (a booking imported or changed, a payment recorded) and without any screen at all (the
 * channel manager reports a commission): it is read again whenever it opens and whenever the window is looked at again (`staleTime: 0`,
 * `refetchOnMount: 'always'`), and it is not kept once nothing shows it (`gcTime: 0`): a report that was left is never shown again as if it
 * were current, and the amounts of the host do not stay in the browser.
 */
const FRESH = { staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const;

/**
 * What each channel costs between two days (NF-98): gross, commission and net, the card fees of the direct stays and how each channel
 * settles its commission, every figure the server's. `enabled` is false while the person may not read payments or the days are not a
 * period the server accepts (the page says why, and the server is not asked). The data is `null` when the server answers 403 ("not for
 * this caller"). The query keeps its old data on a failed refetch (a 404 for a property outside the person's reach included): the page
 * reads `isError` first (`reportView`), so the previous figures never stay on screen next to an error.
 */
export function useChannelCostsReport(period: ReportPeriod, propertyId: string, enabled: boolean) {
  return useQuery({
    queryKey: [REPORT_CHANNEL_COSTS_KEY, period.from, period.to, propertyId],
    queryFn: () => reportChannelCostsApi.getChannelCosts(period, propertyId),
    enabled,
    ...FRESH,
  });
}
