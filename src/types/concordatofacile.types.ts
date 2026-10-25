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

/** Response from POST /api/leases/{leaseId}/concordatofacile/link (ADR-007-R6, ADR-007-R11). */
export interface CfLinkResponse {
  /** HMAC-signed URL to ConcordatoFacile partner portal. Expires in 15 minutes. */
  url: string;
}

/** CF practice status enum (ADR-008-R21). */
export type CfPracticeStatus =
  | 'Received'
  | 'InProgress'
  | 'AwaitingUser'
  | 'DraftSent'
  | 'SignedReceived'
  | 'SentToAssociation'
  | 'Attested'
  | 'Registered'
  | 'ClosedWithoutAttestation'
  | 'Suspended'
  | 'Unknown';

/** Practice detail in the status response (ADR-008-R15). */
export interface CfPracticeResponse {
  /** CF practice identifier. */
  practiceId: string;
  /** Current status of the practice. */
  status: CfPracticeStatus;
  /** When the status last changed (ISO8601). */
  statusChangedAt: string;
  /** When the practice was submitted to CF (ISO8601), if available. */
  submittedAt?: string;
  /** Municipality associated with the practice by the partner. */
  comune?: string;
  /** Whether the municipality differs from the lease property municipality. */
  comuneDiffersFromLink: boolean;
  /** Reason for closure, if the practice is closed. */
  closeReason?: string;
}

/**
 * Response from GET /api/concordatofacile/practices/{practiceId}/lease (NF-06): which lease of the org a practice of the partner
 * belongs to. 404 `practice_not_found` when the number is wrong, unknown or the lease is not the org's (the backend never says which).
 */
export interface CfPracticeLookupResponse {
  /** The lease of the org the partner linked the practice to; null when the practice is not linked to a lease. */
  leaseId: string | null;
  /** CF practice identifier (`P-` and 16 hexadecimal characters). */
  practiceId: string;
  /** Current status of the practice, null when it is not linked. */
  status: CfPracticeStatus | null;
  /** True when the practice is not linked to a lease: the user picks the contract. */
  manualSelectionRequired: boolean;
}

/** Response from GET /api/leases/{leaseId}/concordatofacile/status (ADR-008-R15). */
export interface CfStatusResponse {
  /** List of practices for the lease. */
  practices: CfPracticeResponse[];
  /** When the backend last checked the CF API (ISO8601). */
  lastCheckedAt: string;
  /** When the frontend should poll again (ISO8601). */
  nextUpdateAt: string;
  /** Whether the snapshot is stale due to CF API error. */
  stale: boolean;
}
