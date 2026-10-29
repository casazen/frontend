import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { longRentTenantsApi } from '@/api/long-rent-tenants.api';
import type { TenantListParams } from '@/types';
import { LEASES_KEY } from './use-leases';

export const LONG_RENT_TENANTS_KEY = 'long-rent-tenants';

/**
 * A page of the people of the area (LR-09). The rows of the last view stay on the screen, a little dimmed, while the next ones come;
 * the leases and the rents they are made of change in other pages, so the list is read again every time it opens.
 */
export function useTenants(params: TenantListParams) {
  return useQuery({
    queryKey: [LONG_RENT_TENANTS_KEY, 'list', params],
    queryFn: () => longRentTenantsApi.getAll(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** The sheet of a person, read again every time it opens (a rent paid or a request of erasure made elsewhere changes it). */
export function useTenant(id: string) {
  return useQuery({
    queryKey: [LONG_RENT_TENANTS_KEY, 'detail', id],
    queryFn: () => longRentTenantsApi.getById(id),
    enabled: !!id,
    refetchOnMount: 'always',
  });
}

/** The copy of a person's data, as a file the page saves. Not cached: it holds personal data in clear and is made when it is asked. */
export function useDownloadTenantData() {
  return useMutation({ mutationFn: (id: string) => longRentTenantsApi.downloadData(id) });
}

/**
 * The erasure request. It changes what the person is (a lease that ended loses its data now), so the people, the sheet and the lists of
 * leases are read again afterwards.
 */
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
