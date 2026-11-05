import type { PerformanceQuery, ReportPeriod } from '@/api/reports.api';
import type { ReportSource } from '@/features/reports/report-catalog';
import { PERIOD_PRESETS, presetPeriod, type PeriodPresetId } from '@/features/reports/report-period';
import { getBookingSourceLabel } from '@/lib/i18n-labels';
import { formatStayDate } from '@/lib/stay-dates';
import type { PerformanceGroupBy, PerformanceReport, TrendBucket, TrendUnit } from '@/types/report.types';

/**
 * Pure helpers of the overview of the Reports page and of the owner portal (NF-96): which days and which query a choice of filters
 * stands for, how a number is written in the language of the app, how a bar is drawn. The numbers are the server's: nothing here adds,
 * averages or compares an amount (the only division is the height of a bar against the tallest one, which is layout).
 */

type Translate = (key: string) => string;

/** How the overview is cut: all together, by property or by channel (the server's cuts) and, for an agency, by property owner. */
export type OverviewGrouping = 'all' | 'property' | 'channel';

/** What the filters of the overview hold. */
export interface OverviewState {
  preset: PeriodPresetId;
  /** The days typed when `preset` is `custom`. */
  custom: ReportPeriod;
  /** One property, or an empty string for the whole scope. */
  propertyId: string;
  /** Next to the same days one year earlier. */
  compare: boolean;
  grouping: OverviewGrouping;
}

/** This month against the same days of last year, all the properties together: what the Home shows, with the year before. */
export function defaultOverviewState(today: string): OverviewState {
  return { preset: 'thisMonth', custom: presetPeriod('thisMonth', today), propertyId: '', compare: true, grouping: 'all' };
}

/** The days a choice of period stands for (`today` is a day in Europe/Rome). */
export function overviewDays(state: Pick<OverviewState, 'preset' | 'custom'>, today: string): ReportPeriod {
  return state.preset === 'custom' ? state.custom : presetPeriod(state.preset, today);
}

/** The periods that need no typing: what the owner portal offers. */
export const FIXED_PRESETS = PERIOD_PRESETS.filter((id): id is Exclude<PeriodPresetId, 'custom'> => id !== 'custom');

/** The overview is a read of short rent: no fiscal rule applies to its days, only the ones of every report (24 months at most). */
export const HOST_PERIOD_SOURCE: ReportSource = { kind: 'host', report: 'revenue-by-property' };

/** The cut the server is asked for. */
export function groupByOf(grouping: OverviewGrouping): PerformanceGroupBy {
  return grouping === 'all' ? 'none' : grouping;
}

/** The question the performance report and the trend are asked for these days and filters (`propertyId` already checked). */
export function overviewQuery(days: ReportPeriod, state: Pick<OverviewState, 'compare' | 'grouping'>, propertyId: string): PerformanceQuery {
  return { ...days, ...(propertyId ? { propertyId } : {}), groupBy: groupByOf(state.grouping), compare: state.compare };
}

/** The four numbers of the overview, in the order of its tiles and its table. */
export const OVERVIEW_METRICS = ['occupancy', 'revenue', 'adr', 'revPar'] as const;
export type OverviewMetric = (typeof OVERVIEW_METRICS)[number];

/** The same four numbers in the order of the switch of the trend: revenue first, the way the Home counts. */
export const TREND_METRICS: readonly OverviewMetric[] = ['revenue', 'occupancy', 'adr', 'revPar'];

/** What a chart can draw of a cut: the same four numbers, whoever sends them (a property, a channel, an owner's share). */
export interface MetricFigures {
  revenue: number;
  occupancyRate: number | null;
  adr: number | null;
  revPar: number | null;
}

/** The differences from the year before that the server worked out for a row. */
export interface MetricDeltas {
  revenueDeltaPercent: number | null;
  occupancyDeltaPoints: number | null;
  adrDeltaPercent: number | null;
  revParDeltaPercent: number | null;
}

/** One of the four numbers of a cut, null where it does not exist (and for no cut at all). */
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

/** The difference from the year before of one of the four numbers: percentage points for the occupancy, percent for the others. */
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

/** How the numbers are written in the language of the app. */
export interface OverviewFormat {
  /** Whole euros: `1.235 €`. */
  money: (value: number) => string;
  /** Euros and cents: `89,50 €` (a rate per night is read to the cent). */
  moneyExact: (value: number) => string;
  /** A rate from 0 to 1: `87%`. */
  rate: (value: number) => string;
  /** A difference in percent with its sign: `+6,5%`. */
  signedPercent: (value: number) => string;
  /** A difference in points with its sign: `+3,5`. */
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

/** A number of the overview written as it is shown: the occupancy as a rate, the revenue in whole euros, ADR and RevPAR to the cent. */
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

/** The name of a row or a line: the total and the rest have their words, a channel its usual name, a property the name it has. */
export function labelOf(item: { key: string; label: string }, groupBy: PerformanceGroupBy, t: Translate): string {
  if (item.key === 'total') return t('reports.overview.table.total');
  if (item.key === 'other') return t('reports.overview.table.other');
  return groupBy === 'channel' ? getBookingSourceLabel(item.key, t) : item.label;
}

/** Nothing to compare and nothing earned: the figures would be a wall of zeros, so the page says so instead. */
export function isEmptyPerformance(report: PerformanceReport): boolean {
  return report.total.figures.stayCount === 0 && (report.total.previousYear?.stayCount ?? 0) === 0;
}

/** A week (`7–13 nov`) or a month (`nov 2026`), as the chart of the Home names them. */
export function bucketName(bucket: Pick<TrendBucket, 'from' | 'to'>, unit: TrendUnit, locale: string): string {
  return unit === 'month'
    ? formatStayDate(bucket.from, locale, { month: 'short', year: 'numeric' })
    : `${formatStayDate(bucket.from, locale, { day: 'numeric' })}–${formatStayDate(bucket.to, locale, { day: 'numeric', month: 'short' })}`;
}

/** The days of the year before that a bucket is compared with (`7 nov 2025–13 nov 2025`), or an empty string when it has none. */
export function previousBucketName(bucket: TrendBucket, locale: string): string {
  const { previousYearFrom: from, previousYearTo: to } = bucket;
  if (!from || !to || to < from) return '';
  const day: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  return `${formatStayDate(from, locale, day)}–${formatStayDate(to, locale, day)}`;
}

/** A bucket that starts after today is a forecast of the stays already confirmed: it is hatched, never only lighter. */
export function isFutureBucket(bucket: Pick<TrendBucket, 'from'>, today: string): boolean {
  return bucket.from > today;
}

/** The value the tallest bar stands for (never 0, so that a chart of zeros has no division by zero). */
export function chartMax(values: ReadonlyArray<number | null>): number {
  return Math.max(0, ...values.filter((value): value is number => value !== null)) || 1;
}

/** The height of a bar against the tallest one, in percent; a number that does not exist has no bar. */
export function barPercent(value: number | null, max: number): number {
  return value === null ? 0 : (Math.max(value, 0) / max) * 100;
}

/** More bars than this and the names under them would overlap: every other one (or third) is written, all stay in the table. */
const MOST_NAMES = 12;

/** Every how many bars a name is written under them. */
export function nameStep(count: number): number {
  return Math.max(1, Math.ceil(count / MOST_NAMES));
}
