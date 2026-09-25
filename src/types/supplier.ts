export interface SupplierProfile {
  orgId: string;
  status: string;
  legalName: string;
  vatNumber?: string | null;
  phone: string;
  email: string;
  categories: string[];
  comuni: string[];
  bio?: string | null;
  photoUrls: string[];
  tosAcceptedAt?: string | null;
}

export interface ActivationStep {
  id: string;
  label: string;
  status: string;
  blocker?: string | null;
}

export interface ActivationStatus {
  status: string;
  steps: ActivationStep[];
}

export interface SupplierInboxResponse {
  items: import('@/types/service-request').SupplierServiceRequest[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * `status` of `GET /supplier/inbox` (SU-08): `open` (waiting, taken, in progress), `history` (completed, paid,
 * rejected), `all`, or one status.
 */
export type SupplierInboxStatus = 'open' | 'history' | 'all' | import('@/types/service-request').ServiceRequestStatus;

/** Filters of the supplier inbox: `from`/`to` are Europe/Rome days (`YYYY-MM-DD`) on the activity date of each request. */
export interface SupplierInboxParams {
  status: SupplierInboxStatus;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateAvailabilityEntry {
  date: string;
  available: boolean;
}

export interface SupplierAvailabilityResponse {
  dates: UpdateAvailabilityEntry[];
}

export interface CalendarSyncStatus {
  calendarSyncType: string;
  icalFeedUrl?: string | null;
  calendarLastSyncAt?: string | null;
  calendarSyncError?: string | null;
}

export interface SupplierDashboard {
  profileCompletionPercent: number;
  status: string;
  availabilityRate: number;
  calendarSyncStatus: CalendarSyncStatus;
  lastUpdated: string;
}

/** Periods of the supplier KPIs (API enum `SupplierKpiPeriod`): Europe/Rome calendar dates, today at most. */
export const SUPPLIER_KPI_PERIODS = ['CurrentMonth', 'PreviousMonth', 'Last30Days', 'CurrentYear'] as const;
export type SupplierKpiPeriod = (typeof SUPPLIER_KPI_PERIODS)[number];

/**
 * Work KPIs of the supplier org from its service requests (`GET /supplier/dashboard/kpis`, SU-11).
 * `completed` and `rejected` count the period; `awaitingAcceptance` and `upcoming` are the open work now.
 */
export interface SupplierKpis {
  period: SupplierKpiPeriod;
  /** First date of the period (`YYYY-MM-DD`, Europe/Rome), included. */
  from: string;
  /** Last date of the period (`YYYY-MM-DD`, Europe/Rome), included. */
  to: string;
  timeZone: string;
  completed: number;
  rejected: number;
  awaitingAcceptance: number;
  upcoming: number;
  totalRequests: number;
}
