import type { PropertyIcalFeedChannel, PropertyIcalImportStatus } from './property-ical';

export type DashboardOverviewQuery = { propertyId?: string } & (
  | { period: 'Month' | 'Last30Days' }
  | { period: 'Custom'; from: string; to: string }
);

interface DashboardOccupancy {
  occupiedNights: number;
  availableNights: number;
  closedNights: number;
  rate: number | null;
  deltaPoints?: number | null;
}

interface DashboardRevenue {
  amount: number;
  currency: string;
  stayCount: number;
  deltaPercent?: number | null;
}

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

export interface DashboardSeriesBucket {
  label: string;
  from: string;
  to: string;
  amount: number;
  previousAmount: number;
  isFuture: boolean;
}

export interface DashboardOverview {
  period: { kind: string; from: string; to: string; nights: number };
  today: string;
  propertyCount: number;
  occupancy: DashboardOccupancy;
  revenue?: DashboardRevenue;
  upcoming: { count: number; previousCount: number; pendingApproval: number };
  nextArrivals: DashboardArrival[];
  series?: { unit: 'week' | 'month'; buckets: DashboardSeriesBucket[] };
}

export interface DashboardList<T> {
  count: number;
  items: T[];
}

export interface DashboardTodayStay {
  bookingId: string;
  bookingCode?: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  numberOfGuests: number;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  checkIn: { state: 'NotSent' | 'Sent' | 'InProgress' | 'Completed' | 'Expired'; dataComplete: boolean } | null;
  cleaning: { serviceRequestId: string; status: string } | null;
}

export interface DashboardTodayService {
  id: string;
  category: string;
  serviceName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  supplierName: string;
  propertyId: string;
  propertyName: string;
  bookingId: string | null;
}

interface DashboardTodayApproval {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  numberOfGuests: number;
  checkInDate: string;
  checkOutDate: string;
  respondBy: string;
}

export interface DashboardMissing {
  code: string;
  field?: string | null;
  count?: number | null;
}

export interface DashboardTodoItem {
  action: string;
  priority: number;
  dueAt: string | null;
  label: string;
  propertyId: string | null;
  propertyName: string | null;
  bookingId: string | null;
  serviceRequestId: string | null;
  missing: DashboardMissing[];
}

export interface DashboardToday {
  today: string;
  arrivals: DashboardList<DashboardTodayStay>;
  departures: DashboardList<DashboardTodayStay>;
  approvals: DashboardList<DashboardTodayApproval>;
  todo: DashboardList<DashboardTodoItem>;
  services: DashboardList<DashboardTodayService>;
}

export interface DashboardIcalFeed {
  feedId: string;
  propertyId: string;
  propertyName: string;
  channel: PropertyIcalFeedChannel;
  label?: string | null;
  lastImportAt?: string | null;
  lastImportStatus?: PropertyIcalImportStatus | null;
  lastErrorCode?: string | null;
  lastError?: string | null;
}
