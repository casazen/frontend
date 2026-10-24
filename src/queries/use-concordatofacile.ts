import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ConcordatoFacileApi } from '@/api/concordatofacile.api';
import { getProblemCode } from '@/lib/api-errors';

/** Query key for CF access state. */
export const CF_ACCESS_QUERY_KEY = (leaseId: string) => ['concordatofacile', 'access', leaseId] as const;

/** 409 of the checkout: the lease already has the service (paid, gift) or has paid and the payment is not recorded yet (CF-FIX). */
export const CF_ALREADY_PURCHASED_CODE = 'concordatofacile_already_purchased';

/** True for the 409 `concordatofacile_already_purchased` of the checkout. */
export function isCfAlreadyPurchased(error: unknown): boolean {
  return isAxiosError(error) && error.response?.status === 409 && getProblemCode(error.response.data) === CF_ALREADY_PURCHASED_CODE;
}

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
 * Returns sessionUrl to redirect to Stripe. When the server answers that the lease already has the service (409
 * `concordatofacile_already_purchased`: the payment was made, possibly in another tab, or is still being recorded) the access is read
 * again, so the page shows the access that is now active instead of an error (CF-FIX).
 */
export function useCfCheckout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => ConcordatoFacileApi.createCheckout(leaseId),
    onError: (error, leaseId) => {
      if (isCfAlreadyPurchased(error)) {
        void queryClient.invalidateQueries({ queryKey: CF_ACCESS_QUERY_KEY(leaseId) });
      }
    },
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

/** Query key for the lease of a CF practice. */
export const CF_PRACTICE_LEASE_QUERY_KEY = (practiceId: string) => ['concordatofacile', 'practice-lease', practiceId] as const;

/**
 * The lease of the org a practice of the partner belongs to (NF-06): the upload page opened from the button «Carica i dati in
 * CasaZen» of ConcordatoFacile. It never retries: a 404 is the answer (wrong number, another org, service off) and every retry would
 * be one more read of the partner's status API; a failure leaves the user choosing the contract by hand.
 */
export function useCfPracticeLease(practiceId: string) {
  return useQuery({
    queryKey: CF_PRACTICE_LEASE_QUERY_KEY(practiceId),
    queryFn: () => ConcordatoFacileApi.lookupPracticeLease(practiceId),
    enabled: practiceId !== '',
    retry: false,
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
