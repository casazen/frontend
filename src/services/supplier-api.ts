import { ApiClient } from '@/api/client';
import type {
  ActivationStatus,
  CalendarSyncStatus,
  FreeEventDecision,
  PendingFreeEventsResponse,
  SupplierAgendaCalendar,
  SupplierAgendaHoursDay,
  SupplierChecklist,
  SupplierConflictsResponse,
  SupplierDashboard,
  SupplierHoursResponse,
  SupplierInboxCounts,
  SupplierInboxParams,
  SupplierInboxResponse,
  SupplierKpiPeriod,
  SupplierKpis,
  SupplierOverview,
  SupplierOverviewPeriod,
  SupplierProfile,
  SupplierToday,
  UpdateAvailabilityEntry,
} from '@/types/supplier';
import axios from '@/lib/axios';
import type { SupplierServiceRequestDetail } from '@/types/service-request';
import type { PagedResult } from '@/types/users.types';
import type {
  AdminInvite,
  AdminInvitesParams,
  AdminSupplier,
  AdminSupplierAuditEntry,
  AdminSuppliersParams,
} from '@/types/admin-suppliers';

export async function fetchSupplierActivation(): Promise<ActivationStatus> {
  return ApiClient.get<ActivationStatus>('/supplier/profile/activation');
}

/** `tosVersion` is the version the supplier saw (`tos.currentVersion`): the API answers 409 when it is no longer current. */
export async function completeSupplierActivation(
  tosAccepted: boolean,
  tosVersion: string,
): Promise<{ status: string }> {
  return ApiClient.post<{ status: string }>('/supplier/profile/activation/complete', { tosAccepted, tosVersion });
}

/** Saves the wizard step (1-5) the supplier reached. */
export async function saveSupplierActivationStep(step: number): Promise<void> {
  await ApiClient.put('/supplier/profile/activation/step', { step });
}

/** Re-acceptance of the current Terms of Service by an active supplier. */
export async function acceptSupplierTos(tosVersion: string): Promise<void> {
  await ApiClient.post('/supplier/profile/tos/accept', { tosVersion });
}

export async function fetchSupplierProfile(): Promise<SupplierProfile> {
  return ApiClient.get<SupplierProfile>('/supplier/profile');
}

export async function updateSupplierProfile(
  payload: Partial<Pick<SupplierProfile, 'legalName' | 'vatNumber' | 'phone' | 'bio'>> & {
    categories?: string[];
    /** Comuni written as text (kept as written). */
    comuni?: string[];
    /** ISTAT codes of the comuni chosen from the official list: replaces the stored ones; left out keeps them (SU-04). */
    comuneIstatCodes?: string[];
    photoUrls?: string[];
  },
): Promise<SupplierProfile> {
  return ApiClient.put<SupplierProfile>('/supplier/profile', payload);
}

/**
 * A page of the supplier inbox, paginated and filtered by the server (SU-08, SP-04e). A `tab` says which requests, and then
 * `status` is not sent (the server ignores it); the filters that are empty are not sent either.
 */
