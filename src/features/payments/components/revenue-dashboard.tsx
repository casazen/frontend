import { CalendarDays, CalendarRange, ReceiptText, Wallet } from 'lucide-react';
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
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      {/* The numbers, quiet and in one row (UI-16) */}
      <StatStrip className="xl:col-span-2">
        <StatTile icon={Wallet} label={t('payment.revenue.stats.totalRevenue')} value={formatCurrency(analytics.totalRevenue, currency)} />
        <StatTile icon={CalendarDays} label={t('payment.revenue.stats.totalBookings')} value={analytics.totalBookings} />
        <StatTile icon={ReceiptText} label={t('payment.revenue.stats.avgBookingValue')} value={formatCurrency(analytics.averageBookingValue, currency)} />
        <StatTile icon={CalendarRange} label={t('payment.revenue.stats.periods')} value={rows.length} />
      </StatStrip>

      {/* Revenue Chart */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t('payment.revenue.charts.revenueOverTime')}</CardTitle>
          <CardDescription>{t('payment.revenue.charts.revenueOverTimeDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value), currency)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-primary)"
                strokeWidth={2}
                name={t('payment.revenue.charts.revenue')}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Bookings Chart */}
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>{t('payment.revenue.charts.bookingsAvgValue')}</CardTitle>
          <CardDescription>{t('payment.revenue.charts.bookingsAvgValueDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="bookings"
                fill="var(--color-primary)"
                name={t('payment.revenue.charts.bookings')}
              />
              <Bar
                yAxisId="right"
                dataKey="avgValue"
                fill="var(--color-foreground)"
                name={t('payment.revenue.charts.avgValue')}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Period Table */}
      <Card className="min-w-0 xl:col-span-2">
        <CardHeader>
          <CardTitle>{t('payment.revenue.table.title')}</CardTitle>
          <CardDescription>{t('payment.revenue.table.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-xl border">
            <table aria-label={t('payment.revenue.table.title')} className="w-full text-sm tabular-nums [&_td]:px-3 [&_th]:px-3">
              <thead className="bg-surface-2 text-xs text-foreground/80">
                <tr className="border-b">
                  <th scope="col" className="text-left py-2">{t('payment.revenue.table.period')}</th>
                  <th scope="col" className="text-right py-2">{t('payment.revenue.table.revenue')}</th>
                  <th scope="col" className="text-right py-2">{t('payment.revenue.table.bookings')}</th>
                  <th scope="col" className="text-right py-2">{t('payment.revenue.table.avgValue')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.period} className="border-b">
                    <th scope="row" className="py-3 text-left font-medium">{item.period}</th>
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
