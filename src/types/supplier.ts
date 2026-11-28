export interface SupplierProfile {
  orgId: string;
  status: string;
  legalName: string;
  vatNumber?: string | null;
  phone: string;
  email: string;
  categories: string[];
  comuni: string[];
  comuneIstatCodes?: string[];
  operatingComuni?: import('@/types/comune.types').Comune[];
  bio?: string | null;
  photoUrls: string[];
  tosAcceptedAt?: string | null;
}

export const ACTIVATION_STEP_IDS = ['identity', 'services', 'showcase', 'profile', 'terms'] as const;
export type ActivationStepId = (typeof ACTIVATION_STEP_IDS)[number];

export interface ActivationStep {
  id: ActivationStepId;
  status: 'completed' | 'pending';
  blocker?: string | null;
  required: boolean;
}

export interface SupplierTos {
  currentVersion: string;
  acceptedVersion?: string | null;
  acceptedAt?: string | null;
  reacceptanceRequired: boolean;
  blocksActions: boolean;
}

export interface ActivationStatus {
  status: string;
  currentStep: number;
  steps: ActivationStep[];
  tos: SupplierTos;
}

export interface SupplierInboxResponse {
  items: import('@/types/service-request').SupplierServiceRequest[];
  total: number;
  page: number;
  pageSize: number;
}

type SupplierInboxStatus = 'open' | 'history' | 'all' | import('@/types/service-request').ServiceRequestStatus;

export type SupplierInboxTab = 'da-rispondere' | 'in-attesa' | 'programmate' | 'da-incassare' | 'archivio';

export type SupplierInboxWhen = 'oggi' | 'settimana' | 'mese';

export type SupplierInboxSource = 'casazen' | 'showcase';

/**
 * Filters of the supplier inbox: `tab` says which requests (and `status` is then ignored by the server); `q` is 2 to 60 characters;
 * `from`/`to` are Europe/Rome days (`YYYY-MM-DD`) on the activity date of each request. `service` is a service of the catalog (its id) or a
 * category code; `comune` an ISTAT code or a name (SP-08b).
 */
