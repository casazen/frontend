import { ApiClient } from './client';
import { buildRevenueAnalytics } from '@/lib/revenue-analytics';
import type {
  Payment,
  CreatePaymentDto,
  RevenueParams,
  RevenueAnalytics,
  RevenueResponse,
} from '@/types';

function mapRevenueResponseToAnalytics(response: RevenueResponse): RevenueAnalytics {
  const period = `${response.startDate} — ${response.endDate}`;
  return {
    totalRevenue: response.revenue,
    totalBookings: 0,
    averageBookingValue: 0,
    data: [
      {
        period,
        revenue: response.revenue,
        bookings: 0,
        averageBookingValue: 0,
      },
    ],
  };
}

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
    const { propertyId, startDate, endDate } = params ?? {};

    if (propertyId && startDate && endDate) {
      const response = await ApiClient.get<RevenueResponse>('/payments/revenue', {
        propertyId,
        startDate,
        endDate,
      });
      return mapRevenueResponseToAnalytics(response);
    }

    const payments = await ApiClient.get<Payment[]>('/payments');
    return buildRevenueAnalytics(payments ?? [], params);
  },
};
