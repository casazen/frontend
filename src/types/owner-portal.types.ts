import type { BookingStatus } from './booking.types';
import type { ReportPeriodInfo, TrendBucket, TrendUnit, WeightedFigures } from './report.types';

/**
 * Property summary for owner portal (ADR-011-R8): basic property info with occupancy and revenue.
 * Guest data is masked per ADR-011-R3.
 */
export interface OwnerPortalProperty {
  propertyId: string;
  propertyName: string;
  address: string;
  totalBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  recentBookings: OwnerPortalBookingSummary[];
}

/**
 * Booking summary with guest data masked (ADR-011-R3): names NULL, emails NULL, phones NULL.
 * Only dates, channel, and amounts visible.
 */
export interface OwnerPortalBookingSummary {
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  channel: string;
  totalAmount: number;
  status: BookingStatus;
}

// The statements, the invoices and the withholding of the owner come from `owner-portal-operations.types.ts` (the published statement versions and the links of the invoices):
// the old summaries of this file were the shape of endpoints that answered an empty list for every owner, and are gone.

/** How the owner's overview and trend are cut: all the owner's properties together, or one line for each. */
export type OwnerPortalGroupBy = 'none' | 'property';

/** What the owner portal asks `GET /api/owner-portal/overview` and `/trend` (NF-96). */
export interface OwnerPortalReportQuery {
  /** Calendar dates `YYYY-MM-DD` in Europe/Rome, both included, at most 24 months. */
  from: string;
  to: string;
  /** One of the owner's own properties; any other answers 404. */
  propertyId?: string;
  groupBy: OwnerPortalGroupBy;
  /** `compare=previousYear`: the same calendar days one year earlier and the differences, worked out by the server. */
  compare: boolean;
}

/**
 * A property of the owner, or the total: its figures weighted by the share the owner holds, the same days one year earlier and the
 * differences the server worked out. Numbers only: no guest, no other owner.
 */
export interface OwnerPortalRow {
  /** A stable key, never text to show: the property id, or `total`. */
  key: string;
  propertyId: string | null;
  label: string;
  figures: WeightedFigures;
  /** Null when the overview did not compare and when there was nothing to compare with. */
  previousYear: WeightedFigures | null;
  revenueDeltaPercent: number | null;
  occupancyDeltaPoints: number | null;
  adrDeltaPercent: number | null;
  revParDeltaPercent: number | null;
  revenueShare: number | null;
}

/** `GET /api/owner-portal/overview`: the owner's properties on the Home's numbers (NF-96). */
export interface OwnerPortalOverview {
  title: string;
  /** Always `accrual`. */
  basis: string;
  currency: string;
  groupBy: OwnerPortalGroupBy;
  period: ReportPeriodInfo;
  comparePeriod: ReportPeriodInfo | null;
  /** A row for each property of the owner; none unless cut by property. */
  rows: OwnerPortalRow[];
  /** All the owner's properties together. */
  total: OwnerPortalRow;
}

/** One line of the owner's trend: one entry for each bucket, in order. */
export interface OwnerPortalSeries {
  key: string;
  propertyId: string | null;
  label: string;
  points: WeightedFigures[];
  /** The same buckets one year earlier, null where there was nothing to compare with; empty unless the trend compared. */
  previousYear: (WeightedFigures | null)[];
}

/** `GET /api/owner-portal/trend`: the same weeks or months as the host's trend, for the owner's properties. */
export interface OwnerPortalTrend {
  title: string;
  basis: string;
  currency: string;
  groupBy: OwnerPortalGroupBy;
  unit: TrendUnit;
  period: ReportPeriodInfo;
  comparePeriod: ReportPeriodInfo | null;
  buckets: TrendBucket[];
  series: OwnerPortalSeries[];
}
