/**
 * The reports of the Home's numbers (NF-96): `GET /api/reports/performance`, `GET /api/reports/trend` and `GET /api/reports/by-owner`.
 * Field for field the JSON of the backend (`HostPerformanceReportDtos.cs`, `OwnerReportDtos.cs`). Every amount, every rate and every
 * difference is worked out by the server and shown as it comes: the browser works out none of them.
 */

/** How the performance report and the trend are cut: the whole scope only, by property or by booking channel. */
export type PerformanceGroupBy = 'none' | 'property' | 'channel';

/** The days a report covers (`period`) or is compared with (`comparePeriod`): Europe/Rome calendar dates, both included. */
export interface ReportPeriodInfo {
  from: string;
  to: string;
  nights: number;
}

/**
 * The figures of one cut of a period. A channel has no nights (they belong to a property), so for a channel the night figures, the
 * occupancy and the RevPAR are null. Amounts are euros to the cent, also given as cents.
 */
export interface PerformanceFigures {
  occupiedNights: number | null;
  availableNights: number | null;
  closedNights: number | null;
  /** Occupied over available nights, from 0 to 1; null when nothing is available and for a channel. */
  occupancyRate: number | null;
  revenue: number;
  revenueCents: number;
  stayCount: number;
  /** The nights of the confirmed stays that fall in the period: what the revenue is pro rata of. */
  revenueNights: number;
  /** Average daily rate: revenue over `revenueNights`; null without a night, never 0. */
  adr: number | null;
  adrCents: number | null;
  /** Revenue per available night; null when nothing is available and for a channel, never 0. */
  revPar: number | null;
  revParCents: number | null;
}

/** One figure of one bucket of a trend. */
export type TrendPoint = PerformanceFigures;

/** A property, a channel or the total: its figures, the same days one year earlier and the differences the server worked out. */
export interface PerformanceRow {
  /** A stable key, never text to show: the property id, the booking source (`Direct`, `Airbnb`, ...) or `total`. */
  key: string;
  propertyId: string | null;
  /** The name of the property; for any other row the same as `key`. */
  label: string;
  figures: PerformanceFigures;
  /** The same calendar days one year earlier; null when the report did not compare and when there was nothing to compare with. */
  previousYear: PerformanceFigures | null;
  /** Percent to one decimal; null without a year before or with none of its revenue. */
  revenueDeltaPercent: number | null;
  /** Percentage points to one decimal; null when either year has no rate. */
  occupancyDeltaPoints: number | null;
  /** Percent to one decimal; null when either year has none. */
  adrDeltaPercent: number | null;
  /** Percent to one decimal; null when either year has none. */
  revParDeltaPercent: number | null;
  /** The part of the revenue of the whole scope this row has, from 0 to 1; null when the scope had no revenue. */
  revenueShare: number | null;
}

/** `GET /api/reports/performance`. */
export interface PerformanceReport {
  /** The name of the report with its base (Italian, the one of the file). */
  title: string;
  /** Always `accrual`: the nights of the confirmed stays, whenever the money came in. */
  basis: string;
  currency: string;
  groupBy: PerformanceGroupBy;
  period: ReportPeriodInfo;
  /** The same calendar days one year earlier; null unless the report compared. */
  comparePeriod: ReportPeriodInfo | null;
  /** A row for each property or channel, in the order the server sends them; none for `groupBy` `none`. */
  rows: PerformanceRow[];
  /** The whole scope, as the Home gives it for the same days. */
  total: PerformanceRow;
}

/** The size of the buckets of a trend: ISO weeks from Monday, or months. */
export type TrendUnit = 'week' | 'month';

/** A week or a month of a trend and the days it is compared with. */
export interface TrendBucket {
  /** A stable key, never text to show: the ISO week (`2026-W42`) or the month (`2026-10`). */
  label: string;
  /** First and last night of the bucket (both included). */
  from: string;
  to: string;
  /** The same days one year earlier; null unless the trend compared. `to` is before `from` when no day is left (29 February). */
  previousYearFrom: string | null;
  previousYearTo: string | null;
}

/** One line of a trend: one entry for each bucket, in order. */
export interface TrendSeries {
  /** A stable key: the property id, the booking source, `total` or `other` (the lines beyond the 25th, summed). */
  key: string;
  propertyId: string | null;
  label: string;
  points: TrendPoint[];
  /** The same buckets one year earlier, null where there was nothing to compare with; empty unless the trend compared. */
  previousYear: (TrendPoint | null)[];
}

/** `GET /api/reports/trend`. */
export interface TrendReport {
  title: string;
  basis: string;
  currency: string;
  groupBy: PerformanceGroupBy;
  unit: TrendUnit;
  period: ReportPeriodInfo;
  comparePeriod: ReportPeriodInfo | null;
  buckets: TrendBucket[];
  /** The lines, the one with most revenue first. */
  series: TrendSeries[];
}

/**
 * The figures of a cut weighted by an ownership share (agency and owner views): the nights and the stays can be fractions when a house
 * is shared. ADR, RevPAR and the occupancy are worked out by the server from the weighted values.
 */
export interface WeightedFigures {
  revenue: number;
  revenueCents: number;
  occupiedNights: number;
  availableNights: number;
  closedNights: number;
  /** Occupied over available nights, from 0 to 1; null when nothing is available. */
  occupancyRate: number | null;
  stayCount: number;
  revenueNights: number;
  adr: number | null;
  adrCents: number | null;
  revPar: number | null;
  revParCents: number | null;
}

/** An owner of the agency (or the properties nobody owns) with its weighted figures. Never a fiscal code, an IBAN, an e-mail or a phone. */
export interface OwnerReportRow {
  /** The owner of the registry; null for the row of the properties nobody owns. */
  ownerId: string | null;
  /** First and last name, or the anonymized label of the server; null for the row of the properties nobody owns. */
  displayName: string | null;
  /** The properties of the report the owner holds a part of in the period. */
  propertyCount: number;
  figures: WeightedFigures;
  revenueShare: number | null;
}

/** `GET /api/reports/by-owner`: the agency's properties cut by property owner, owners and unassigned adding up to the total. */
export interface OwnerReport {
  title: string;
  basis: string;
  currency: string;
  period: ReportPeriodInfo;
  rows: OwnerReportRow[];
  unassigned: OwnerReportRow;
  total: WeightedFigures;
}
