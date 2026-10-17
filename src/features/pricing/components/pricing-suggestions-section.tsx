import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PlainSection } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import type { SeasonalSuggestionsResponse } from '@/types';
import { ruleLabel } from '../seasonal-rules';

/** The nights the list shows before "Mostra tutte": the next week. The chart always shows them all. */
const FIRST_NIGHTS = 7;

const AXIS_PRICE = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

interface PricingSuggestionsSectionProps {
  data: SeasonalSuggestionsResponse;
  applying?: boolean;
  onApply?: (items: { date: string; price?: number | null }[]) => void;
}

/**
 * The suggested price of the coming nights (D4): proposals until the host confirms them. A line for the whole stretch, then
 * the nights one by one with the rule that gave each price; the host can apply the suggested price of a night as it is or
 * type another one. Confirmed (optionally edited) prices are used in quotes. No box around any of it.
 */
export function PricingSuggestionsSection({ data, applying, onApply }: PricingSuggestionsSectionProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const items = data.items;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, FIRST_NIGHTS);
  const thisYear = todayInRome().slice(0, 4);

  const chartData = items.map((s) => ({
    date: s.date,
    suggested: s.suggestedPrice,
    base: s.basePrice,
    label: formatDate(s.date, 'dd/MM'),
  }));

  const shortDay = (date: string) =>
    formatStayDate(
      date,
      language,
      date.startsWith(thisYear) ? { weekday: 'short', day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
    );

  return (
    <PlainSection title={t('pricing.suggestions.chartTitle', { count: items.length })} data-testid="pricing-suggestions">
      <div className="space-y-6 pt-2">
        {data.computedAt && (
          <p className="text-sm text-foreground/70" data-testid="computed-at">
            {t('pricing.suggestions.computedAt', { date: formatDateTime(data.computedAt) })}
          </p>
        )}

        {/* The same prices are in the list below: the picture is not read out. */}
        <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 5 }} accessibilityLayer={false}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={32} />
              <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={(value: number) => AXIS_PRICE.format(value)} />
              <Tooltip
                formatter={(value, name) => [
                  formatCurrency(typeof value === 'number' ? value : 0),
                  name === 'suggested' ? t('pricing.suggestions.suggested') : t('pricing.suggestions.base'),
                ]}
                labelFormatter={(label) => `${t('pricing.suggestions.date')}: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="suggested"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="suggested"
              />
              <Line
                type="monotone"
                dataKey="base"
                stroke="var(--color-muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
                name="base"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-2">
          <h3 className="text-base font-semibold">{t('pricing.suggestions.details')}</h3>
          {/* A table on a computer; on a phone each night is a block of its own (the header stays for screen readers). */}
          <table className="w-full text-sm max-md:block" data-testid="suggestions-table">
            <thead className="max-md:sr-only">
              <tr className="text-left text-foreground/70">
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('pricing.suggestions.date')}
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  {t('pricing.suggestions.suggested')}
                </th>
                <th scope="col" className="py-2 pr-4 font-medium">
                  {t('pricing.suggestions.rule')}
                </th>
                <th scope="col" className="py-2 font-medium">
                  {t('pricing.suggestions.applied')}
                </th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {visible.map((s) => {
                const longDay = formatStayDate(s.date, language);
                return (
                  <tr
                    key={s.date}
                    className="border-t max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-x-4 max-md:gap-y-1 max-md:py-3"
                  >
                    <td className="py-3 pr-4 text-foreground/70 max-md:col-start-1 max-md:row-start-1 max-md:p-0">{shortDay(s.date)}</td>
                    <td className="py-3 pr-4 text-right font-semibold tabular-nums max-md:col-start-2 max-md:row-start-1 max-md:p-0">
                      {formatCurrency(s.suggestedPrice)}
                    </td>
                    <td className="py-3 pr-4 text-foreground/70 max-md:col-span-2 max-md:p-0">{ruleLabel(s, t, language)}</td>
                    <td className="py-3 max-md:col-span-2 max-md:p-0">
                      {s.appliedPrice != null ? (
                        <p className="mb-1 text-foreground/70">
                          {t('pricing.suggestions.applied')}:{' '}
                          <span className="font-medium tabular-nums text-foreground">{formatCurrency(s.appliedPrice)}</span>
                        </p>
                      ) : null}
                      {onApply && (
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            className="w-28 pointer-coarse:min-h-11"
                            data-testid={`seasonal-edit-${s.date}`}
                            placeholder={String(s.suggestedPrice)}
                            aria-label={t('pricing.suggestions.priceFor', { date: longDay })}
                            value={edits[s.date] ?? ''}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [s.date]: e.target.value }))}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={applying}
                            aria-label={`${t('pricing.suggestions.applyOne')}: ${longDay}`}
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
          {visible.length < items.length ? (
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setShowAll(true)}>
              {t('pricing.suggestions.showAll', { count: items.length })}
            </Button>
          ) : null}
        </div>
      </div>
    </PlainSection>
  );
}
