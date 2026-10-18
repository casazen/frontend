import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { DashboardOverview, DashboardSeriesBucket } from '@/types/dashboard.types';

/** A bar that starts after today is a forecast of the stays already confirmed: it is hatched, never only lighter. */
const FORECAST = 'bg-[repeating-linear-gradient(45deg,var(--color-primary)_0_3px,transparent_3px_6px)] ring-1 ring-inset ring-primary';
/** With more bars than this the values do not fit above them: they stay in the table, and in the tooltip of each bar. */
const MAX_LABELLED = 6;

interface RevenueChartProps {
  series: NonNullable<DashboardOverview['series']>;
  currency: string;
}

/**
 * The one chart of the Home: revenue by week (or by month beyond two months), the period next to the same days of the one
 * before, the value written on the bars and the weeks to come hatched. The bars are drawn for the eye only: the same
 * numbers are in a table for a screen reader.
 */
export function RevenueChart({ series, currency }: RevenueChartProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const locale = i18n.language;
  const { buckets, unit } = series;
  const max = Math.max(1, ...buckets.flatMap((bucket) => [bucket.amount, bucket.previousAmount]));
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const nameOf = (bucket: DashboardSeriesBucket) =>
    unit === 'month'
      ? formatStayDate(bucket.from, locale, { month: 'short', year: 'numeric' })
      : `${formatStayDate(bucket.from, locale, { day: 'numeric' })}–${formatStayDate(bucket.to, locale, { day: 'numeric', month: 'short' })}`;
  const labelled = buckets.length <= MAX_LABELLED;
  const empty = buckets.every((bucket) => bucket.amount === 0 && bucket.previousAmount === 0);
  const title = t(unit === 'month' ? 'dashboard.chart.titleMonth' : 'dashboard.chart.titleWeek');

  return (
    <section aria-labelledby={titleId} data-testid="home-chart" className="min-w-0 space-y-3">
      <h2 id={titleId} className="break-words text-lg font-semibold">
        {title}
      </h2>
      <ul role="list" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/70">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm bg-primary" />
          {t('dashboard.chart.period')}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm bg-foreground/55" />
          {t('dashboard.chart.previous')}
        </li>
        {buckets.some((bucket) => bucket.isFuture) ? (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-sm', FORECAST)} />
            {t('dashboard.chart.forecast')}
          </li>
        ) : null}
      </ul>

      {empty ? (
        <p className="py-6 text-sm text-foreground/70">{t('dashboard.chart.empty')}</p>
      ) : (
        <div aria-hidden="true" className="flex gap-1">
          {buckets.map((bucket) => (
            <div
              key={bucket.label}
              className="flex min-w-0 flex-1 flex-col"
              title={`${nameOf(bucket)}: ${money(bucket.amount)} (${t('dashboard.chart.previous')}: ${money(bucket.previousAmount)})`}
            >
              <div className="flex h-44 items-end justify-center gap-0.5 border-b border-border px-1 pt-6">
                <div className="w-full max-w-6 rounded-t bg-foreground/55" style={{ height: `${(bucket.previousAmount / max) * 100}%`, minHeight: 3 }} />
                <div className={cn('relative w-full max-w-6 rounded-t bg-primary', bucket.isFuture && FORECAST)} style={{ height: `${(bucket.amount / max) * 100}%`, minHeight: 3 }}>
                  {labelled ? (
                    <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">{money(bucket.amount)}</span>
                  ) : null}
                </div>
              </div>
              <span className="break-words px-0.5 pt-1.5 text-center text-xs leading-tight text-foreground/70">{nameOf(bucket)}</span>
            </div>
          ))}
        </div>
      )}

      {/* In a box of its own: a table ignores the 1 px of `sr-only` and would make a phone scroll sideways. */}
      <div className="sr-only">
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">{t('dashboard.chart.period')}</th>
              <th scope="col">{t('dashboard.chart.revenue')}</th>
              <th scope="col">{t('dashboard.chart.previous')}</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket) => (
              <tr key={bucket.label}>
                <th scope="row">
                  {nameOf(bucket)}
                  {bucket.isFuture ? ` (${t('dashboard.chart.forecast')})` : ''}
                </th>
                <td>{money(bucket.amount)}</td>
                <td>{money(bucket.previousAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-foreground/70">{t('dashboard.chart.basis')}</p>
    </section>
  );
}
