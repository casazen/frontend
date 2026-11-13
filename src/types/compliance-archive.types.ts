/**
 * The archive of the proofs CasaZen holds for the compliance obligations and the coverage report (E03/F02/US03/T01, NF-47, NF-52, CHK-08, CHK-12
 * point 8). Enums arrive as their names. The passage to the area where the channel manager keeps an outcome (CHK-15) is not here: its types are
 * those of the compliance drawer (`compliance-handoff.types.ts`).
 */

import type { ComplianceHandoffTopic } from '@/types/compliance-handoff.types';

/** What a proof proves (`ManualProofKind`): the receipt of an Alloggiati communication, the proof of an ISTAT one, a tourist tax declaration or payment. */
export type ComplianceProofKind = 'AlloggiatiReceipt' | 'IstatProof' | 'TouristTaxDeclaration' | 'TouristTaxPayment';

/** The kinds of proof, in the order the page offers them. */
export const COMPLIANCE_PROOF_KINDS: readonly ComplianceProofKind[] = ['AlloggiatiReceipt', 'IstatProof', 'TouristTaxDeclaration', 'TouristTaxPayment'];

/** One proof CasaZen holds (`GET /api/compliance/archive`). It names no guest: a property, a kind, a day or a month, where it comes from, until when it is kept. */
export interface ComplianceArchiveEntry {
  id: string;
  kind: ComplianceProofKind;
  propertyId: string;
  propertyName: string;
  /** The day of the communication, or the first day of the month for the kinds that are about a month (`yyyy-MM-dd`). */
  day: string;
  /** The month (`yyyy-MM`) for those kinds; `null` for a day. */
  period: string | null;
  /** `manual_upload` (the host uploaded it) or `casazen_receipt` (CasaZen downloaded it); a code this version does not know gets the generic words. */
  source: string;
  /** UTC instants. */
  receivedAt: string;
  retainUntil: string;
  contentType: string;
  /** The path of the API a proof is downloaded from: it needs the token of the caller, so it is never opened as a link. */
  downloadPath: string;
}

/** One page of the archive, newest first. */
export interface ComplianceArchivePage {
  items: ComplianceArchiveEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  /** The portal of Alloggiati Web (https, from the configuration): the step «Prendi la ricevuta» opens it. */
  alloggiatiPortalUrl: string;
}

export interface ComplianceArchiveFilters {
  propertyId?: string;
  /** First and last day (`yyyy-MM-dd`), both included, of the day or month a proof is about. */
  from?: string;
  to?: string;
  kind?: ComplianceProofKind;
  page?: number;
  pageSize?: number;
}

/** What was sent (`ComplianceSendKind`). */
export type ComplianceSendKind = 'AlloggiatiGuests' | 'IstatPeriod' | 'TouristTaxPeriod';

/** Who sent it, as the log keeps it: CasaZen, the channel manager, or the host by hand (`ComplianceSender`). */
export type SendLogSender = 'CasaZen' | 'ChannelManager' | 'Manual';

/** One line of the send log of a stay: what was sent, when and by whom. No guest data. */
export interface ComplianceSendLogLine {
  id: string;
  kind: ComplianceSendKind;
  sender: SendLogSender;
  /** UTC instant; for a declaration of the host, the day it said it sent it. */
  sentAt: string;
  /** A receipt or confirmation id; `null` when there is none. */
  reference: string | null;
  /** The name of the person of the org who declared it; `null` for CasaZen and the channel manager. */
  sentBy: string | null;
}

/** What the archive holds about one stay (`GET /api/bookings/{bookingId}/compliance`). */
export interface ComplianceBookingArchive {
  bookingId: string;
  propertyId: string;
  proofs: ComplianceArchiveEntry[];
  sendLog: ComplianceSendLogLine[];
}

/**
 * The state of an obligation of the coverage report: an archived proof CasaZen holds, an outcome held only in the connected area of the channel
 * manager (nothing is inferred), no proof yet, or nothing owed.
 */
export type CoverageEvidenceClass = 'OfficialProof' | 'ExternalVerificationRequired' | 'Missing' | 'NotApplicable';

/** What an obligation is about: the Alloggiati communication of a stay, the ISTAT communication or the tourist tax of a month of a property. */
export type CoverageKind = 'Alloggiati' | 'Istat' | 'TouristTax';

/** One obligation of the coverage report (`GET /api/compliance/report`). A stay is named by its code and arrival day, never by its guest. */
export interface CoverageRow {
  kind: CoverageKind;
  propertyId: string;
  propertyName: string;
  bookingId: string | null;
  bookingCode: string | null;
  /** The arrival day of the stay (`yyyy-MM-dd`); `null` for a month. */
  day: string | null;
  /** The month (`yyyy-MM`) for ISTAT and tourist tax; `null` for a stay. */
  period: string | null;
  evidenceClass: CoverageEvidenceClass;
  /** `casazen_receipt`, `manual_upload` or `octorate`; `null` otherwise. */
  evidenceSource: string | null;
  proofAt: string | null;
  deadlineAt: string | null;
  /** What fixes it (`ComplianceCockpitAction` by name); `null` when nothing is left to do. */
  action: string | null;
  /** A stable code the clients translate: a code this version does not know gets the generic words of the state, never the raw code. */
  reason: string;
  /** `Alloggiati` or `Istat` for a row whose outcome only the channel manager holds: the server says it, the client never works it out. */
  handoffTopic: ComplianceHandoffTopic | null;
}

/** The coverage report of a period: complete only when every applicable obligation has its archived proof. */
export interface CoverageReport {
  from: string;
  to: string;
  propertyId: string | null;
  generatedAt: string;
  /** Whether every applicable obligation has its proof; false while any is missing or held only in the connected area of the channel manager. */
  complete: boolean;
  officialProof: number;
  externalVerificationRequired: number;
  missing: number;
  notApplicable: number;
  rows: CoverageRow[];
}

/** The days a report or an export covers: both are always asked (the API answers 400 without them), at most 24 months. */
export interface ComplianceReportFilters {
  from: string;
  to: string;
  propertyId?: string;
}

export type ComplianceReportFormat = 'pdf' | 'csv';

/** What an upload of a proof sends: the property, what the file proves, the day it is about (any day of the month for a month kind) and the file. */
export interface UploadComplianceProofInput {
  propertyId: string;
  kind: ComplianceProofKind;
  /** `yyyy-MM-dd`, not in the future. */
  day: string;
  file: File;
}
