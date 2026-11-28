import type { BookingStatus } from './booking.types';
import type { ReportPeriodInfo, TrendBucket, TrendUnit, WeightedFigures } from './report.types';

export interface OwnerPortalProperty {
  propertyId: string;
  propertyName: string;
  address: string;
  totalBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  recentBookings: OwnerPortalBookingSummary[];
}

interface OwnerPortalBookingSummary {
  bookingId: string;
  checkInDate: string;
  checkOutDate: string;
  channel: string;
  totalAmount: number;
  status: BookingStatus;
}

type OwnerPortalGroupBy = 'none' | 'property';

export interface OwnerPortalReportQuery {
  from: string;
  to: string;
  propertyId?: string;
  groupBy: OwnerPortalGroupBy;
  compare: boolean;
}

interface OwnerPortalRow {
  key: string;
  propertyId: string | null;
  label: string;
  figures: WeightedFigures;
  previousYear: WeightedFigures | null;
  revenueDeltaPercent: number | null;
  occupancyDeltaPoints: number | null;
  adrDeltaPercent: number | null;
  revParDeltaPercent: number | null;
  revenueShare: number | null;
}

export interface OwnerPortalOverview {
  title: string;
  basis: string;
  currency: string;
  groupBy: OwnerPortalGroupBy;
  period: ReportPeriodInfo;
  comparePeriod: ReportPeriodInfo | null;
  /** A row for each property of the owner; none unless cut by property. */
  rows: OwnerPortalRow[];
  total: OwnerPortalRow;
}

interface OwnerPortalSeries {
  key: string;
  propertyId: string | null;
  label: string;
  points: WeightedFigures[];
  /** The same buckets one year earlier, null where there was nothing to compare with; empty unless the trend compared. */
  previousYear: (WeightedFigures | null)[];
}

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
