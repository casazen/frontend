import { useMutation, useQuery } from '@tanstack/react-query';
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
 * Consume the org's gift for a lease (NF-03, for F04).
 * Atomically assigns the gift and grants access.
 */
export function useCfConsumeGift() {
  return useMutation({
    mutationFn: (leaseId: string) => ConcordatoFacileApi.consumeGift(leaseId),
  });
}
