import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  claimSupplierProfile,
  acceptSupplierTos,
  completeSupplierActivation,
  saveSupplierActivationStep,
  fetchAdminInvites,
  fetchAdminSuppliers,
  fetchSupplierAudit,
  fetchCalendarSyncStatus,
  fetchSupplierActivation,
  fetchSupplierShowcasePreview,
  fetchSupplierAvailability,
  fetchSupplierDashboard,
  fetchSupplierInbox,
  fetchSupplierInboxItem,
  fetchSupplierKpis,
  fetchSupplierProfile,
  fetchSupplierRegistrationOptions,
  inviteSupplier,
  lookupSupplierInvite,
  reactivateSupplier,
  registerSupplier,
  resendSupplierInvite,
  revokeSupplierInvite,
  setIcalFeed,
  suspendSupplier,
  syncSupplierCalendarNow,
  updateSupplierAvailability,
  updateSupplierProfile,
  uploadSupplierPhotos,
} from '@/services/supplier-api';
import type { SupplierRegisterPayload } from '@/services/supplier-api';
import type { AdminInvitesParams, AdminSuppliersParams } from '@/types/admin-suppliers';
import type {
  CalendarSyncStatus,
  SupplierInboxParams,
  SupplierKpiPeriod,
  UpdateAvailabilityEntry,
} from '@/types/supplier';

/**
 * Light polling while the supplier's calendar is syncing (its job is queued, SU-15): every few seconds during the first
 * minute, when the download usually ends, then slower until the 15-minute job settles it.
 */
const SYNCING_FAST_REFETCH_MS = 3_000;
const SYNCING_SLOW_REFETCH_MS = 15_000;
const SYNCING_FAST_WINDOW_MS = 60_000;

const CALENDAR_SYNC_KEY = ['supplier', 'calendar-sync'] as const;

// When each status query started to see `Syncing` (keyed by the query object, dropped with it).
const syncingSince = new WeakMap<object, number>();

/** Next poll of the calendar status: none unless it is `Syncing`, otherwise fast first and then slower. */
export function supplierSyncRefetchInterval(
  query: { state: { data?: CalendarSyncStatus } },
  now: number = Date.now(),
): number | false {
  if (query.state.data?.lastSyncStatus !== 'Syncing') {
    syncingSince.delete(query);
    return false;
  }
  const since = syncingSince.get(query) ?? now;
  syncingSince.set(query, since);
  return now - since < SYNCING_FAST_WINDOW_MS ? SYNCING_FAST_REFETCH_MS : SYNCING_SLOW_REFETCH_MS;
}

export function useSupplierActivation() {
  return useQuery({
    queryKey: ['supplier', 'activation'],
    queryFn: fetchSupplierActivation,
  });
}

export function useSupplierProfile() {
  return useQuery({
    queryKey: ['supplier', 'profile'],
    queryFn: fetchSupplierProfile,
  });
}

/** A page of the supplier inbox (SU-08): open requests or history, filtered and paginated by the server. */
export function useSupplierInbox(params: SupplierInboxParams = { status: 'open' }, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'list', params],
    queryFn: () => fetchSupplierInbox(params),
    enabled: options?.enabled ?? true,
  });
}

/**
 * One request of the supplier inbox with its history (SU-08). Under `['supplier', 'inbox']`, so take, complete and
 * reject reload it.
 */
export function useSupplierInboxItem(id: string | undefined) {
  return useQuery({
    queryKey: ['supplier', 'inbox', 'item', id],
    queryFn: () => fetchSupplierInboxItem(id!),
    enabled: !!id,
  });
}

export function useCompleteSupplierActivation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tosAccepted, tosVersion }: { tosAccepted: boolean; tosVersion: string }) =>
      completeSupplierActivation(tosAccepted, tosVersion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}

/** Saves the wizard step; the activation status is not refetched (the wizard keeps its own step while it is open). */
export function useSaveSupplierActivationStep() {
  return useMutation({ mutationFn: saveSupplierActivationStep });
}

export function useAcceptSupplierTos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptSupplierTos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}

export function useUpdateSupplierProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSupplierProfile,
    onSuccess: (updated) => {
      // Update the profile cache immediately with the response from the server.
      // This avoids a stale-data window caused by staleTime + refetchOnMount.
      queryClient.setQueryData(['supplier', 'profile'], updated);
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
    },
  });
}

export function useSupplierAvailability(from: string, to: string) {
  return useQuery({
    queryKey: ['supplier', 'availability', from, to],
    queryFn: () => fetchSupplierAvailability(from, to),
  });
}

export function useUpdateSupplierAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dates: UpdateAvailabilityEntry[]) => updateSupplierAvailability(dates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', 'availability'] });
    },
  });
}

export function useInviteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: inviteSupplier,
    // A new invite shows up in the admin invites list.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }),
  });
}

const ADMIN_SUPPLIERS_KEY = ['admin', 'suppliers'] as const;
const ADMIN_INVITES_KEY = ['admin', 'supplier-invites'] as const;

/** A page of the suppliers for the platform admin (SU-12), filtered and paginated by the server. */
export function useAdminSuppliers(params: AdminSuppliersParams) {
  return useQuery({
    queryKey: [...ADMIN_SUPPLIERS_KEY, 'list', params],
    queryFn: () => fetchAdminSuppliers(params),
  });
}

