import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/api/payments.api';
import type { CreatePaymentDto, PaymentRefund, RefundPaymentDto, RevenueParams } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

export const PAYMENTS_KEY = 'payments';

export function usePayments(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, params],
    queryFn: () => paymentsApi.getAll(params),
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

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePaymentDto) => paymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      toast.success(i18n.t('toast.paymentCreated'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.paymentCreateFailed'));
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
