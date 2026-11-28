import type { LeaseStatus } from './lease.types';

export interface CfAccessResponse {
  hasAccess: boolean;
  source: 'payment' | 'gift' | 'admin' | null;
  giftAvailable: boolean;
  giftConsumed: boolean;
  purchasedAt?: string;
  giftAssignedAt?: string;
  privacyAccepted?: boolean;
  privacyAcceptedAt?: string | null;
  linkOpenedAt?: string | null;
}

export interface CfCheckoutResponse {
  sessionId: string;
  sessionUrl: string;
}

export interface CfLinkResponse {
  url: string;
}

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

export interface CfPracticeResponse {
  practiceId: string;
  status: CfPracticeStatus;
  statusChangedAt: string;
  submittedAt?: string;
  comune?: string;
  comuneDiffersFromLink: boolean;
  closeReason?: string;
}

/**
 * Response from GET /api/concordatofacile/practices/{practiceId}/lease (NF-06): which lease of the org a practice of the partner
 * belongs to. 404 `practice_not_found` when the number is wrong, unknown or the lease is not the org's (the backend never says which).
 */
export interface CfPracticeLookupResponse {
  leaseId: string | null;
  practiceId: string;
  status: CfPracticeStatus | null;
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

export interface CfSyncResponse {
  state: CfSyncState;
  leaseStatus: LeaseStatus;
}

export interface CfStatusResponse {
  practices: CfPracticeResponse[];
  lastCheckedAt: string | null;
  nextUpdateAt: string;
  stale: boolean;
  available?: boolean;
}
