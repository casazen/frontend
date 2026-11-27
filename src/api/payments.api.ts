import { ApiClient } from './client';
import { buildRevenueAnalytics } from '@/lib/revenue-analytics';
import type {
  Payment,
  PaymentListItem,
  PaymentRefund,
  PaymentRefundsResponse,
  RecordPaymentInput,
  RefundPaymentDto,
  RevenueParams,
  RevenueAnalytics,
} from '@/types';

export const paymentsApi = {
  getAll: (params?: Record<string, unknown>) =>
    ApiClient.get<PaymentListItem[]>('/payments', params),

  getById: (id: string) => ApiClient.get<Payment>(`/payments/${id}`),

  /**
   * Records a payment received outside CasaZen (SR-06b). The key travels as `Idempotency-Key`, not in the body: the same key again
   * answers with the payment already written and writes nothing.
   */
  create: ({ idempotencyKey, ...body }: RecordPaymentInput) =>
    ApiClient.post<Payment>('/payments', body, { headers: { 'Idempotency-Key': idempotencyKey } }),

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
