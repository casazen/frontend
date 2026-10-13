import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { AlertTriangle, Info } from 'lucide-react';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { SeasonalSuggestionsResponse } from '@/types';
import { ruleLabel } from '../seasonal-rules';

interface PricingSuggestionsSectionProps {
  data: SeasonalSuggestionsResponse;
  applying?: boolean;
  onApply?: (items: { date: string; price?: number | null }[]) => void;
}

/**
 * Seasonal suggestions (D4): proposals until the host confirms them. Confirmed (optionally edited) prices are used
 * in quotes.
 */
export function PricingSuggestionsSection({ data, applying, onApply }: PricingSuggestionsSectionProps) {
  const { t, i18n } = useTranslation();
  const items = data.items;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const computedBase = items[0]?.basePrice;
  const baseChanged = computedBase !== undefined && computedBase !== data.currentBasePrice;

  const chartData = items.map((s) => ({
    date: s.date,
    suggested: s.suggestedPrice,
    base: s.basePrice,
    label: formatDate(s.date, 'dd/MM'),
  }));

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm text-muted-foreground">{t('pricing.suggestions.basePriceLabel')}</span>
            <span className="text-2xl font-semibold" data-testid="current-base-price">
              {formatCurrency(data.currentBasePrice)}
            </span>
            <span className="text-sm text-muted-foreground">{t('pricing.suggestions.perNight')}</span>
          </div>
          <p className="text-xs text-muted-foreground">{t('pricing.suggestions.basePriceHint')}</p>
          <div className="flex gap-2 rounded-md bg-muted p-3 text-sm" data-testid="apply-notice">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <p>{t('pricing.suggestions.applyNotice')}</p>
          </div>
          {onApply && (
            <Button
              type="button"
              size="sm"
              data-testid="apply-all-suggestions"
              disabled={applying}
              onClick={() => onApply([])}
            >
              {t('pricing.suggestions.applyAll')}
            </Button>
          )}
          {baseChanged && (
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm"
              data-testid="base-changed-warning"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600" />
              <p>
                {t('pricing.suggestions.baseChanged', {
                  computed: formatCurrency(computedBase),
                  current: formatCurrency(data.currentBasePrice),
                })}
              </p>
            </div>
          )}
          {data.computedAt && (
            <p className="text-xs text-muted-foreground" data-testid="computed-at">
              {t('pricing.suggestions.computedAt', { date: formatDateTime(data.computedAt) })}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('pricing.suggestions.chartTitle', { count: items.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={13} className="text-muted-foreground" />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => formatCurrency(v)}
                className="text-muted-foreground"
              />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(typeof value === 'number' ? value : 0),
                  name === 'suggested' ? t('pricing.suggestions.suggested') : t('pricing.suggestions.base'),
                ]}
                labelFormatter={(label) => `${t('pricing.suggestions.date')}: ${label}`}
              />
              <Line type="monotone" dataKey="suggested" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="suggested" />
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
          <CardTitle>{t('pricing.suggestions.details')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="suggestions-table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">{t('pricing.suggestions.date')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('pricing.suggestions.base')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('pricing.suggestions.suggested')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('pricing.suggestions.applied')}</th>
                  <th className="px-4 py-3 text-right font-medium">{t('pricing.suggestions.delta')}</th>
                  <th className="px-4 py-3 text-left font-medium">{t('pricing.suggestions.rule')}</th>
                  <th className="px-4 py-3 text-left font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((s) => {
                  const delta = s.suggestedPrice - s.basePrice;
                  const pct = s.basePrice > 0 ? (delta / s.basePrice) * 100 : 0;
                  return (
                    <tr key={s.date} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground">{formatDate(s.date)}</td>
                      <td className="px-4 py-2 text-right">{formatCurrency(s.basePrice)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(s.suggestedPrice)}</td>
                      <td className="px-4 py-2 text-right">
                        {s.appliedPrice != null ? formatCurrency(s.appliedPrice) : '—'}
                      </td>
                      <td
                        className={`px-4 py-2 text-right text-xs font-medium ${
                          delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground'
                        }`}
                      >
                        {delta > 0 ? '+' : ''}
                        {pct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{ruleLabel(s, t, i18n.language)}</td>
                      <td className="px-4 py-2">
                        {onApply && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-8 w-24"
                              data-testid={`seasonal-edit-${s.date}`}
                              placeholder={String(s.suggestedPrice)}
                              value={edits[s.date] ?? ''}
                              onChange={(e) => setEdits((prev) => ({ ...prev, [s.date]: e.target.value }))}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={applying}
                              onClick={() => {
                                const raw = edits[s.date];
                                const parsed = raw === undefined || raw === '' ? undefined : Number(raw);
                                onApply([{ date: s.date, price: Number.isFinite(parsed) ? parsed : undefined }]);
                              }}
                            >
                              {t('pricing.suggestions.applyOne')}
                            </Button>
                          </div>
                        )}
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
