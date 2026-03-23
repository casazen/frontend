import { ApiClient } from './client';
import type {
  Payment,
  CreatePaymentDto,
  UpdatePaymentDto,
  ProcessPaymentDto,
  RefundPaymentDto,
  RevenueParams,
  RevenueAnalytics,
} from '@/types';

export const paymentsApi = {
  getAll: (params?: Record<string, any>) =>
    ApiClient.getPaginated<Payment>('/payments', params),

  getById: (id: string) => ApiClient.get<Payment>(`/payments/${id}`),

  create: (data: CreatePaymentDto) =>
    ApiClient.post<Payment>('/payments', data),

  update: (id: string, data: UpdatePaymentDto) =>
    ApiClient.patch<Payment>(`/payments/${id}`, data),

  delete: (id: string) => ApiClient.delete<void>(`/payments/${id}`),

  process: (id: string, data: ProcessPaymentDto) =>
    ApiClient.post<Payment>(`/payments/${id}/process`, data),

  refund: (id: string, data?: RefundPaymentDto) =>
    ApiClient.post<Payment>(`/payments/${id}/refund`, data),

  getRevenue: (params?: RevenueParams) =>
    ApiClient.get<RevenueAnalytics>('/payments/revenue', params),
};