export async function fetchSupplierInbox({
  status,
  tab,
  q,
  when,
  from,
  to,
  clientId,
  page = 1,
  pageSize = 20,
}: SupplierInboxParams): Promise<SupplierInboxResponse> {
  return ApiClient.get<SupplierInboxResponse>('/supplier/inbox', {
    ...(tab ? { tab } : { status: status ?? 'open' }),
    page,
    pageSize,
    ...(q ? { q } : {}),
    ...(when ? { when } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(clientId ? { clientId } : {}),
  });
}

/** The numbers on the chips of the list of requests (SP-04e): they agree with the lists because the server counts with their rules. */
export async function fetchSupplierInboxCounts(): Promise<SupplierInboxCounts> {
  return ApiClient.get<SupplierInboxCounts>('/supplier/inbox/counts');
}

/** One request sent to the caller's supplier org, with its history (404 for another supplier's request). */
export async function fetchSupplierInboxItem(id: string): Promise<SupplierServiceRequestDetail> {
  return ApiClient.get<SupplierServiceRequestDetail>(`/supplier/inbox/${encodeURIComponent(id)}`);
}

/** Opens or closes days for the customers: only the days sent change (`PUT api/supplier/availability`). */
export async function updateSupplierAvailability(dates: UpdateAvailabilityEntry[]): Promise<{ updated: number }> {
  const { data } = await axios.put<{ updated: number }>('/supplier/availability', { dates });
  return data;
}

/** Weekly working hours (SP-03): seven days, Monday first, bands as minutes after midnight in Rome. */
export async function fetchSupplierHours(): Promise<SupplierHoursResponse> {
  return ApiClient.get<SupplierHoursResponse>('/supplier/availability/hours');
}

export async function saveSupplierHours(days: SupplierAgendaHoursDay[]): Promise<SupplierHoursResponse> {
  return ApiClient.put<SupplierHoursResponse>('/supplier/availability/hours', { days });
}

/** Agenda for a date range: hours, closed days, calendar engagements and requests (SP-03/SP-05). */
export async function fetchSupplierAgendaCalendar(from: string, to: string): Promise<SupplierAgendaCalendar> {
  return ApiClient.get<SupplierAgendaCalendar>('/supplier/calendar', { from, to });
}

/** The jobs of the next 30 days with something wrong, each with how and a time to propose instead (SP-03b). */
export async function fetchSupplierConflicts(): Promise<SupplierConflictsResponse> {
  return ApiClient.get<SupplierConflictsResponse>('/supplier/calendar/conflicts');
}

export async function inviteSupplier(payload: {
  email: string;
  comuneCode: string;
  categories?: string[];
  message?: string;
}): Promise<{ inviteId: string; expiresAt: string }> {
  const { data } = await axios.post<{ inviteId: string; expiresAt: string }>('/admin/suppliers/invite', payload);
  return data;
}

/** A page of the suppliers for the platform admin, filtered and paginated by the server (SU-12). */
export async function fetchAdminSuppliers({ search, status, page = 1, pageSize = 20 }: AdminSuppliersParams): Promise<PagedResult<AdminSupplier>> {
  return ApiClient.get<PagedResult<AdminSupplier>>('/admin/suppliers', {
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });
}

/** Suspends a supplier: the reason is required and stays internal. */
export async function suspendSupplier(orgId: string, reason: string): Promise<AdminSupplier> {
  return ApiClient.post<AdminSupplier>(`/admin/suppliers/${encodeURIComponent(orgId)}/suspend`, { reason });
}

export async function reactivateSupplier(orgId: string): Promise<AdminSupplier> {
  return ApiClient.post<AdminSupplier>(`/admin/suppliers/${encodeURIComponent(orgId)}/reactivate`);
}

/** Audit trail of a supplier (suspensions and reactivations), newest first. */
export async function fetchSupplierAudit(orgId: string): Promise<AdminSupplierAuditEntry[]> {
  return ApiClient.get<AdminSupplierAuditEntry[]>(`/admin/suppliers/${encodeURIComponent(orgId)}/audit`);
}

/** A page of the supplier invites for the platform admin (SU-12). */
export async function fetchAdminInvites({ search, state, page = 1, pageSize = 20 }: AdminInvitesParams): Promise<PagedResult<AdminInvite>> {
  return ApiClient.get<PagedResult<AdminInvite>>('/admin/suppliers/invites', {
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(state ? { state } : {}),
  });
}

/** Sends an invite again: new link and expiry, the old link stops working. */
export async function resendSupplierInvite(inviteId: string): Promise<{ inviteId: string; expiresAt: string }> {
  return ApiClient.post<{ inviteId: string; expiresAt: string }>(
    `/admin/suppliers/invites/${encodeURIComponent(inviteId)}/resend`,
  );
}

/** Revokes a pending invite: its link no longer works. */
export async function revokeSupplierInvite(inviteId: string): Promise<void> {
  await axios.delete(`/admin/suppliers/invites/${encodeURIComponent(inviteId)}`);
}

export interface SupplierRegisterPayload {
  email: string;
  legalName: string;
  phone: string;
  comuneCode: string;
  inviteToken?: string;
}

export interface SupplierRegisterResult {
  orgId: string;
  authRedirectUrl: string;
  rolesSynced: boolean;
  rolesSyncError: string | null;
  /** Anonymous self-serve only (SU-02): links the account created afterwards through `POST /suppliers/claim`. */
  claimToken?: string | null;
  claimExpiresAt?: string | null;
}

/**
 * `POST /api/suppliers/register`. Signed in (`authenticated`), the bearer token is sent so the account
 * is checked against the email/invite and linked to the new org; an invite can only be accepted
 * signed in. Anonymous only for self-serve.
 */
export async function registerSupplier(
  payload: SupplierRegisterPayload,
  options: { authenticated: boolean },
): Promise<SupplierRegisterResult> {
  const { data } = await axios.post<SupplierRegisterResult>('/suppliers/register', payload, {
    public: !options.authenticated,
  });
  return data;
}

export interface SupplierClaimResult {
  orgId: string;
  /** Where the supplier continues: the activation wizard. */
  redirectUrl: string;
  /** False when the Auth0 Supplier role could not be assigned: the console works, a retry assigns it. */
  rolesSynced: boolean;
  rolesSyncError: string | null;
}

/**
 * `POST /api/suppliers/claim` (signed in, SU-02): links the account to the supplier profile registered without an
 * account. With `claimToken` the account email must be the registered one; without it the backend accepts only an
 * email verified by Auth0. Idempotent once linked.
 */
export async function claimSupplierProfile(claimToken?: string): Promise<SupplierClaimResult> {
  const { data } = await axios.post<SupplierClaimResult>('/suppliers/claim', claimToken ? { claimToken } : {});
  return data;
}

export interface SupplierInvitePreview {
  email: string;
  comuneCode: string;
  /** Name of the comune when it is a configured pilot comune; otherwise show the code. */
  comuneName: string | null;
  categories: string[];
  expiresAt: string;
}

/** Invite of a link token (anonymous; the token travels in the body, not in the URL). */
export async function lookupSupplierInvite(token: string): Promise<SupplierInvitePreview> {
  const { data } = await axios.post<SupplierInvitePreview>('/suppliers/invites/lookup', { token }, { public: true });
  return data;
}

export interface SupplierRegistrationOptions {
  /** False while no pilot comune is configured: suppliers join by invite only. */
  selfServeEnabled: boolean;
  pilotComuni: { code: string; name: string }[];
}

export async function fetchSupplierRegistrationOptions(): Promise<SupplierRegistrationOptions> {
  const { data } = await axios.get<SupplierRegistrationOptions>('/suppliers/registration-options', { public: true });
  return data;
}

export async function fetchSupplierDashboard(): Promise<SupplierDashboard> {
  return ApiClient.get<SupplierDashboard>('/supplier/dashboard');
}

/** Service-request KPIs of the supplier org for a Europe/Rome period (SU-11). */
export async function fetchSupplierKpis(period: SupplierKpiPeriod): Promise<SupplierKpis> {
  return ApiClient.get<SupplierKpis>('/supplier/dashboard/kpis', { period });
}

/** The new requests to answer and the jobs of today and the next `days` days, 1 to 7 (SP-04, SP-04e): the data of the home. */
export async function fetchSupplierToday(days: number): Promise<SupplierToday> {
  return ApiClient.get<SupplierToday>('/supplier/today', { days });
}

/** The three numbers of the home for a period and the one just before it (SP-04e). */
export async function fetchSupplierOverview(period: SupplierOverviewPeriod): Promise<SupplierOverview> {
  return ApiClient.get<SupplierOverview>('/supplier/dashboard/overview', { period });
}

/** The steps of the activation, each from what the supplier really did (SP-04). */
export async function fetchSupplierChecklist(): Promise<SupplierChecklist> {
  return ApiClient.get<SupplierChecklist>('/supplier/checklist');
}

export async function fetchCalendarSyncStatus(): Promise<CalendarSyncStatus> {
  return ApiClient.get<CalendarSyncStatus>('/supplier/calendar/status');
}

/** Saves the iCal URL and queues its first sync: 202 with `lastSyncStatus: 'Syncing'` (SU-15). */
export async function setIcalFeed(icalFeedUrl: string): Promise<CalendarSyncStatus> {
  return ApiClient.put<CalendarSyncStatus>('/supplier/calendar/ical', { icalFeedUrl });
}

/** Unlinks the iCal calendar (SP-03b): 204, also when none was linked. Blocks and days closed by hand stay. */
export async function disconnectIcalFeed(): Promise<void> {
  await ApiClient.delete('/supplier/calendar/ical');
}

/** "Sync now": 202 with `lastSyncStatus: 'Syncing'` (nothing more is queued if a sync is already queued). */
export async function syncSupplierCalendarNow(): Promise<CalendarSyncStatus> {
  return ApiClient.post<CalendarSyncStatus>('/supplier/calendar/sync');
}

export async function uploadSupplierPhotos(files: File[]): Promise<{ urls: string[] }> {
  const formData = new FormData();
  files.forEach((file) => formData.append('photos', file));
  const { data } = await axios.post<{ urls: string[] }>('/supplier/profile/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/** Calendar events marked "Disponibile" that wait for the supplier's answer (they block their days meanwhile). */
export async function fetchPendingFreeEvents(): Promise<PendingFreeEventsResponse> {
  return ApiClient.get<PendingFreeEventsResponse>('/supplier/calendar/free-events');
}

/** The supplier's answer for one free event (one decision per recurring series): 204, and "Available" queues a sync. */
export async function decideFreeEvent(id: string, decision: FreeEventDecision): Promise<void> {
  await ApiClient.post(`/supplier/calendar/free-events/${encodeURIComponent(id)}/decision`, { decision });
}
