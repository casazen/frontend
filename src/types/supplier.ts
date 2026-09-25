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
  items: import('@/types/service-request').ServiceRequestSummary[];
  total: number;
}

export interface UpdateAvailabilityEntry {
  date: string;
  available: boolean;
}

export interface SupplierAvailabilityResponse {
  dates: UpdateAvailabilityEntry[];
}

/**
 * State of the supplier's iCal sync (SU-15): `Syncing` while the queued job has not run yet; the calendar is synced
 * only once it becomes `Success`.
 */
export type SupplierCalendarSyncState = 'None' | 'Syncing' | 'Success' | 'Failure';

export interface CalendarSyncStatus {
  calendarSyncType: string;
  icalFeedUrl?: string | null;
  calendarLastSyncAt?: string | null;
  lastSyncStatus?: SupplierCalendarSyncState;
  calendarSyncErrorCode?: string | null;
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
