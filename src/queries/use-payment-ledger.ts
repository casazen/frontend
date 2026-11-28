import { useQuery } from '@tanstack/react-query';
import { getBookingLedger, listLedger } from '@/api/payment-ledger.api';
import type { PaymentLedgerCriteria } from '@/types';
import { PAYMENTS_KEY } from './use-payments';

export const PAYMENT_LEDGER_KEY = 'payment-ledger';

/**
 * What the ledger holds is money, and it changes from other screens (a payment recorded, a refund, a booking cancelled) and without any screen at all (the
 * provider confirms a card payment, the channel sends its collections): it is read again whenever it opens and whenever the window is looked at again
 * (`staleTime: 0`, `refetchOnMount: 'always'`), and it is not kept once nothing shows it (`gcTime: 0`): a ledger that was left is never shown again as if it were
 * current, and the amounts of a booking do not stay in the browser. No event of the live channel says a payment changed, so there is none to listen to.
 */
const FRESH = { staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const;

export function useBookingLedger(bookingId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, PAYMENT_LEDGER_KEY, 'booking', bookingId],
    queryFn: () => getBookingLedger(bookingId),
    enabled: Boolean(bookingId) && (options.enabled ?? true),
    ...FRESH,
  });
}

export function usePeriodLedger(criteria: PaymentLedgerCriteria, page: number, pageSize: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, PAYMENT_LEDGER_KEY, 'period', criteria, page, pageSize],
    queryFn: () => listLedger(criteria, page, pageSize),
    enabled: options.enabled ?? true,
    placeholderData: (previousData, previousQuery) => {
      const before = previousQuery?.queryKey[3];
      return before !== undefined && JSON.stringify(before) === JSON.stringify(criteria) ? previousData : undefined;
    },
    ...FRESH,
  });
}
