import { ApiClient } from './client';
import { buildRevenueAnalytics } from '@/lib/revenue-analytics';
import type {
  Payment,
  PaymentRefund,
  PaymentRefundsResponse,
  CreatePaymentDto,
  RefundPaymentDto,
  RevenueParams,
  RevenueAnalytics,
} from '@/types';

export const paymentsApi = {
  getAll: (params?: Record<string, unknown>) =>
    ApiClient.get<Payment[]>('/payments', params),

  getById: (id: string) => ApiClient.get<Payment>(`/payments/${id}`),

  create: (data: CreatePaymentDto) =>
    ApiClient.post<Payment>('/payments', data),

  /**
   * Refund on Stripe (BK-02). The answer is the refund as Stripe left it: only `Succeeded` means
   * the money went back; `Pending` is confirmed later (poll `getRefunds`).
   */
  refund: (id: string, data: RefundPaymentDto = {}) =>
    ApiClient.post<PaymentRefund>(`/payments/${id}/refund`, data),

  getRefunds: (id: string) => ApiClient.get<PaymentRefundsResponse>(`/payments/${id}/refunds`),

  getRevenue: async (params?: RevenueParams): Promise<RevenueAnalytics> => {
    const propertyId = params?.propertyId;

    const queryParams: Record<string, string> = {};
    if (propertyId) queryParams.propertyId = propertyId;

    const payments = await ApiClient.get<Payment[]>('/payments', queryParams);
    return buildRevenueAnalytics(payments ?? [], params);
  },
};
