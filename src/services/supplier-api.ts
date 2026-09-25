import { ApiClient } from '@/api/client';
import type {
  ActivationStatus,
  CalendarSyncStatus,
  SupplierAvailabilityResponse,
  SupplierDashboard,
  SupplierInboxResponse,
  SupplierKpiPeriod,
  SupplierKpis,
  SupplierProfile,
  UpdateAvailabilityEntry,
} from '@/types/supplier';
import axios from '@/lib/axios';

export async function fetchSupplierActivation(): Promise<ActivationStatus> {
  return ApiClient.get<ActivationStatus>('/supplier/profile/activation');
}

export async function completeSupplierActivation(tosAccepted: boolean): Promise<{ status: string }> {
  return ApiClient.post<{ status: string }>('/supplier/profile/activation/complete', { tosAccepted });
}

export async function fetchSupplierProfile(): Promise<SupplierProfile> {
  return ApiClient.get<SupplierProfile>('/supplier/profile');
}

export async function updateSupplierProfile(
  payload: Partial<Pick<SupplierProfile, 'legalName' | 'vatNumber' | 'phone' | 'bio'>> & {
    categories?: string[];
    comuni?: string[];
    photoUrls?: string[];
  },
): Promise<SupplierProfile> {
  return ApiClient.put<SupplierProfile>('/supplier/profile', payload);
}

export async function fetchSupplierInbox(status = 'open', page = 1, pageSize = 20): Promise<SupplierInboxResponse> {
  const { data } = await axios.get<SupplierInboxResponse>('/supplier/inbox', {
    params: { status, page, pageSize },
  });
  return data;
}

export async function fetchSupplierAvailability(
  from: string,
  to: string,
): Promise<SupplierAvailabilityResponse> {
  const { data } = await axios.get<SupplierAvailabilityResponse>('/supplier/availability', {
    params: { from, to },
  });
  return data;
}

export async function updateSupplierAvailability(dates: UpdateAvailabilityEntry[]): Promise<{ updated: number }> {
  const { data } = await axios.put<{ updated: number }>('/supplier/availability', { dates });
  return data;
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

export async function fetchCalendarSyncStatus(): Promise<CalendarSyncStatus> {
  return ApiClient.get<CalendarSyncStatus>('/supplier/calendar/status');
}

/** Saves the iCal URL and queues its first sync: 202 with `lastSyncStatus: 'Syncing'` (SU-15). */
export async function setIcalFeed(icalFeedUrl: string): Promise<CalendarSyncStatus> {
  return ApiClient.put<CalendarSyncStatus>('/supplier/calendar/ical', { icalFeedUrl });
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
