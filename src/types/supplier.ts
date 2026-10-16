export interface SupplierProfile {
  orgId: string;
  status: string;
  legalName: string;
  vatNumber?: string | null;
  phone: string;
  email: string;
  categories: string[];
  /** Comuni written as text (before the official list, or while it is not imported): shown as written. */
  comuni: string[];
  /** ISTAT codes of the comuni chosen from the official list (SU-04). */
  comuneIstatCodes?: string[];
  /** The chosen comuni with name, province and region; a stored code not in the list is only in `comuneIstatCodes`. */
  operatingComuni?: import('@/types/comune.types').Comune[];
  bio?: string | null;
  photoUrls: string[];
  tosAcceptedAt?: string | null;
}

/** Ids of the five activation wizard steps, in order (SU-05). */
export const ACTIVATION_STEP_IDS = ['identity', 'services', 'showcase', 'profile', 'terms'] as const;
export type ActivationStepId = (typeof ACTIVATION_STEP_IDS)[number];

export interface ActivationStep {
  id: ActivationStepId;
  status: 'completed' | 'pending';
  /** Stable code of the first missing requirement (`categories_missing`, ...), null when the step is complete. */
  blocker?: string | null;
  /** False for a step that never blocks the activation (showcase photos). */
  required: boolean;
}

export interface SupplierTos {
  currentVersion: string;
  acceptedVersion?: string | null;
  acceptedAt?: string | null;
  /** The supplier accepted a version other than the current one (or before versions were recorded). */
  reacceptanceRequired: boolean;
  /** Take, complete and reject are refused until the current version is accepted. */
  blocksActions: boolean;
}

export interface ActivationStatus {
  status: string;
  /** Step number (1-5) saved by the server: the wizard resumes there on any device. */
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

/**
 * `status` of `GET /supplier/inbox` (SU-08): `open` (waiting, taken, in progress), `history` (completed, paid,
 * rejected), `all`, or one status.
 */
export type SupplierInboxStatus = 'open' | 'history' | 'all' | import('@/types/service-request').ServiceRequestStatus;

/**
 * `tab` of `GET /supplier/inbox` (SP-04e): the console's own way to pick the requests, with its own order. `da-rispondere` still
 * has to be answered, `in-attesa` waits for the customer, `programmate` is taken or in progress, `da-incassare` is completed and not
 * paid, `archivio` is paid, rejected or cancelled.
 */
export type SupplierInboxTab = 'da-rispondere' | 'in-attesa' | 'programmate' | 'da-incassare' | 'archivio';

/** `when` of `GET /supplier/inbox`: the day of the job is today, in the next 7 days or this month (Europe/Rome). */
export type SupplierInboxWhen = 'oggi' | 'settimana' | 'mese';

/**
 * Filters of the supplier inbox: `tab` says which requests (and `status` is then ignored by the server); `q` is 2 to 60 characters;
 * `from`/`to` are Europe/Rome days (`YYYY-MM-DD`) on the activity date of each request.
 */
export interface SupplierInboxParams {
  status?: SupplierInboxStatus;
  tab?: SupplierInboxTab;
  q?: string;
  when?: SupplierInboxWhen;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** `GET /supplier/inbox/counts` (SP-04e): the numbers of the tabs, computed with the same rules as the lists. */
export interface SupplierInboxCounts {
  toAnswer: number;
  awaitingCustomer: number;
  scheduled: number;
  toCollect: number;
  archive: number;
  /** Payments asked for that are late and still owed. */
  paymentsLate: number;
}

export interface UpdateAvailabilityEntry {
  date: string;
  available: boolean;
}

/** Weekday names of `GET/PUT api/supplier/availability/hours` (Monday first). */
export type SupplierWeekday =
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

export type SupplierBusyWindowKind = 'Block' | 'ExtraOpening' | 'External';
export type SupplierBusyWindowSource = 'Manual' | 'ICalFeed';
export type SupplierAvailabilitySource = 'Manual' | 'ICalFeed';

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
}

/** `GET api/supplier/calendar`: hours, closed days, time off, blocks and requests for a range. */
export interface SupplierAgendaCalendar {
  from: string;
  to: string;
  timeZone: string;
  workingHours: SupplierAgendaHoursDay[];
  closedDays: SupplierAgendaClosedDay[];
  timeOff: SupplierAgendaTimeOff[];
  blocks: SupplierAgendaBlock[];
  requests: SupplierAgendaRequest[];
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
  /** "Disponibile" events of the feed the supplier has not answered yet: they block their days until then. */
  pendingFreeEventsCount?: number;
}

/** A calendar event marked "Disponibile" (free) that holds its days until the supplier answers. The title is personal data of the owner. */
export interface PendingFreeEvent {
  id: string;
  summary: string;
  isAllDay: boolean;
  recurring: boolean;
  /** Number of dates of the series that are held. */
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

/** `GET /supplier/showcase` (SU-13): the same content as the public page, from the caller's own profile. */
export interface SupplierShowcasePreview {
  showcase: import('@/api/public-supplier.api').SupplierShowcaseDto;
  status: 'Pending' | 'Active' | 'Suspended';
  /** True only for an active supplier with a slug: the public page opens for anyone. */
  published: boolean;
  slug: string | null;
  /** Path of the page in the web app (`/fornitori/:slug`). */
  publicPath: string | null;
  /** Absolute URL on the configured public base URL; null while there is no slug or no public URL configured. */
  publicUrl: string | null;
  /** Always false in v0: the page is `noindex`. */
  indexable: boolean;
}
