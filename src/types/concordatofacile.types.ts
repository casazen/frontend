import type { LeaseStatus } from './lease.types';

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
  /**
   * CF-FLOW (backend): the person accepted the privacy notice for this lease, which comes before the guided form. Absent counts as not
   * accepted: the form is not opened without it (the server answers 409 `concordatofacile_privacy_not_accepted`).
   */
  privacyAccepted?: boolean;
  /** ISO8601 timestamp of that acceptance; null when there is none. */
  privacyAcceptedAt?: string | null;
  /** CF-FLOW (backend): when the signed link of the form was last made, i.e. the form was last opened; null (or absent) if it never was. */
  linkOpenedAt?: string | null;
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

/**
 * Where the lease of the guided service stands after `POST /api/leases/{leaseId}/concordatofacile/sync` (CF-DONE): what the server could
 * do by itself with the documents the person uploaded and the practice, and what the lease waits for.
 * - `NotApplicable`: not a lease of the service, nothing was done;
 * - `WaitingForContract`: no contract file uploaded yet;
 * - `ReadingContract`: the contract file is being read into the draft;
 * - `WaitingForSignature`: read, but the practice does not say yet that the contract is signed;
 * - `ContractNeedsData`: read, but the import needs something the reading did not find: the person completes only that;
 * - `WaitingForReceipt`: the contract is imported (signed), the receipt of the registration is not uploaded yet;
 * - `ReadingReceipt`: the receipt of the registration is being read;
 * - `ReceiptNotUsable`: the receipt cannot declare the registration by itself (a scan, a discarded request): the person declares it;
 * - `Completed`: the registration is declared, the procedure is over.
 */
export type CfSyncState =
  | 'NotApplicable'
  | 'WaitingForContract'
  | 'ReadingContract'
  | 'WaitingForSignature'
  | 'ContractNeedsData'
  | 'WaitingForReceipt'
  | 'ReadingReceipt'
  | 'ReceiptNotUsable'
  | 'Completed';

/** Response from POST /api/leases/{leaseId}/concordatofacile/sync (CF-DONE). */
export interface CfSyncResponse {
  state: CfSyncState;
  /** The status of the lease now: it follows the practice (Draft, then Signed once the contract is imported, then Registered). */
  leaseStatus: LeaseStatus;
}

/** Response from GET /api/leases/{leaseId}/concordatofacile/status (ADR-008-R15). */
export interface CfStatusResponse {
  /** List of practices for the lease. */
  practices: CfPracticeResponse[];
  /** When the backend last checked the CF API (ISO8601); null when it never could (no successful reading). */
  lastCheckedAt: string | null;
  /** When the frontend should poll again (ISO8601). */
  nextUpdateAt: string;
  /** Whether the snapshot is stale due to CF API error. */
  stale: boolean;
  /**
   * CF-FLOW (backend): false when the status could not be read at all (no successful reading yet): `practices` is then empty and the
   * answer is still a 200. Absent counts as available.
   */
  available?: boolean;
}
