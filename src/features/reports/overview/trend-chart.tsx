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

/** A bar that starts after today is a forecast of the stays already confirmed: it is hatched, never only lighter. */
const FORECAST = 'bg-[repeating-linear-gradient(45deg,var(--color-primary)_0_3px,transparent_3px_6px)] ring-1 ring-inset ring-primary';
/** With more bars than this the values do not fit above them: they stay in the table, and in the tooltip of each bar. */
const MAX_LABELLED = 6;

/** One line of a trend: one entry for each bucket, in order, and the same buckets one year earlier where there is something to compare. */
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
  /** The trend was asked next to the year before: the bars of the year before are drawn, a missing one is "n.d.". */
  compared: boolean;
  /** How the lines are cut, to say why a number does not exist (a channel has no occupancy) and what the lines are called. */
  groupBy?: PerformanceGroupBy;
  /** The name of the block; by default the Reports page's ("Andamento per settimana"). */
  title?: string;
  /** The level of the heading of the block: `h2` where the chart is a section of its own, `h3` inside the overview. */
  titleAs?: 'h2' | 'h3';
  /** Today in Europe/Rome; the weeks that start after it are the forecast. */
  today?: string;
  testId?: string;
}

/**
 * The trend of the overview (NF-96): the bars of the Home's chart for any of the four numbers, each week or month next to the same
 * one a year earlier, the weeks to come hatched. The bars are drawn for the eye only: the same numbers are in a table for a screen
 * reader. With more than one line (by property or by channel) one is shown at a time, chosen from a list. CSS only, no charting
 * library; every number is the server's and only its bar is scaled to the tallest of the chart.
 */
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
  const [metric, setMetric] = useState<OverviewMetric>('revenue');
  const [seriesKey, setSeriesKey] = useState('');
  const format = useMemo(() => overviewFormat(locale, currency), [locale, currency]);

  // A line that is no longer there (the cut changed) leaves the first one: derived, nothing to reset.
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
    <section aria-labelledby={titleId} data-testid={testId} className="min-w-0 space-y-3">
      <Heading id={titleId} className="break-words text-lg font-semibold">
        {heading}
      </Heading>

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

      {/* In a box of its own: a table ignores the 1 px of `sr-only` and would make a phone scroll sideways. */}
      <div className="sr-only">
        <table data-testid={`${testId}-table`}>
          <caption>{`${heading} · ${lineName} · ${metricName}`}</caption>
          <thead>
            <tr>
              <th scope="col">{t('reports.overview.trend.period')}</th>
              <th scope="col">{metricName}</th>
              {compared ? <th scope="col">{t('reports.overview.trend.previousYear')}</th> : null}
            </tr>
          </thead>
          <tbody>
            {buckets.map((bucket, index) => {
              const before = previousBucketName(bucket, locale);
              return (
                <tr key={bucket.label}>
                  <th scope="row">
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
