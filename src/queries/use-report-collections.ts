import { useQuery } from '@tanstack/react-query';
import { reportCollectionsApi } from '@/api/report-collections.api';
import type { ReportPeriod } from '@/api/reports.api';

export const REPORT_COLLECTIONS_KEY = 'report-collections';

/**
 * What a money report holds changes from other screens (a payment recorded, a refund, a booking cancelled) and without any screen at all (the
 * provider confirms a card payment): it is read again whenever it opens and whenever the window is looked at again (`staleTime: 0`,
 * `refetchOnMount: 'always'`), and it is not kept once nothing shows it (`gcTime: 0`): a report that was left is never shown again as if it
 * were current, and the amounts of the host do not stay in the browser.
 */
const FRESH = { staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const;

/**
 * The money that came in between two days, by date, payment method and channel, with the credits (NF-97): every figure is the server's.
 * `enabled` is false while the person may not read payments or the days are not a period the server accepts (the page says why, and the
 * server is not asked). The data is `null` when the server answers 403 ("not for this caller"). The query keeps its old data on a failed
 * refetch (a 404 for a property outside the person's reach included): the page reads `isError` first (`reportView`), so the previous figures
 * never stay on screen next to an error, and the figures of other days are never shown for these.
 */
export function useCollectionsReport(period: ReportPeriod, propertyId: string, enabled: boolean) {
  return useQuery({
    queryKey: [REPORT_COLLECTIONS_KEY, 'collections', period.from, period.to, propertyId],
    queryFn: () => reportCollectionsApi.getCollections(period, propertyId),
    enabled,
    ...FRESH,
  });
}

/**
 * The stays that still have something to collect, as of today (NF-97): the list does not depend on a period, only on the property.
 * `enabled` is false while the person may not read payments. The data is `null` on a 403.
 */
export function useBalancesToCollect(propertyId: string, enabled: boolean) {
  return useQuery({
    queryKey: [REPORT_COLLECTIONS_KEY, 'balances-to-collect', propertyId],
    queryFn: () => reportCollectionsApi.getBalancesToCollect(propertyId),
    enabled,
    ...FRESH,
  });
}