export interface SupplierInboxParams {
  status?: SupplierInboxStatus;
  tab?: SupplierInboxTab;
  q?: string;
  service?: string;
  comune?: string;
  source?: SupplierInboxSource;
  when?: SupplierInboxWhen;
  from?: string;
  to?: string;
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierInboxCounts {
  toAnswer: number;
  awaitingCustomer: number;
  scheduled: number;
  toCollect: number;
  archive: number;
  paymentsLate: number;
}

export const ACCEPT_REQUESTS_MAX = 20;

interface AcceptSupplierRequestResult {
  id: string;
  accepted: boolean;
  status?: string | null;
  code?: string | null;
  message?: string | null;
}

export interface AcceptSupplierRequestsResponse {
  results: AcceptSupplierRequestResult[];
  accepted: number;
  failed: number;
}

export interface UpdateAvailabilityEntry {
  date: string;
  available: boolean;
}

type SupplierWeekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface SupplierHoursBand {
  startMinute: number;
  endMinute: number;
}

export interface SupplierAgendaHoursDay {
  weekday: SupplierWeekday;
  bands: SupplierHoursBand[];
}

export interface SupplierHoursResponse {
  days: SupplierAgendaHoursDay[];
  configuredAt?: string | null;
}

type SupplierBusyWindowKind = 'Block' | 'ExtraOpening' | 'External';
type SupplierBusyWindowSource = 'Manual' | 'ICalFeed';
type SupplierAvailabilitySource = 'Manual' | 'ICalFeed';

export interface SupplierAgendaClosedDay {
  date: string;
  source: SupplierAvailabilitySource;
}

export interface SupplierAgendaTimeOff {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  label?: string | null;
  createdAt: string;
}

export interface SupplierAgendaBlock {
  id: string;
  kind: SupplierBusyWindowKind;
  source: SupplierBusyWindowSource;
  startUtc: string;
  endUtc: string;
  label?: string | null;
  createdAt: string;
}

export interface SupplierAgendaRequest {
  id: string;
  date: string;
  startUtc?: string | null;
  endUtc?: string | null;
  status: string;
  category: string;
  serviceName?: string | null;
  clientLabel?: string | null;
  comune?: string | null;
  source?: string;
  phase?: string;
}

export interface SupplierAgendaCalendar {
  guestOrders?: { id: string; serviceName: string; requestedFor: string }[];
  from: string;
  to: string;
  timeZone: string;
  workingHours: SupplierAgendaHoursDay[];
  closedDays: SupplierAgendaClosedDay[];
  timeOff: SupplierAgendaTimeOff[];
  blocks: SupplierAgendaBlock[];
  requests: SupplierAgendaRequest[];
}

/** How serious a conflict is: `danger` (the time cannot be kept as it is) or `warning` (the supplier may live with it). */
export type SupplierConflictSeverity = 'danger' | 'warning';

/**
 * One conflict of a job (`GET api/supplier/calendar/conflicts`, SP-03b). `code` is one of `time_off`, `overlap`, `external`, `block`
 * (danger) or `day_off`, `outside_hours`, `day_full`, `buffer` (warning); the texts are the frontend's, a code it does not know
 * gets a neutral one. `otherRequestId` and `windowId` name the other request or window in the way, when there is one.
 */
export interface SupplierConflict {
  code: string;
  severity: string;
  otherRequestId?: string | null;
  windowId?: string | null;
}

interface SupplierSuggestedSlot {
  startUtc: string;
  endUtc: string;
}

export interface SupplierRequestConflicts {
  requestId: string;
  status: string;
  date: string;
  startUtc: string;
  endUtc: string;
  conflicts: SupplierConflict[];
  suggestedSlot?: SupplierSuggestedSlot | null;
}

export interface SupplierConflictsResponse {
  from: string;
  to: string;
  timeZone: string;
  items: SupplierRequestConflicts[];
  total: number;
  truncated: boolean;
  limit: number;
}

type SupplierCalendarSyncState = 'None' | 'Syncing' | 'Success' | 'Failure';

export interface CalendarSyncStatus {
  calendarSyncType: string;
  icalFeedUrl?: string | null;
  calendarLastSyncAt?: string | null;
  lastSyncStatus?: SupplierCalendarSyncState;
  calendarSyncErrorCode?: string | null;
  calendarSyncError?: string | null;
  pendingFreeEventsCount?: number;
}

export interface PendingFreeEvent {
  id: string;
  summary: string;
  isAllDay: boolean;
  recurring: boolean;
  occurrences: number;
  nextStartUtc: string;
  nextEndUtc: string;
  firstSeenAt: string;
}

export interface PendingFreeEventsResponse {
  items: PendingFreeEvent[];
  pendingCount: number;
}

export type FreeEventDecision = 'Available' | 'Busy';

export interface SupplierDashboard {
  profileCompletionPercent: number;
  status: string;
  availabilityRate: number;
  calendarSyncStatus: CalendarSyncStatus;
  lastUpdated: string;
}

export interface SupplierToday {
  date: string;
  dateTo?: string;
  days?: number;
  jobs: import('@/types/service-request').SupplierServiceRequest[];
  jobsTotal?: number;
  newRequests: import('@/types/service-request').SupplierServiceRequest[];
  newRequestsTotal: number;
}

export type SupplierOverviewPeriod = 'current-month' | 'last-30-days' | 'last-3-months';

export interface SupplierOverviewFigures {
  from: string;
  to: string;
  received: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number | null;
  averageResponseMinutes: number | null;
  completedJobs: number;
  /** The net of the payments paid in the period, in cents: 0 unless `onlinePayments`. */
  paidNetCents: number;
}

/**
 * `GET /supplier/dashboard/overview?period=` (SP-04e): the three numbers of the home for a period and for the same number of days just
 * before it, so that the page says "better" or "worse" without a calculation of its own. With `onlinePayments` false the money is 0 and
 * the page talks about the jobs completed, never about "Incassi".
 */
export interface SupplierOverview {
  period: SupplierOverviewPeriod;
  onlinePayments: boolean;
  current: SupplierOverviewFigures;
  previous: SupplierOverviewFigures;
}

export interface SupplierChecklist {
  profileCompletionPercent: number;
  profileComplete: boolean;
  activeServices: number;
  hoursConfigured: boolean;
  showcasePublished: boolean;
  firstRequestAnswered: boolean;
  paymentsActive?: boolean | null;
}
