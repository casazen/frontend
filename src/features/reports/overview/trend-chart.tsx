import { Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import type { PerformanceGroupBy, TrendBucket, TrendUnit } from '@/types/report.types';
import {
  TREND_METRICS,
  barPercent,
  bucketName,
  chartMax,
  formatMetric,
  isFutureBucket,
  labelOf,
  metricValue,
  nameStep,
  overviewFormat,
  previousBucketName,
  type MetricFigures,
  type OverviewMetric,
} from './overview-model';

const FORECAST = 'bg-[repeating-linear-gradient(45deg,var(--color-primary)_0_3px,transparent_3px_6px)] ring-1 ring-inset ring-primary';
const MAX_LABELLED = 6;

export interface TrendChartSeries {
  key: string;
  label: string;
  points: readonly (MetricFigures | null)[];
  previousYear: readonly (MetricFigures | null)[];
}

interface TrendChartProps {
  unit: TrendUnit;
  buckets: readonly TrendBucket[];
  series: readonly TrendChartSeries[];
  currency: string;
  compared: boolean;
  groupBy?: PerformanceGroupBy;
  title?: string;
  titleAs?: 'h2' | 'h3';
  today?: string;
  testId?: string;
}

export function TrendChart({
  unit,
  buckets,
  series,
  currency,
  compared,
  groupBy = 'none',
  title,
  titleAs: Heading = 'h3',
  today = todayInRome(),
  testId = 'reports-trend',
}: TrendChartProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const titleId = useId();
  const tableId = useId();
  const [showTable, setShowTable] = useState(false);
  const [metric, setMetric] = useState<OverviewMetric>('revenue');
  const [seriesKey, setSeriesKey] = useState('');
  const format = useMemo(() => overviewFormat(locale, currency), [locale, currency]);

  const line = series.find((item) => item.key === seriesKey) ?? series[0];
  const heading = title ?? t(unit === 'month' ? 'reports.overview.trend.titleMonth' : 'reports.overview.trend.titleWeek');
  const na = t('reports.overview.na');
  const metricName = t(`reports.overview.trend.metric.${metric}`);
  const lineName = line ? labelOf(line, groupBy, t) : '';

  const current = buckets.map((_, index) => metricValue(line?.points[index], metric));
  const previous = buckets.map((_, index) => (compared ? metricValue(line?.previousYear[index], metric) : null));
  const max = chartMax([...current, ...previous]);
  const nothingToDraw = [...current, ...previous].every((value) => value === null || value === 0);
  const channelMetric = groupBy === 'channel' && (metric === 'occupancy' || metric === 'revPar');
  const labelled = buckets.length <= MAX_LABELLED;
  const step = nameStep(buckets.length);
  const written = (value: number | null) => (value === null ? na : formatMetric(format, metric, value));
  const hasForecast = buckets.some((bucket) => isFutureBucket(bucket, today));

  return (
    <section aria-labelledby={titleId} data-testid={testId} className="min-w-0 space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Heading id={titleId} className="break-words text-lg font-semibold">{heading}</Heading>
        <Button type="button" variant="outline" size="sm" aria-controls={tableId} aria-pressed={showTable} onClick={() => setShowTable(!showTable)}>
          <Table2 aria-hidden="true" className="size-4" />
          {t('listView.layout.list')}
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Segmented<OverviewMetric>
          label={t('reports.overview.trend.metricLabel')}
          options={TREND_METRICS.map((id) => ({ value: id, label: t(`reports.overview.trend.metric.${id}`), testId: `${testId}-metric-${id}` }))}
          value={metric}
          onValueChange={setMetric}
        />
        {series.length > 1 ? (
          <Select
            size="sm"
            aria-label={t(groupBy === 'channel' ? 'reports.overview.trend.series.channel' : 'reports.overview.trend.series.property')}
            data-testid={`${testId}-series`}
            wrapperClassName="w-full sm:w-60"
            value={line?.key ?? ''}
            onChange={(event) => setSeriesKey(event.target.value)}
          >
            {series.map((item) => (
              <option key={item.key} value={item.key}>
                {labelOf(item, groupBy, t)}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      <ul role="list" className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground/70">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm bg-primary" />
          {t('reports.overview.trend.period')}
        </li>
        {compared ? (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-sm bg-foreground/55" />
            {t('reports.overview.trend.previousYear')}
          </li>
        ) : null}
        {hasForecast ? (
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-3 rounded-sm', FORECAST)} />
            {t('reports.overview.trend.forecast')}
          </li>
        ) : null}
      </ul>

      {channelMetric || nothingToDraw ? (
        <p className="py-6 text-sm text-foreground/70" data-testid={`${testId}-empty`}>
          {t(channelMetric ? 'reports.overview.trend.noChannelMetric' : 'reports.overview.trend.empty')}
        </p>
      ) : (
        <div aria-hidden="true" className="flex gap-1">
          {buckets.map((bucket, index) => {
            const value = current[index];
            const before = previous[index];
            const future = isFutureBucket(bucket, today);
            const name = bucketName(bucket, unit, locale);
            return (
              <div
                key={bucket.label}
                className="flex min-w-0 flex-1 flex-col"
                title={`${name}: ${written(value)}${compared ? ` (${t('reports.overview.trend.previousYear')}: ${written(before)})` : ''}`}
              >
                <div className="flex h-44 items-end justify-center gap-0.5 border-b border-border px-1 pt-6">
                  {compared ? (
                    <div
                      className="w-full max-w-6 rounded-t bg-foreground/55"
                      style={{ height: `${barPercent(before, max)}%`, minHeight: before === null ? 0 : 3 }}
                    />
                  ) : null}
                  <div
                    className={cn('relative w-full max-w-6 rounded-t bg-primary', future && FORECAST)}
                    style={{ height: `${barPercent(value, max)}%`, minHeight: value === null ? 0 : 3 }}
                  >
                    {labelled && value !== null ? (
                      <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-xs font-semibold tabular-nums text-foreground">
                        {written(value)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="break-words px-0.5 pt-1.5 text-center text-xs leading-tight text-foreground/70">{index % step === 0 ? name : ''}</span>
              </div>
            );
          })}
        </div>
      )}

      <div id={tableId} className={showTable ? 'max-h-96 overflow-auto rounded-xl border' : 'sr-only'}>
        <table className="w-full border-collapse text-sm [&_td]:px-3 [&_td]:py-2 [&_td]:text-right [&_td]:tabular-nums [&_th]:px-3 [&_th]:py-2 [&_tr]:border-b" data-testid={`${testId}-table`}>
          <caption className="sr-only">{`${heading} · ${lineName} · ${metricName}`}</caption>
          <thead className="sticky top-0 bg-surface-2 text-right text-xs text-foreground/80">
            <tr>
              <th scope="col" className="text-left">{t('reports.overview.trend.period')}</th>
              <th scope="col">{metricName}</th>
              {compared ? <th scope="col">{t('reports.overview.trend.previousYear')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, index) => {
              const before = previousBucketName(bucket, locale);
              return (
                <tr key={bucket.label}>
                  <th scope="row" className="text-left font-medium">
                    {bucketName(bucket, unit, locale)}
                    {isFutureBucket(bucket, today) ? ` (${t('reports.overview.trend.forecast')})` : ''}
                  </th>
                  <td>{written(current[index])}</td>
                  {compared ? (
                    <td>
                      {before ? `${before}: ` : ''}
                      {written(previous[index])}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
