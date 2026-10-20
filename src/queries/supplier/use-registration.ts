import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSupplierRegistrationOptions, lookupSupplierInvite, registerSupplier } from '@/services/supplier-api';
import type { SupplierRegisterPayload } from '@/services/supplier-api';

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
