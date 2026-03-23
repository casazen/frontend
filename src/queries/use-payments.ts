import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { paymentsApi } from '@/api/payments.api';
import type {
  CreatePaymentDto,
  UpdatePaymentDto,
  ProcessPaymentDto,
  RefundPaymentDto,
  RevenueParams,
} from '@/types';
import { toast } from 'sonner';

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
      toast.success('Payment created successfully');
    },
    onError: () => {
      toast.error('Failed to create payment');
    },
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePaymentDto }) =>
      paymentsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, variables.id] });
      toast.success('Payment updated successfully');
    },
    onError: () => {
      toast.error('Failed to update payment');
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paymentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      toast.success('Payment deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete payment');
    },
  });
}

export function useProcessPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProcessPaymentDto }) =>
      paymentsApi.process(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, variables.id] });
      toast.success('Payment processed successfully');
    },
    onError: () => {
      toast.error('Failed to process payment');
    },
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: RefundPaymentDto }) =>
      paymentsApi.refund(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: [PAYMENTS_KEY, 'revenue'] });
      toast.success('Payment refunded successfully');
    },
    onError: () => {
      toast.error('Failed to refund payment');
    },
  });
}
