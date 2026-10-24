import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConcordatoFacileApi } from '@/api/concordatofacile.api';

/** Query key for CF access state. */
export const CF_ACCESS_QUERY_KEY = (leaseId: string) => ['concordatofacile', 'access', leaseId] as const;

/**
 * Check CF access for a lease (ADR-005-R8).
 * Refetches on mount to get fresh payment/gift state (NF-02).
 */
export function useCfAccess(leaseId: string) {
  return useQuery({
    queryKey: CF_ACCESS_QUERY_KEY(leaseId),
    queryFn: () => ConcordatoFacileApi.getAccess(leaseId),
    refetchOnMount: true,
  });
}

/**
 * Create Stripe checkout session for CF payment (ADR-005-R1).
 * Returns sessionUrl to redirect to Stripe.
 */
export function useCfCheckout() {
  return useMutation({
    mutationFn: (leaseId: string) => ConcordatoFacileApi.createCheckout(leaseId),
  });
}

/**
 * Consume the org's gift for a lease (NF-03, ADR-006-R10).
 * Atomically assigns the gift and grants access.
 * Invalidates access query on success.
 */
export function useCfConsumeGift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => ConcordatoFacileApi.consumeGift(leaseId),
    onSuccess: (_, leaseId) => {
      queryClient.invalidateQueries({ queryKey: CF_ACCESS_QUERY_KEY(leaseId) });
    },
  });
}

/**
 * Generate HMAC-signed link to ConcordatoFacile portal (ADR-007-R6, ADR-007-R12).
 * Opens returned URL in new tab with noopener,noreferrer on success.
 */
export function useCfGenerateLink(leaseId: string) {
  return useMutation({
    mutationFn: () => ConcordatoFacileApi.generateLink(leaseId),
    onSuccess: (data) => {
      window.open(data.url, '_blank', 'noopener,noreferrer');
    },
  });
}

/** Query key for CF status. */
export const CF_STATUS_QUERY_KEY = (leaseId: string) => ['concordatofacile', 'status', leaseId] as const;

/**
 * Get practice status for a lease (ADR-008-R15, ADR-008-R16).
 * Refetches on mount and polls based on nextUpdateAt.
 */
export function useCfStatus(leaseId: string) {
  return useQuery({
    queryKey: CF_STATUS_QUERY_KEY(leaseId),
    queryFn: () => ConcordatoFacileApi.getStatus(leaseId),
    refetchOnMount: true,
    refetchInterval: (data) => {
      // Compute refetch interval from nextUpdateAt (ADR-008-R16)
      if (!data?.state?.data?.nextUpdateAt) return false;
      const nextUpdate = new Date(data.state.data.nextUpdateAt).getTime();
      const now = Date.now();
      return Math.max(0, nextUpdate - now);
    },
  });
}
