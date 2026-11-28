import { ApiClient } from '@/api/client';
import type {
  AcceptSupplierRequestsResponse,
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
  AdminSupplier,
  AdminSupplierAuditEntry,
  AdminSuppliersParams,
} from '@/types/admin-suppliers';

export async function fetchSupplierActivation(): Promise<ActivationStatus> {
  return ApiClient.get<ActivationStatus>('/supplier/profile/activation');
}

export async function completeSupplierActivation(
  tosAccepted: boolean,
  tosVersion: string,
): Promise<{ status: string }> {
  return ApiClient.post<{ status: string }>('/supplier/profile/activation/complete', { tosAccepted, tosVersion });
}

export async function saveSupplierActivationStep(step: number): Promise<void> {
  await ApiClient.put('/supplier/profile/activation/step', { step });
}

export async function acceptSupplierTos(tosVersion: string): Promise<void> {
  await ApiClient.post('/supplier/profile/tos/accept', { tosVersion });
}

export async function fetchSupplierProfile(): Promise<SupplierProfile> {
  return ApiClient.get<SupplierProfile>('/supplier/profile');
}

export async function updateSupplierProfile(
  payload: Partial<Pick<SupplierProfile, 'legalName' | 'vatNumber' | 'phone' | 'bio'>> & {
    categories?: string[];
    comuni?: string[];
    /** ISTAT codes of the comuni chosen from the official list: replaces the stored ones; left out keeps them (SU-04). */
    comuneIstatCodes?: string[];
    photoUrls?: string[];
  },
): Promise<SupplierProfile> {
  return ApiClient.put<SupplierProfile>('/supplier/profile', payload);
}

export async function fetchSupplierInbox({
  status,
  tab,
  q,
  service,
  comune,
  source,
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
    ...(service ? { service } : {}),
    ...(comune ? { comune } : {}),
    ...(source ? { source } : {}),
    ...(when ? { when } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...(clientId ? { clientId } : {}),
  });
}

export async function acceptSupplierRequests(ids: string[]): Promise<AcceptSupplierRequestsResponse> {
  return ApiClient.post<AcceptSupplierRequestsResponse>('/supplier/inbox/accept', { ids });
}

/** The numbers on the chips of the list of requests (SP-04e): they agree with the lists because the server counts with their rules. */
export async function fetchSupplierInboxCounts(): Promise<SupplierInboxCounts> {
  return ApiClient.get<SupplierInboxCounts>('/supplier/inbox/counts');
}

export async function fetchSupplierInboxItem(id: string): Promise<SupplierServiceRequestDetail> {
  return ApiClient.get<SupplierServiceRequestDetail>(`/supplier/inbox/${encodeURIComponent(id)}`);
}

export async function updateSupplierAvailability(dates: UpdateAvailabilityEntry[]): Promise<{ updated: number }> {
  const { data } = await axios.put<{ updated: number }>('/supplier/availability', { dates });
  return data;
}

export async function fetchSupplierHours(): Promise<SupplierHoursResponse> {
  return ApiClient.get<SupplierHoursResponse>('/supplier/availability/hours');
}

export async function saveSupplierHours(days: SupplierAgendaHoursDay[]): Promise<SupplierHoursResponse> {
  return ApiClient.put<SupplierHoursResponse>('/supplier/availability/hours', { days });
}

export async function fetchSupplierAgendaCalendar(from: string, to: string): Promise<SupplierAgendaCalendar> {
  return ApiClient.get<SupplierAgendaCalendar>('/supplier/calendar', { from, to });
}

export async function fetchSupplierConflicts(): Promise<SupplierConflictsResponse> {
  return ApiClient.get<SupplierConflictsResponse>('/supplier/calendar/conflicts');
}

export async function fetchAdminSuppliers({ search, status, page = 1, pageSize = 20 }: AdminSuppliersParams): Promise<PagedResult<AdminSupplier>> {
  return ApiClient.get<PagedResult<AdminSupplier>>('/admin/suppliers', {
    page,
    pageSize,
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
  });
}

export async function suspendSupplier(orgId: string, reason: string): Promise<AdminSupplier> {
  return ApiClient.post<AdminSupplier>(`/admin/suppliers/${encodeURIComponent(orgId)}/suspend`, { reason });
}

export async function reactivateSupplier(orgId: string): Promise<AdminSupplier> {
  return ApiClient.post<AdminSupplier>(`/admin/suppliers/${encodeURIComponent(orgId)}/reactivate`);
}

export async function fetchSupplierAudit(orgId: string): Promise<AdminSupplierAuditEntry[]> {
  return ApiClient.get<AdminSupplierAuditEntry[]>(`/admin/suppliers/${encodeURIComponent(orgId)}/audit`);
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
  claimToken?: string | null;
  claimExpiresAt?: string | null;
}

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

export async function lookupSupplierInvite(token: string): Promise<SupplierInvitePreview> {
  const { data } = await axios.post<SupplierInvitePreview>('/suppliers/invites/lookup', { token }, { public: true });
  return data;
}

export interface SupplierRegistrationOptions {
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

export async function fetchSupplierToday(days: number): Promise<SupplierToday> {
  return ApiClient.get<SupplierToday>('/supplier/today', { days });
}

export async function fetchSupplierOverview(period: SupplierOverviewPeriod): Promise<SupplierOverview> {
  return ApiClient.get<SupplierOverview>('/supplier/dashboard/overview', { period });
}

export async function fetchSupplierChecklist(): Promise<SupplierChecklist> {
  return ApiClient.get<SupplierChecklist>('/supplier/checklist');
}

export async function fetchCalendarSyncStatus(): Promise<CalendarSyncStatus> {
  return ApiClient.get<CalendarSyncStatus>('/supplier/calendar/status');
}

export async function setIcalFeed(icalFeedUrl: string): Promise<CalendarSyncStatus> {
  return ApiClient.put<CalendarSyncStatus>('/supplier/calendar/ical', { icalFeedUrl });
}

export async function disconnectIcalFeed(): Promise<void> {
  await ApiClient.delete('/supplier/calendar/ical');
}

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

export async function fetchPendingFreeEvents(): Promise<PendingFreeEventsResponse> {
  return ApiClient.get<PendingFreeEventsResponse>('/supplier/calendar/free-events');
}

export async function decideFreeEvent(id: string, decision: FreeEventDecision): Promise<void> {
  await ApiClient.post(`/supplier/calendar/free-events/${encodeURIComponent(id)}/decision`, { decision });
}
