import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import i18n from '@/i18n/config';
import type { PricingPreviewDay } from '@/types';

interface PricingPreviewSectionProps {
  prices: PricingPreviewDay[];
}

export function PricingPreviewSection({ prices }: PricingPreviewSectionProps) {
  const { t } = useTranslation();
  const chartData = prices.map((p) => ({
    date: p.date,
    suggested: p.suggestedPrice,
    base: p.basePrice,
    label: new Date(p.date).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' }),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('pricing.preview.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                interval={13}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `€${v}`}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(typeof value === 'number' ? value : 0),
                  name === 'suggested' ? t('pricing.preview.tooltip.aiPrice') : t('pricing.preview.tooltip.basePrice'),
                ]}
                labelFormatter={(label) => `${t('pricing.preview.tooltip.date')} ${label}`}
              />
              <Line
                type="monotone"
                dataKey="suggested"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                name="suggested"
              />
              <Line
                type="monotone"
                dataKey="base"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                name="base"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('pricing.preview.details')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">{t('pricing.preview.date')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('pricing.preview.base')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('pricing.preview.aiPrice')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('pricing.preview.delta')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('pricing.preview.reason')}</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => {
                  const delta = p.suggestedPrice - p.basePrice;
                  const pct = p.basePrice > 0 ? (delta / p.basePrice) * 100 : 0;
                  return (
                    <tr key={p.date} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(p.date).toLocaleDateString(i18n.language)}
                      </td>
                      <td className="px-4 py-2 text-right">{formatCurrency(p.basePrice)}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(p.suggestedPrice)}
                      </td>
                      <td
                        className={`px-4 py-2 text-right text-xs font-medium ${
                          delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'
                        }`}
                      >
                        {delta >= 0 ? '+' : ''}
                        {pct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">
                        {p.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
