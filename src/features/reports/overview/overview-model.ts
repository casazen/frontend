import type { PerformanceQuery, ReportPeriod } from '@/api/reports.api';
import type { ReportSource } from '@/features/reports/report-catalog';
import { presetPeriod, type PeriodPresetId } from '@/features/reports/report-period';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import type { PerformanceGroupBy, PerformanceReport, TrendBucket, TrendUnit } from '@/types/report.types';

type Translate = (key: string) => string;

export type OverviewGrouping = 'all' | 'property' | 'channel' | 'owner';

export interface OverviewState {
  preset: PeriodPresetId;
  custom: ReportPeriod;
  propertyId: string;
  compare: boolean;
  grouping: OverviewGrouping;
}

export function defaultOverviewState(today: string): OverviewState {
  return { preset: 'thisMonth', custom: presetPeriod('thisMonth', today), propertyId: '', compare: true, grouping: 'all' };
}

export function overviewDays(state: Pick<OverviewState, 'preset' | 'custom'>, today: string): ReportPeriod {
  return state.preset === 'custom' ? state.custom : presetPeriod(state.preset, today);
}

export const HOST_PERIOD_SOURCE: ReportSource = { kind: 'host', report: 'revenue-by-property' };

export function groupByOf(grouping: OverviewGrouping): PerformanceGroupBy {
  return grouping === 'property' || grouping === 'channel' ? grouping : 'none';
}

export function overviewQuery(days: ReportPeriod, state: Pick<OverviewState, 'compare' | 'grouping'>, propertyId: string): PerformanceQuery {
  return { ...days, ...(propertyId ? { propertyId } : {}), groupBy: groupByOf(state.grouping), compare: state.compare };
}

export const OVERVIEW_METRICS = ['occupancy', 'revenue', 'adr', 'revPar'] as const;
export type OverviewMetric = (typeof OVERVIEW_METRICS)[number];

export const TREND_METRICS: readonly OverviewMetric[] = ['revenue', 'occupancy', 'adr', 'revPar'];

export interface MetricFigures {
  revenue: number;
  occupancyRate: number | null;
  adr: number | null;
  revPar: number | null;
}

export interface MetricDeltas {
  revenueDeltaPercent: number | null;
  occupancyDeltaPoints: number | null;
  adrDeltaPercent: number | null;
  revParDeltaPercent: number | null;
}

export function metricValue(figures: MetricFigures | null | undefined, metric: OverviewMetric): number | null {
  if (!figures) return null;
  switch (metric) {
    case 'occupancy':
      return figures.occupancyRate;
    case 'revenue':
      return figures.revenue;
    case 'adr':
      return figures.adr;
    case 'revPar':
      return figures.revPar;
  }
}

export function metricDelta(row: MetricDeltas, metric: OverviewMetric): number | null {
  switch (metric) {
    case 'occupancy':
      return row.occupancyDeltaPoints;
    case 'revenue':
      return row.revenueDeltaPercent;
    case 'adr':
      return row.adrDeltaPercent;
    case 'revPar':
      return row.revParDeltaPercent;
  }
}

export interface OverviewFormat {
  money: (value: number) => string;
  moneyExact: (value: number) => string;
  rate: (value: number) => string;
  signedPercent: (value: number) => string;
  signedNumber: (value: number) => string;
}

export function overviewFormat(locale: string, currency: string): OverviewFormat {
  const whole = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  const exact = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  const signed = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero', maximumFractionDigits: 1 });
  return {
    money: (value) => whole.format(value),
    moneyExact: (value) => exact.format(value),
    rate: (value) => percent.format(value),
    signedPercent: (value) => `${signed.format(value)}%`,
    signedNumber: (value) => signed.format(value),
  };
}

export function formatMetric(format: OverviewFormat, metric: OverviewMetric, value: number): string {
  switch (metric) {
    case 'occupancy':
      return format.rate(value);
    case 'revenue':
      return format.money(value);
    case 'adr':
    case 'revPar':
      return format.moneyExact(value);
  }
}

export function labelOf(item: { key: string; label: string }, groupBy: PerformanceGroupBy, t: Translate): string {
  if (item.key === 'total') return t('reports.overview.table.total');
  if (item.key === 'other') return t('reports.overview.table.other');
  return groupBy === 'channel' ? getBookingSourceLabel(item.key, t) : item.label;
}

export function isEmptyPerformance(report: PerformanceReport): boolean {
  return report.total.figures.stayCount === 0 && (report.total.previousYear?.stayCount ?? 0) === 0;
}

export function bucketName(bucket: Pick<TrendBucket, 'from' | 'to'>, unit: TrendUnit, locale: string): string {
  return unit === 'month'
    ? formatStayDate(bucket.from, locale, { month: 'short', year: 'numeric' })
    : `${formatStayDate(bucket.from, locale, { day: 'numeric' })}–${formatStayDate(bucket.to, locale, { day: 'numeric', month: 'short' })}`;
}

export function previousBucketName(bucket: TrendBucket, locale: string): string {
  const { previousYearFrom: from, previousYearTo: to } = bucket;
  if (!from || !to || to < from) return '';
  const day: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${formatStayDate(from, locale, day)}–${formatStayDate(to, locale, day)}`;
}

export function isFutureBucket(bucket: Pick<TrendBucket, 'from'>, today: string): boolean {
  return bucket.from > today;
}

/** The value the tallest bar stands for (never 0, so that a chart of zeros has no division by zero). */
export function chartMax(values: ReadonlyArray<number | null>): number {
  return Math.max(0, ...values.filter((value): value is number => value !== null)) || 1;
}

export function barPercent(value: number | null, max: number): number {
  return value === null ? 0 : (Math.max(value, 0) / max) * 100;
}

const MOST_NAMES = 12;

export function nameStep(count: number): number {
  return Math.max(1, Math.ceil(count / MOST_NAMES));
}
