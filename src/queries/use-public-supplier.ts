import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { publicSupplierApi, type PublicQuoteRequestBody } from '@/api/public-supplier.api';

/** The slots are cached for 30 seconds on the server: asking again sooner would tell nothing new. */
const SLOTS_STALE_MS = 30_000;

/** One published service of a supplier, with its description and supplements (404 for an unknown one: no retry). */
export function useSupplierService(slug: string, serviceSlug: string, enabled = true) {
  return useQuery({
    queryKey: ['supplier-service', slug, serviceSlug],
    queryFn: () => publicSupplierApi.getService(slug, serviceSlug),
    enabled: enabled && !!slug && !!serviceSlug,
    staleTime: SLOTS_STALE_MS,
    retry: false,
  });
}

/** The free slots of a service for the next two weeks. */
export function useSupplierSlots(slug: string, serviceSlug: string, enabled = true) {
  return useQuery({
    queryKey: ['supplier-slots', slug, serviceSlug],
    queryFn: () => publicSupplierApi.getSlots(slug, { service: serviceSlug, days: 14 }),
    enabled: enabled && !!slug && !!serviceSlug,
    staleTime: SLOTS_STALE_MS,
    retry: false,
  });
}

/**
 * The estimate of what is chosen. The caller gives it the body already debounced; the previous total stays on screen while the
 * next one comes, so the figure never blinks to nothing. The server answers 30 a minute per address: no retry.
 */
export function useSupplierEstimate(slug: string, body: PublicQuoteRequestBody, enabled = true) {
  return useQuery({
    queryKey: ['supplier-estimate', slug, body],
    queryFn: () => publicSupplierApi.quote(slug, body),
    enabled: enabled && !!slug,
    placeholderData: keepPreviousData,
    staleTime: SLOTS_STALE_MS,
    retry: false,
  });
}
