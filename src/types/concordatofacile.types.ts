/** Response from GET /api/leases/{leaseId}/concordatofacile/access (ADR-005-R8). */
export interface CfAccessResponse {
  /** Whether the user has access to the CF module for this lease. */
  hasAccess: boolean;
  /** Source of access: payment, gift, admin, or null if no access. */
  source: 'payment' | 'gift' | 'admin' | null;
  /** Whether the org has a gift available (not yet consumed). */
  giftAvailable: boolean;
  /** Whether the org's gift has been consumed. */
  giftConsumed: boolean;
  /** ISO8601 timestamp when the purchase was completed (if source=payment). */
  purchasedAt?: string;
  /** ISO8601 timestamp when the gift was assigned (if source=gift). */
  giftAssignedAt?: string;
}

/** Response from POST /api/leases/{leaseId}/concordatofacile/checkout (ADR-005-R1). */
export interface CfCheckoutResponse {
  /** Stripe checkout session ID. */
  sessionId: string;
  /** Stripe checkout session URL to redirect to. */
  sessionUrl: string;
}
