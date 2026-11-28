import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/api/payments.api';
import type { PaymentRefund, RecordPaymentInput, RefundPaymentDto, RevenueParams } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

export const PAYMENTS_KEY = 'payments';

const FISCAL_DOCUMENTS_ROOT = ['fiscal', 'documents'] as const;

export function usePayments(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: [PAYMENTS_KEY, params],
    queryFn: () => paymentsApi.getAll(params),
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

export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RecordPaymentInput) => paymentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: FISCAL_DOCUMENTS_ROOT });
      toast.success(i18n.t('toast.paymentCreated'));
    },
  });
}

const REFUND_POLL_INTERVAL_MS = 5000;

function isRefundInProgress(refund: PaymentRefund): boolean {
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

export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: RefundPaymentDto }) => paymentsApi.refund(id, data),
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: FISCAL_DOCUMENTS_ROOT });
    },
  });
}
