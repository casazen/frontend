import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
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
  updateSupplierAvailability,
  updateSupplierProfile,
  uploadSupplierPhotos,
} from '@/services/supplier-api';
import type { SupplierRegisterPayload } from '@/services/supplier-api';
import type { UpdateAvailabilityEntry } from '@/types/supplier';

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

export function useSupplierDashboard() {
  return useQuery({
    queryKey: ['supplier', 'dashboard'],
    queryFn: fetchSupplierDashboard,
  });
}

export function useCalendarSyncStatus() {
  return useQuery({
    queryKey: ['supplier', 'calendar-sync'],
    queryFn: fetchCalendarSyncStatus,
  });
}

export function useSetIcalFeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setIcalFeed,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier'] });
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
