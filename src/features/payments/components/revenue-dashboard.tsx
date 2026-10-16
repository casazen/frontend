import { useTranslation } from 'react-i18next';
import { StatStrip, StatTile } from '@/components/shared/calm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import type { RevenueAnalytics } from '@/types';

interface RevenueDashboardProps {
  analytics: RevenueAnalytics;
  currency?: string;
}

export function RevenueDashboard({ analytics, currency = 'EUR' }: RevenueDashboardProps) {
  const { t } = useTranslation();
  const rows = analytics.data ?? [];
  const chartData = rows.map((item) => ({
    period: item.period,
    revenue: item.revenue,
    bookings: item.bookings,
    avgValue: item.averageBookingValue,
  }));

  return (
    <div className="space-y-6">
      {/* The numbers, quiet and in one row (UI-16) */}
      <StatStrip>
        <StatTile label={t('payment.revenue.stats.totalRevenue')} value={formatCurrency(analytics.totalRevenue, currency)} />
        <StatTile label={t('payment.revenue.stats.totalBookings')} value={analytics.totalBookings} />
        <StatTile label={t('payment.revenue.stats.avgBookingValue')} value={formatCurrency(analytics.averageBookingValue, currency)} />
        <StatTile label={t('payment.revenue.stats.periods')} value={rows.length} />
      </StatStrip>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payment.revenue.charts.revenueOverTime')}</CardTitle>
          <CardDescription>{t('payment.revenue.charts.revenueOverTimeDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), currency)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                name={t('payment.revenue.charts.revenue')}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bookings Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payment.revenue.charts.bookingsAvgValue')}</CardTitle>
          <CardDescription>{t('payment.revenue.charts.bookingsAvgValueDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="bookings"
                fill="#10b981"
                name={t('payment.revenue.charts.bookings')}
              />
              <Bar
                yAxisId="right"
                dataKey="avgValue"
                fill="#f59e0b"
                name={t('payment.revenue.charts.avgValue')}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Period Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('payment.revenue.table.title')}</CardTitle>
          <CardDescription>{t('payment.revenue.table.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">{t('payment.revenue.table.period')}</th>
                  <th className="text-right py-2">{t('payment.revenue.table.revenue')}</th>
                  <th className="text-right py-2">{t('payment.revenue.table.bookings')}</th>
                  <th className="text-right py-2">{t('payment.revenue.table.avgValue')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.period} className="border-b">
                    <td className="py-2">{item.period}</td>
                    <td className="text-right font-medium">
                      {formatCurrency(item.revenue, currency)}
                    </td>
                    <td className="text-right">{item.bookings}</td>
                    <td className="text-right">
                      {formatCurrency(item.averageBookingValue, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
