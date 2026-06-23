import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/api/payments.api';
import type { CreatePaymentDto, RevenueParams } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const PAYMENTS_KEY = 'payments';

export function usePayments(params?: Record<string, any>) {
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
    onError: () => {
      toast.error(i18n.t('toast.paymentCreateFailed'));
    },
  });
}

export function useProcessPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsApi.process(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, id] });
      toast.success(i18n.t('toast.paymentProcessed'));
    },
    onError: () => {
      toast.error(i18n.t('toast.paymentProcessFailed'));
    },
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount?: number }) =>
      paymentsApi.refund(id, amount),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, 'revenue'] });
      toast.success(i18n.t('toast.paymentRefunded'));
    },
    onError: () => {
      toast.error(i18n.t('toast.paymentRefundFailed'));
    },
  });
}
