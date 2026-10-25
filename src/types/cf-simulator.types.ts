import type { CfPracticeStatus } from '@/types/concordatofacile.types';

/**
 * The simulated module of the service that prepares the contract (CF-SIM, test environments only): the shapes of
 * `api/cf-simulator/*`. The module is the page `/guided-form`; the API answers 404 where the simulator is off.
 */

/** The states a practice can be moved to from the test panel: the ten of the service, never `Unknown`. */
export const CF_SIMULATOR_STATUSES = [
  'Received',
  'InProgress',
  'AwaitingUser',
  'DraftSent',
  'SignedReceived',
  'SentToAssociation',
  'Attested',
  'Registered',
  'ClosedWithoutAttestation',
  'Suspended',
] as const satisfies readonly CfPracticeStatus[];

export type CfSimulatorStatus = (typeof CF_SIMULATOR_STATUSES)[number];

/** Why a practice is closed without attestation. */
export const CF_SIMULATOR_CLOSE_REASONS = ['duplicate', 'withdrawn', 'not_compliant', 'other'] as const;

export type CfSimulatorCloseReason = (typeof CF_SIMULATOR_CLOSE_REASONS)[number];

/** The sample documents the simulator can send: the contract, the attestation alone (kept for the old endpoint) and the receipt of the registration. */
export type CfSimulatorDocumentKind = 'contract' | 'attestation' | 'receipt';

/**
 * What the test panel offers (CF-DOCS-REAL): what the real service delivers, the contract with its attestation and its calculation sheet in
 * ONE file (a scan), and the receipt of the registration of the Agenzia delle Entrate, which comes from the Agenzia and is a file of its own.
 */
export const CF_SIMULATOR_PANEL_DOCUMENTS = ['contract', 'receipt'] as const satisfies readonly CfSimulatorDocumentKind[];

/** The parameters of the signed link, as they arrive in the address of the module. */
export interface CfSimulatorLinkParams {
  partner?: string;
  leaseId?: string;
  expiresAt?: string;
  signature?: string;
  comune?: string;
  provincia?: string;
}

/** A practice as the status API shows it. */
export interface CfSimulatorPractice {
  practiceId: string;
  status: CfPracticeStatus;
  statusChangedAt: string;
  submittedAt: string;
  comune: string | null;
  comuneDiffersFromLink: boolean | null;
  closeReason: string | null;
}

/** `GET /cf-simulator/link`: what the module learns from its link. */
export interface CfSimulatorLinkResponse {
  valid: boolean;
  /** Why the link is not good (`expired`, `signature_invalid`...); null when it is. */
  reason: string | null;
  leaseId: string | null;
  comune: string | null;
  provincia: string | null;
  /** The practices the contract already has; empty when the link is not good. */
  practices: CfSimulatorPractice[];
}

/** `POST /cf-simulator/practices`: the practice just born and the token that controls it (shown only once). */
export interface CfSimulatorCreatedPractice {
  practiceId: string;
  controlToken: string;
  status: CfPracticeStatus;
  statusChangedAt: string;
  /** False when the link was not good: the practice arrived without a reference to the contract. */
  linked: boolean;
}

/** Body of `POST /cf-simulator/practices/{id}/status`. */
export interface CfSimulatorSetStatusBody {
  controlToken: string;
  status: CfSimulatorStatus;
  closeReason?: CfSimulatorCloseReason;
}
