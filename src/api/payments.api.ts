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
  /** All the payments of the host, newest first (SR-03). `propertyId`, `bookingId`, `from` and `to` narrow them. */
  getAll: (params?: Record<string, unknown>) =>
    ApiClient.get<PaymentListItem[]>('/payments', params),

  getById: (id: string) => ApiClient.get<Payment>(`/payments/${id}`),

  /**
   * Records a payment received outside CasaZen (SR-06b). The key travels as `Idempotency-Key`, not in the body: the same key again
   * answers with the payment already written and writes nothing.
   */
  create: ({ idempotencyKey, ...body }: RecordPaymentInput) =>
    ApiClient.post<Payment>('/payments', body, { headers: { 'Idempotency-Key': idempotencyKey } }),

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
