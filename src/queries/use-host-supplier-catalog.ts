import { useQuery } from '@tanstack/react-query';
import { fetchHostSupplierServices, fetchHostSupplierSlots } from '@/api/host-supplier-catalog.api';

const CATALOG_KEY = 'host-supplier-catalog';

/**
 * The published services of a supplier for a property and a category (SR-08a), for the request wizard. Services change when the
 * supplier edits its catalog, so they are read again when the step opens after a minute.
 */
export function useHostSupplierServices(supplierOrgId: string, propertyId: string, category: string) {
  return useQuery({
    queryKey: [CATALOG_KEY, 'services', supplierOrgId, propertyId, category],
    queryFn: () => fetchHostSupplierServices(supplierOrgId, { propertyId, category: category || undefined }),
    enabled: supplierOrgId !== '' && propertyId !== '',
    staleTime: 60_000,
    refetchOnMount: true,
    // A refusal (the supplier is not active, or does not cover the comune) is an answer: asking again changes nothing.
    retry: false,
  });
}

/**
 * The free slots of a service from a day on (14 days at most). They are the supplier's agenda, which others book too: never kept,
 * always read again when the step is shown or the window is focused again.
 */
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

/** The key under which the slots are kept: a slot taken by someone else (409) reads them again. */
export const HOST_SUPPLIER_SLOTS_KEY = [CATALOG_KEY, 'slots'] as const;
