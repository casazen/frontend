import type { PropertyIcalFeedChannel, PropertyIcalImportStatus } from './property-ical';

/**
 * What the Home of Affitti brevi asks `GET /api/dashboard/overview` (SR-03b): a named period or the days of a free one
 * (`Custom`, at most 366, both included), for the whole scope or for one property of it.
 */
export type DashboardOverviewQuery = { propertyId?: string } & (
  | { period: 'Month' | 'Last30Days' }
  | { period: 'Custom'; from: string; to: string }
);

/** Occupied / available nights of a period; `rate` is 0..1 (null when nothing is available), `deltaPoints` the difference from the period before in percentage points. */
export interface DashboardOccupancy {
  occupiedNights: number;
  availableNights: number;
  closedNights: number;
  rate: number | null;
  deltaPoints?: number | null;
}

/** Revenue by accrual (the nights of the confirmed stays). Absent for whoever may not read payments (SR-D7). */
export interface DashboardRevenue {
  amount: number;
  currency: string;
  stayCount: number;
  /** Percent to one decimal, null when the period before had no revenue. */
  deltaPercent?: number | null;
}

/** An arrival to come: no money, only who comes and when. */
export interface DashboardArrival {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  numberOfGuests: number;
  checkInDate: string;
  checkOutDate: string;
  awaitingApproval: boolean;
}

/** A bar of the chart: ISO week (`2026-W42`) or month (`2026-10`) as a key, its first and last night, and the same days of the period before. */
export interface DashboardSeriesBucket {
  label: string;
  from: string;
  to: string;
  amount: number;
  previousAmount: number;
  /** The bar starts after today: what is there is a forecast. */
  isFuture: boolean;
}

/** `GET /api/dashboard/overview`: the numbers of the Home for a period, compared with the one before (dates are Europe/Rome calendar dates). */
export interface DashboardOverview {
  period: { kind: string; from: string; to: string; nights: number };
  today: string;
  /** Active short-rent properties of the caller's scope: the denominator of the occupancy. */
  propertyCount: number;
  occupancy: DashboardOccupancy;
  revenue?: DashboardRevenue;
  upcoming: { count: number; previousCount: number; pendingApproval: number };
  nextArrivals: DashboardArrival[];
  series?: { unit: 'week' | 'month'; buckets: DashboardSeriesBucket[] };
}

/** `count` covers every item of the list; `items` only the first ones. */
export interface DashboardList<T> {
  count: number;
  items: T[];
}

/** A stay of the day (no money). Statuses and states are the names of the backend enums. */
export interface DashboardTodayStay {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  numberOfGuests: number;
  checkInDate: string;
  checkOutDate: string;
  /** `Confirmed` (the arrival is not registered yet), `CheckedIn` or `CheckedOut`. */
  status: string;
  /** How far the online check-in is; null for a departure. */
  checkIn: { state: 'NotSent' | 'Sent' | 'InProgress' | 'Completed' | 'Expired'; dataComplete: boolean } | null;
  /** The latest cleaning request of a leaving stay and where it stands. */
  cleaning: { serviceRequestId: string; status: string } | null;
}

/** An intervention (service request) of today, in order of time. */
export interface DashboardTodayService {
  id: string;
  /** Category code (`cleaning`, `maintenance`, …): the client translates it. */
  category: string;
  serviceName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  /** `Richiesto`, `PresoInCarico`, `InCorso`, `Completato` or `Pagato`. */
  status: string;
  supplierName: string;
  propertyId: string;
  propertyName: string;
  bookingId: string | null;
}

/** A "pay at the property" request waiting for the host, to answer by `respondBy`. */
export interface DashboardTodayApproval {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  numberOfGuests: number;
  checkInDate: string;
  checkOutDate: string;
  respondBy: string;
}

/** What a thing to do still lacks: a stable code the client translates, the field and how many guests lack it. */
export interface DashboardMissing {
  code: string;
  field?: string | null;
  count?: number | null;
}

/** One thing to do, most pressing first. `action` is where it leads as a key, never a path: the app builds the route. */
export interface DashboardTodoItem {
  action: string;
  priority: number;
  /** When it has to be done by (UTC), if something fixes it. */
  dueAt: string | null;
  /** Whom or what it is about: the guest, the supplier or the property to activate. */
  label: string;
  propertyId: string | null;
  propertyName: string | null;
  bookingId: string | null;
  serviceRequestId: string | null;
  missing: DashboardMissing[];
}

/** `GET /api/dashboard/today`: the host's day in one read (SR-03, SR-03b). */
export interface DashboardToday {
  /** Today in Europe/Rome. */
  today: string;
  arrivals: DashboardList<DashboardTodayStay>;
  departures: DashboardList<DashboardTodayStay>;
  approvals: DashboardList<DashboardTodayApproval>;
  todo: DashboardList<DashboardTodoItem>;
  services: DashboardList<DashboardTodayService>;
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
