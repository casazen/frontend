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
  items: unknown[];
  total: number;
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
  totalJobs: number;
  completedJobs: number;
  upcomingJobs: number;
  availabilityRate: number;
  calendarSyncStatus: CalendarSyncStatus;
  lastUpdated: string;
}
