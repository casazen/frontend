import type { BookingStatus } from './booking.types';
import type { PropertyIcalFeedChannel, PropertyIcalImportStatus } from './property-ical';

/** Period of the host dashboard KPIs (backend `HostDashboardPeriodKind`). */
export type DashboardPeriodKind = 'Month' | 'Last30Days';

/** Period chosen in the dashboard: the current month, a month (`yyyy-MM`) or the last 30 days. */
export type DashboardPeriodSelection =
  | { kind: 'Month'; month?: string }
  | { kind: 'Last30Days' };

/** A stay listed by the dashboard; dates are Europe/Rome calendar dates (`yyyy-MM-dd`). */
export interface DashboardStay {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: BookingStatus;
  totalPrice: number;
  createdAt: string;
}

/** `count` covers every stay; `items` only the first ones. */
export interface DashboardStayList {
  count: number;
  items: DashboardStay[];
}

/**
 * KPIs of `GET /api/dashboard/kpis` (PC-16), computed on the server for the period: occupancy = occupied / available
 * property-nights (a night closed by a manual block leaves the availability), revenue of the confirmed stays pro rata
 * per night without tourist tax, today's arrivals and departures in Europe/Rome, upcoming confirmed check-ins.
 */
export interface DashboardKpis {
  period: { kind: DashboardPeriodKind; from: string; to: string; nights: number };
  today: string;
  propertyCount: number;
  occupancy: {
    occupiedNights: number;
    availableNights: number;
    closedNights: number;
    /** 0..1; null when nothing is available. */
    rate: number | null;
  };
  revenue: { amount: number; currency: string; stayCount: number };
  arrivalsToday: DashboardStayList;
  departuresToday: DashboardStayList;
  upcomingCheckIns: DashboardStayList;
  recentBookings: DashboardStay[];
}

/** One iCal import feed of `GET /api/dashboard/ical-feeds` (never its URL). */
export interface DashboardIcalFeed {
  feedId: string;
  propertyId: string;
  propertyName: string;
  channel: PropertyIcalFeedChannel;
  label?: string | null;
  lastImportAt?: string | null;
  lastImportStatus?: PropertyIcalImportStatus | null;
  /** Stable code of the last sync error, translated by the frontend (`apiErrors.codes.*`). */
  lastErrorCode?: string | null;
  /** Backend-localized text of `lastErrorCode`, used only when the frontend has no translation for the code. */
  lastError?: string | null;
}