/** Audit trail of one supplier; loaded only while its dialog is open. */
export function useSupplierAudit(orgId: string | undefined) {
  return useQuery({
    queryKey: [...ADMIN_SUPPLIERS_KEY, 'audit', orgId],
    queryFn: () => fetchSupplierAudit(orgId!),
    enabled: !!orgId,
  });
}

export function useSuspendSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, reason }: { orgId: string; reason: string }) => suspendSupplier(orgId, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_SUPPLIERS_KEY }),
  });
}

export function useReactivateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => reactivateSupplier(orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_SUPPLIERS_KEY }),
  });
}

/** A page of the supplier invites for the platform admin (SU-12), filtered and paginated by the server. */
export function useAdminInvites(params: AdminInvitesParams) {
  return useQuery({
    queryKey: [...ADMIN_INVITES_KEY, 'list', params],
    queryFn: () => fetchAdminInvites(params),
  });
}

export function useResendSupplierInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => resendSupplierInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }),
  });
}

export function useRevokeSupplierInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => revokeSupplierInvite(inviteId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ADMIN_INVITES_KEY }),
  });
}

/**
 * True while the caller's supplier profile is suspended (SU-12): the console then shows a banner and offers no action
 * on the requests. Unknown (loading, error) counts as not suspended: the API refuses the action anyway.
 */
export function useSupplierSuspended(): boolean {
  const { data } = useSupplierProfile();
  return data?.status === 'Suspended';
}

/** Invite of a registration link token (SU-01); disabled without a token. */
export function useSupplierInvite(token: string) {
  return useQuery({
    queryKey: ['supplier', 'invite', token],
    queryFn: () => lookupSupplierInvite(token),
    enabled: token.length > 0,
  });
}

/** Self-serve registration on/off and pilot comuni (SU-01). */
export function useSupplierRegistrationOptions(enabled = true) {
  return useQuery({
    queryKey: ['supplier', 'registration-options'],
    queryFn: fetchSupplierRegistrationOptions,
    enabled,
  });
}

export function useRegisterSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, authenticated }: { payload: SupplierRegisterPayload; authenticated: boolean }) =>
      registerSupplier(payload, { authenticated }),
    onSuccess: (_result, { authenticated }) => {
      // A signed-in registration links the account to the supplier org: /me changes.
      if (authenticated) void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

/** Links the signed-in account to its supplier profile (SU-02); the profile (`/me`) then has `supplierOrgId`. */
export function useClaimSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (claimToken?: string) => claimSupplierProfile(claimToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useSupplierDashboard() {
  return useQuery({
    queryKey: ['supplier', 'dashboard'],
    queryFn: fetchSupplierDashboard,
  });
}

/**
 * Service-request KPIs of the supplier for `period` (SU-11). The counter of "Richieste" in the menu (UI-04a) reads the
 * current month through the same cache entry as the dashboard, and only when `enabled`.
 */
export function useSupplierKpis(period: SupplierKpiPeriod, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['supplier', 'dashboard', 'kpis', period],
    queryFn: () => fetchSupplierKpis(period),
    enabled: options?.enabled ?? true,
  });
}

/**
 * Calendar sync status of the supplier, polled while `Syncing`. When a sync ends the availability and the dashboard are
 * refreshed: the days of the feed may have changed.
 */
export function useCalendarSyncStatus() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: CALENDAR_SYNC_KEY,
    queryFn: async () => {
      const previous = queryClient.getQueryData<CalendarSyncStatus>(CALENDAR_SYNC_KEY);
      const next = await fetchCalendarSyncStatus();
      if (previous?.lastSyncStatus === 'Syncing' && next.lastSyncStatus !== 'Syncing') {
        void queryClient.invalidateQueries({ queryKey: ['supplier', 'availability'] });
        void queryClient.invalidateQueries({ queryKey: ['supplier', 'dashboard'] });
      }
      return next;
    },
    refetchInterval: supplierSyncRefetchInterval,
  });
}

/** Saves the iCal URL: the answer (`Syncing`) replaces the status at once, which starts the polling. */
export function useSetIcalFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setIcalFeed,
    onSuccess: (status) => {
      queryClient.setQueryData(CALENDAR_SYNC_KEY, status);
      void queryClient.invalidateQueries({ queryKey: ['supplier'], predicate: (query) => query.queryKey[1] !== 'calendar-sync' });
    },
  });
}

/** "Sync now" of the supplier's iCal feed (SU-15): the answer (`Syncing`) replaces the status and starts the polling. */
export function useSyncSupplierCalendarNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: syncSupplierCalendarNow,
    onSuccess: (status) => {
      queryClient.setQueryData(CALENDAR_SYNC_KEY, status);
    },
  });
}

export function useUploadSupplierPhotos() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadSupplierPhotos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', 'profile'] });
    },
  });
}

/** The owner's preview of the public showcase (SU-13). */
export function useSupplierShowcasePreview() {
  return useQuery({
    queryKey: ['supplier', 'showcase'],
    queryFn: fetchSupplierShowcasePreview,
  });
}
