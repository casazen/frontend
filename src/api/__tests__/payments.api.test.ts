import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paymentsApi } from '../payments.api';
import { ApiClient } from '../client';
import type { Payment } from '@/types';

vi.mock('../client');
vi.mock('@/lib/revenue-analytics', () => ({
  buildRevenueAnalytics: vi.fn(() => ({
    totalRevenue: 500,
    totalBookings: 2,
    averageBookingValue: 250,
    data: [],
  })),
}));

const paymentId = '22222222-2222-2222-2222-222222222222';
const propertyId = '11111111-1111-1111-1111-111111111111';

const mockPayment: Payment = {
  id: paymentId,
  bookingId: '33333333-3333-3333-3333-333333333333',
  amount: 120,
  currency: 'EUR',
  status: 'Completed',
  method: 'CreditCard',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('paymentsApi contract sync (#17)', () => {
  it('process calls POST /payments/:id/process with no body', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(mockPayment);

    await paymentsApi.process(paymentId);

    expect(ApiClient.post).toHaveBeenCalledWith(`/payments/${paymentId}/process`);
  });

  it('refund calls POST /payments/:id/refund with amount query param', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(mockPayment);

    await paymentsApi.refund(paymentId, 50);

    expect(ApiClient.post).toHaveBeenCalledWith(`/payments/${paymentId}/refund?amount=50`);
  });

  it('refund omits query param for full refund', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(mockPayment);

    await paymentsApi.refund(paymentId);

    expect(ApiClient.post).toHaveBeenCalledWith(`/payments/${paymentId}/refund`);
  });

  it('getRevenue loads payments and builds analytics client-side', async () => {
    const { buildRevenueAnalytics } = await import('@/lib/revenue-analytics');
    vi.mocked(buildRevenueAnalytics).mockReturnValueOnce({
      totalRevenue: 900,
      totalBookings: 1,
      averageBookingValue: 900,
      data: [{ period: '2026-01', revenue: 900, bookings: 1 }],
    });
    vi.mocked(ApiClient.get).mockResolvedValueOnce([mockPayment]);

    const result = await paymentsApi.getRevenue({
      propertyId,
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });

    expect(ApiClient.get).toHaveBeenCalledWith('/payments', { propertyId });
    expect(buildRevenueAnalytics).toHaveBeenCalled();
    expect(result.totalRevenue).toBe(900);
    expect(result.data[0]?.revenue).toBe(900);
  });
});
