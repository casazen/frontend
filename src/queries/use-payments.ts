import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/api/payments.api';
import type { PaymentRefund, RecordPaymentInput, RefundPaymentDto, RevenueParams } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

export const PAYMENTS_KEY = 'payments';

export function usePayments(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, params],
    queryFn: () => paymentsApi.getAll(params),
    // The list changes from other pages (a payment recorded, a refund): an invalidation reaches it only while it is on screen, so it
    // asks again when it opens if what it holds is stale (the client has `refetchOnMount: false`).
    refetchOnMount: true,
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, id],
    queryFn: () => paymentsApi.getById(id),
    enabled: !!id,
  });
}

export function useRevenue(params?: RevenueParams) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, 'revenue', params],
    queryFn: () => paymentsApi.getRevenue(params),
  });
}

/**
 * Records a payment the host received outside CasaZen (SR-06b). The form shows the server's reason when it refuses (more than is
 * left to collect, a booking from a portal...), so there is no toast for the failure; the booking it was recorded on is read
 * again (what came in, what is left).
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordPaymentInput) => paymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      // The key of `use-bookings.ts` (which imports this file, so it cannot be imported here): what came in changed.
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success(i18n.t('toast.paymentCreated'));
    },
  });
}

/** Refunds still waiting for Stripe are polled until Stripe confirms or fails them (BK-02). */
export const REFUND_POLL_INTERVAL_MS = 5000;

export function isRefundInProgress(refund: PaymentRefund): boolean {
  return refund.status === 'Pending' || refund.status === 'RequiresAction';
}

export function usePaymentRefunds(id: string, enabled = true) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, id, 'refunds'],
    queryFn: () => paymentsApi.getRefunds(id),
    enabled: enabled && !!id,
    refetchInterval: (query) =>
      query.state.data?.refunds.some(isRefundInProgress) ? REFUND_POLL_INTERVAL_MS : false,
  });
}

/**
 * Refund on Stripe. No toast: the dialog shows what Stripe answered (confirmed, waiting or failed)
 * and the error, so nothing claims "refunded" before Stripe does.
 */
export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RefundPaymentDto }) => paymentsApi.refund(id, data),
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, variables.id] });
    },
  });
}
