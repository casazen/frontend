import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSupplierRegistrationOptions, lookupSupplierInvite, registerSupplier } from '@/services/supplier-api';
import type { SupplierRegisterPayload } from '@/services/supplier-api';

export function useSupplierInvite(token: string) {
  return useQuery({
    queryKey: ['supplier', 'invite', token],
    queryFn: () => lookupSupplierInvite(token),
    enabled: token.length > 0,
  });
}


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
      if (authenticated) void queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
