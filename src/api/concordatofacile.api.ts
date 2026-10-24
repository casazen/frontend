import { ApiClient } from '@/api/client';
import type { CfAccessResponse, CfCheckoutResponse, CfLinkResponse } from '@/types/concordatofacile.types';

/** ConcordatoFacile one-time payment and access (ADR-005). */
export const ConcordatoFacileApi = {
  /**
   * Check access to the CF module for a lease (ADR-005-R8).
   * Returns whether user has access (via payment, gift, or admin), gift availability, and timestamps.
   */
  getAccess: (leaseId: string): Promise<CfAccessResponse> =>
    ApiClient.get<CfAccessResponse>(`/leases/${leaseId}/concordatofacile/access`),

  /**
   * Create Stripe checkout session for CF one-time payment (ADR-005-R1).
   * Returns sessionUrl to redirect to Stripe. Idempotent: reuses pending sessions (ADR-005-R2).
   * Requires LeaseCreate OR LeaseRead policy (ADR-005-R9).
   */
  createCheckout: (leaseId: string): Promise<CfCheckoutResponse> =>
    ApiClient.post<CfCheckoutResponse>(`/leases/${leaseId}/concordatofacile/checkout`),

  /**
   * Consume the org's gift for a lease (NF-03, ADR-006-R10).
   * Atomically assigns the gift to the lease and grants access without payment.
   * Returns access state after consumption. Returns 409 if gift already consumed.
   */
  consumeGift: (leaseId: string): Promise<CfAccessResponse> =>
    ApiClient.post<CfAccessResponse>(`/leases/${leaseId}/concordatofacile/consume-gift`),

  /**
   * Generate HMAC-signed link to ConcordatoFacile partner portal (ADR-007-R6, ADR-007-R10).
   * Returns time-limited URL (expires in 15 minutes). Requires LeaseCreate policy and access check.
   * Link opens CF form with lease data pre-populated. Records LeaseEvent.ConcordatoFacileLinkGenerated.
   */
  generateLink: (leaseId: string): Promise<CfLinkResponse> =>
    ApiClient.post<CfLinkResponse>(`/leases/${leaseId}/concordatofacile/link`),
};
