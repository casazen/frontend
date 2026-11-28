import { ChartNoAxesColumn, ChevronDown, Table2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatStayDate } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { DashboardOverview, DashboardSeriesBucket } from '@/types/dashboard.types';

const FORECAST = 'bg-[repeating-linear-gradient(45deg,var(--color-primary)_0_3px,transparent_3px_6px)] ring-1 ring-inset ring-primary';
const MAX_LABELLED = 6;

interface RevenueChartProps {
  series: NonNullable<DashboardOverview['series']>;
  currency: string;
}

export function RevenueChart({ series, currency }: RevenueChartProps) {
  const { t, i18n } = useTranslation();
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
    <details data-testid="home-chart" className="group/chart min-w-0 rounded-[var(--cz-radius-panel)] border bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-[var(--cz-radius-panel)] px-4 py-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChartNoAxesColumn aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
        <span className="min-w-0 flex-1 wrap-anywhere">{title}</span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open/chart:rotate-180" />
      </summary>
      <div className="space-y-4 border-t p-4 sm:p-5">
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

        <details className="group rounded-lg border bg-background">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary-text focus-visible:outline-2 focus-visible:outline-ring">
            <Table2 aria-hidden="true" className="size-4" />
            {t('dashboard.chart.revenue')}
          </summary>
          <div className="overflow-x-auto border-t">
            <table className="w-full text-left text-sm tabular-nums [&_th]:p-2 [&_td]:p-2">
              <caption className="sr-only">{title}</caption>
              <thead className="bg-muted text-foreground">
                <tr>
                  <th scope="col">{t('dashboard.chart.period')}</th>
                  <th scope="col">{t('dashboard.chart.revenue')}</th>
                  <th scope="col">{t('dashboard.chart.previous')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
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
        </details>
        <p className="text-sm text-foreground/70">{t('dashboard.chart.basis')}</p>
      </div>
    </details>
  );
}
