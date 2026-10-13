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
  it('has no process call: payments are collected only through Stripe (A9-15)', () => {
    expect('process' in paymentsApi).toBe(false);
  });

  it('refund sends amount and reason as JSON body to POST /payments/:id/refund', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ id: 'r1', status: 'Pending' });

    await paymentsApi.refund(paymentId, { amount: 50, reason: 'Guasto' });

    expect(ApiClient.post).toHaveBeenCalledWith(`/payments/${paymentId}/refund`, { amount: 50, reason: 'Guasto' });
  });

  it('refund without amount asks for everything still refundable', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ id: 'r1', status: 'Succeeded' });

    await paymentsApi.refund(paymentId);

    expect(ApiClient.post).toHaveBeenCalledWith(`/payments/${paymentId}/refund`, {});
  });

  it('getRefunds calls GET /payments/:id/refunds', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce({ refunds: [] });

    await paymentsApi.getRefunds(paymentId);

    expect(ApiClient.get).toHaveBeenCalledWith(`/payments/${paymentId}/refunds`);
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
