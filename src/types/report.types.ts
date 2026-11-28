export type PerformanceGroupBy = 'none' | 'property' | 'channel';

export interface ReportPeriodInfo {
  from: string;
  to: string;
  nights: number;
}

interface PerformanceFigures {
  occupiedNights: number | null;
  availableNights: number | null;
  closedNights: number | null;
  occupancyRate: number | null;
  revenue: number;
  revenueCents: number;
  stayCount: number;
  revenueNights: number;
  adr: number | null;
  adrCents: number | null;
  revPar: number | null;
  revParCents: number | null;
}

type TrendPoint = PerformanceFigures;

export interface PerformanceRow {
  /** A stable key, never text to show: the property id, the booking source (`Direct`, `Airbnb`, ...) or `total`. */
  key: string;
  propertyId: string | null;
  label: string;
  figures: PerformanceFigures;
  previousYear: PerformanceFigures | null;
  revenueDeltaPercent: number | null;
  occupancyDeltaPoints: number | null;
  adrDeltaPercent: number | null;
  revParDeltaPercent: number | null;
  revenueShare: number | null;
}

export interface PerformanceReport {
  title: string;
  basis: string;
  currency: string;
  groupBy: PerformanceGroupBy;
  period: ReportPeriodInfo;
  /** The same calendar days one year earlier; null unless the report compared. */
  comparePeriod: ReportPeriodInfo | null;
  rows: PerformanceRow[];
  total: PerformanceRow;
}

export type TrendUnit = 'week' | 'month';

export interface TrendBucket {
  label: string;
  from: string;
  to: string;
  /** The same days one year earlier; null unless the trend compared. `to` is before `from` when no day is left (29 February). */
  previousYearFrom: string | null;
  previousYearTo: string | null;
}

interface TrendSeries {
  key: string;
  propertyId: string | null;
  label: string;
  points: TrendPoint[];
  /** The same buckets one year earlier, null where there was nothing to compare with; empty unless the trend compared. */
  previousYear: (TrendPoint | null)[];
}

export interface TrendReport {
  title: string;
  basis: string;
  currency: string;
  groupBy: PerformanceGroupBy;
  unit: TrendUnit;
  period: ReportPeriodInfo;
  comparePeriod: ReportPeriodInfo | null;
  buckets: TrendBucket[];
  series: TrendSeries[];
}

export interface WeightedFigures {
  revenue: number;
  revenueCents: number;
  occupiedNights: number;
  availableNights: number;
  closedNights: number;
  occupancyRate: number | null;
  stayCount: number;
  revenueNights: number;
  adr: number | null;
  adrCents: number | null;
  revPar: number | null;
  revParCents: number | null;
}

interface OwnerReportRow {
  ownerId: string | null;
  displayName: string | null;
  propertyCount: number;
  figures: WeightedFigures;
  revenueShare: number | null;
}

export interface OwnerReport {
  title: string;
  basis: string;
  currency: string;
  period: ReportPeriodInfo;
  rows: OwnerReportRow[];
  unassigned: OwnerReportRow;
  total: WeightedFigures;
}
