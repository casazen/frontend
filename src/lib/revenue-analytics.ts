import type { Payment, RevenueAnalytics, RevenueParams } from '@/types';

function formatPeriod(date: Date, groupBy: NonNullable<RevenueParams['groupBy']>): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  switch (groupBy) {
    case 'day':
      return `${year}-${month}-${day}`;
    case 'week': {
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      return `W${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    }
    case 'year':
      return String(year);
    case 'month':
    default:
      return `${year}-${month}`;
  }
}

/** Build dashboard analytics from completed payments (matches RevenueDashboard contract). */
export function buildRevenueAnalytics(
  payments: Payment[],
  params?: RevenueParams,
): RevenueAnalytics {
  const groupBy = params?.groupBy ?? 'month';

  let completed = payments.filter((p) => p.status === 'Completed');

  if (params?.startDate) {
    const start = new Date(params.startDate);
    completed = completed.filter((p) => new Date(p.createdAt) >= start);
  }
  if (params?.endDate) {
    const end = new Date(params.endDate);
    end.setHours(23, 59, 59, 999);
    completed = completed.filter((p) => new Date(p.createdAt) <= end);
  }

  const buckets = new Map<string, { revenue: number; bookings: Set<string> }>();

  for (const payment of completed) {
    const period = formatPeriod(new Date(payment.createdAt), groupBy);
    const bucket = buckets.get(period) ?? { revenue: 0, bookings: new Set<string>() };
    bucket.revenue += payment.amount;
    bucket.bookings.add(payment.bookingId);
    buckets.set(period, bucket);
  }

  const data = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      revenue: bucket.revenue,
      bookings: bucket.bookings.size,
      averageBookingValue: bucket.bookings.size > 0 ? bucket.revenue / bucket.bookings.size : 0,
    }));

  const totalRevenue = completed.reduce((sum, p) => sum + p.amount, 0);
  const totalBookings = new Set(completed.map((p) => p.bookingId)).size;

  return {
    totalRevenue,
    totalBookings,
    averageBookingValue: totalBookings > 0 ? totalRevenue / totalBookings : 0,
    data,
  };
}
