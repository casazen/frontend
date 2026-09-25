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
  totalJobs: number;
  completedJobs: number;
  upcomingJobs: number;
  availabilityRate: number;
  calendarSyncStatus: CalendarSyncStatus;
  lastUpdated: string;
}
