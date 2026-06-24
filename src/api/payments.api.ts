import { ApiClient } from './client';
import { buildRevenueAnalytics } from '@/lib/revenue-analytics';
import type {
  Payment,
  CreatePaymentDto,
  RevenueParams,
  RevenueAnalytics,
} from '@/types';

export const paymentsApi = {
  getAll: (params?: Record<string, any>) =>
    ApiClient.get<Payment[]>('/payments', params),

  getById: (id: string) => ApiClient.get<Payment>(`/payments/${id}`),

  create: (data: CreatePaymentDto) =>
    ApiClient.post<Payment>('/payments', data),

  process: (id: string) =>
    ApiClient.post<Payment>(`/payments/${id}/process`),

  refund: (id: string, amount?: number) => {
    const url =
      amount !== undefined
        ? `/payments/${id}/refund?amount=${encodeURIComponent(String(amount))}`
        : `/payments/${id}/refund`;
    return ApiClient.post<Payment>(url);
  },

  getRevenue: async (params?: RevenueParams): Promise<RevenueAnalytics> => {
    const propertyId = params?.propertyId;

    const queryParams: Record<string, any> = {};
    if (propertyId) queryParams.propertyId = propertyId;

    const payments = await ApiClient.get<Payment[]>('/payments', queryParams);
    return buildRevenueAnalytics(payments ?? [], params);
  },
};
