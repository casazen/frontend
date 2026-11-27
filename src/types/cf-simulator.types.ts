import type { CfPracticeStatus } from '@/types/concordatofacile.types';

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

export const CF_SIMULATOR_CLOSE_REASONS = ['duplicate', 'withdrawn', 'not_compliant', 'other'] as const;

export type CfSimulatorCloseReason = (typeof CF_SIMULATOR_CLOSE_REASONS)[number];

export type CfSimulatorDocumentKind = 'contract' | 'attestation' | 'receipt';

/**
 * What the test panel offers (CF-DOCS-REAL): what the real service delivers, the contract with its attestation and its calculation sheet in
 * ONE file (a scan), and the receipt of the registration of the Agenzia delle Entrate, which comes from the Agenzia and is a file of its own.
 */
export const CF_SIMULATOR_PANEL_DOCUMENTS = ['contract', 'receipt'] as const satisfies readonly CfSimulatorDocumentKind[];

export interface CfSimulatorLinkParams {
  partner?: string;
  leaseId?: string;
  expiresAt?: string;
  signature?: string;
  comune?: string;
  provincia?: string;
}

export interface CfSimulatorPractice {
  practiceId: string;
  status: CfPracticeStatus;
  statusChangedAt: string;
  submittedAt: string;
  comune: string | null;
  comuneDiffersFromLink: boolean | null;
  closeReason: string | null;
}

export interface CfSimulatorLinkResponse {
  valid: boolean;
  reason: string | null;
  leaseId: string | null;
  comune: string | null;
  provincia: string | null;
  practices: CfSimulatorPractice[];
}

export interface CfSimulatorCreatedPractice {
  practiceId: string;
  controlToken: string;
  status: CfPracticeStatus;
  statusChangedAt: string;
  linked: boolean;
}

export interface CfSimulatorSetStatusBody {
  controlToken: string;
  status: CfSimulatorStatus;
  closeReason?: CfSimulatorCloseReason;
}
