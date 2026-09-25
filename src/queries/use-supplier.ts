import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  claimSupplierProfile,
  completeSupplierActivation,
  fetchCalendarSyncStatus,
  fetchSupplierActivation,
  fetchSupplierAvailability,
  fetchSupplierDashboard,
  fetchSupplierInbox,
  fetchSupplierProfile,
  fetchSupplierRegistrationOptions,
  inviteSupplier,
  lookupSupplierInvite,
  registerSupplier,
  setIcalFeed,
  syncSupplierCalendarNow,
  updateSupplierAvailability,
  updateSupplierProfile,
  uploadSupplierPhotos,
} from '@/services/supplier-api';
import type { SupplierRegisterPayload } from '@/services/supplier-api';
import type { CalendarSyncStatus, UpdateAvailabilityEntry } from '@/types/supplier';

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

export function useSupplierInbox(status = 'open', page = 1) {
  return useQuery({
    queryKey: ['supplier', 'inbox', status, page],
    queryFn: () => fetchSupplierInbox(status, page),
  });
}

export function useCompleteSupplierActivation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tosAccepted: boolean) => completeSupplierActivation(tosAccepted),
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
  return useMutation({
    mutationFn: inviteSupplier,
  });
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
