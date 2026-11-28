import { useQuery } from '@tanstack/react-query';
import { fetchHostSupplierServices, fetchHostSupplierSlots } from '@/api/host-supplier-catalog.api';

const CATALOG_KEY = 'host-supplier-catalog';

export function useHostSupplierServices(supplierOrgId: string, propertyId: string, category: string) {
  return useQuery({
    queryKey: [CATALOG_KEY, 'services', supplierOrgId, propertyId, category],
    queryFn: () => fetchHostSupplierServices(supplierOrgId, { propertyId, category: category || undefined }),
    enabled: supplierOrgId !== '' && propertyId !== '',
    staleTime: 60_000,
    refetchOnMount: true,
    retry: false,
  });
}

export function useHostSupplierSlots(supplierOrgId: string, serviceId: string, propertyId: string, date: string, enabled: boolean) {
  return useQuery({
    queryKey: [CATALOG_KEY, 'slots', supplierOrgId, serviceId, propertyId, date],
    queryFn: () => fetchHostSupplierSlots(supplierOrgId, serviceId, { propertyId, date: date || undefined }),
    enabled: enabled && supplierOrgId !== '' && serviceId !== '' && propertyId !== '',
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export const HOST_SUPPLIER_SLOTS_KEY = [CATALOG_KEY, 'slots'] as const;
