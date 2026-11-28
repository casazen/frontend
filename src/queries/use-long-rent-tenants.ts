import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { longRentTenantsApi } from '@/api/long-rent-tenants.api';
import type { TenantListParams } from '@/types';
import { LEASES_KEY } from './use-leases';

const LONG_RENT_TENANTS_KEY = 'long-rent-tenants';

export function useTenants(params: TenantListParams) {
  return useQuery({
    queryKey: [LONG_RENT_TENANTS_KEY, 'list', params],
    queryFn: () => longRentTenantsApi.getAll(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: [LONG_RENT_TENANTS_KEY, 'detail', id],
    queryFn: () => longRentTenantsApi.getById(id),
    enabled: !!id,
    refetchOnMount: 'always',
  });
}

export function useDownloadTenantData() {
  return useMutation({ mutationFn: (id: string) => longRentTenantsApi.downloadData(id) });
}

export function useRequestTenantErasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => longRentTenantsApi.requestErasure(id),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [LONG_RENT_TENANTS_KEY] });
      void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
    },
  });
}
