import type { AlloggiatiChannelManagerDto } from '@/types/alloggiati.types';
import type { ComplianceHandoffTopic } from '@/types/compliance-handoff.types';

/** What a proof proves (`ManualProofKind`): the receipt of an Alloggiati communication, the proof of an ISTAT one, a tourist tax declaration or payment. */
export type ComplianceProofKind = 'AlloggiatiReceipt' | 'IstatProof' | 'TouristTaxDeclaration' | 'TouristTaxPayment';

export const COMPLIANCE_PROOF_KINDS: readonly ComplianceProofKind[] = ['AlloggiatiReceipt', 'IstatProof', 'TouristTaxDeclaration', 'TouristTaxPayment'];

interface ComplianceCoveredProperty {
  id: string;
  name: string;
}

export interface ComplianceArchiveEntry {
  id: string;
  kind: ComplianceProofKind;
  propertyId: string;
  propertyName: string;
  day: string;
  period: string | null;
  source: string;
  receivedAt: string;
  retainUntil: string;
  contentType: string;
  downloadPath: string;
  coveredProperties?: ComplianceCoveredProperty[] | null;
  /** Only in the answer of the upload of an Alloggiati receipt: how many stays of those flats that arrived that day it proves. `null` or absent elsewhere. */
  coveredStays?: number | null;
}

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
  from?: string;
  to?: string;
  kind?: ComplianceProofKind;
  page?: number;
  pageSize?: number;
}

/**
 * What the log of a stay says (`ComplianceSendKind`): three kinds of send and, since E20/F02/US01/T02, `DocumentsDeleted`: not a send but the line that tells CasaZen deleted the
 * photos of the guests' documents of the stay because an archived receipt covers it (written by CasaZen, with the date and no reference).
 */
type ComplianceSendKind = 'AlloggiatiGuests' | 'IstatPeriod' | 'TouristTaxPeriod' | 'DocumentsDeleted';

type SendLogSender = 'CasaZen' | 'ChannelManager' | 'Manual';

export interface ComplianceSendLogLine {
  id: string;
  kind: ComplianceSendKind;
  sender: SendLogSender;
  sentAt: string;
  reference: string | null;
  sentBy: string | null;
}

/**
 * What the archive holds about one stay (`GET /api/bookings/{bookingId}/compliance`): the proofs of its arrival day and the log of what was sent for it, newest first, and the
 * Alloggiati block of the per-stay status (E20/F01/US01/T02: the same one `GET /api/alloggiati/{bookingId}/status` carries as `channelManager`).
 */
export interface ComplianceBookingArchive {
  bookingId: string;
  propertyId: string;
  proofs: ComplianceArchiveEntry[];
  sendLog: ComplianceSendLogLine[];
  alloggiati?: AlloggiatiChannelManagerDto | null;
}

export type CoverageEvidenceClass = 'OfficialProof' | 'ExternalVerificationRequired' | 'Missing' | 'NotApplicable';

/** What an obligation is about: the Alloggiati communication of a stay, the ISTAT communication or the tourist tax of a month of a property. */
export type CoverageKind = 'Alloggiati' | 'Istat' | 'TouristTax';

export interface CoverageRow {
  kind: CoverageKind;
  propertyId: string;
  propertyName: string;
  bookingId: string | null;
  bookingCode: string | null;
  day: string | null;
  /** The month (`yyyy-MM`) for ISTAT and tourist tax; `null` for a stay. */
  period: string | null;
  evidenceClass: CoverageEvidenceClass;
  /** `casazen_receipt`, `manual_upload` or `octorate`; `null` otherwise. */
  evidenceSource: string | null;
  proofAt: string | null;
  deadlineAt: string | null;
  action: string | null;
  reason: string;
  /** `Alloggiati` or `Istat` for a row whose outcome only the channel manager holds: the server says it, the client never works it out. */
  handoffTopic: ComplianceHandoffTopic | null;
}

export interface CoverageReport {
  from: string;
  to: string;
  propertyId: string | null;
  generatedAt: string;
  complete: boolean;
  officialProof: number;
  externalVerificationRequired: number;
  missing: number;
  notApplicable: number;
  rows: CoverageRow[];
}

export interface ComplianceReportFilters {
  from: string;
  to: string;
  propertyId?: string;
}

export type ComplianceReportFormat = 'pdf' | 'csv';

interface ReceiptCoverageProperty {
  propertyId: string;
  propertyName: string;
  stays: number;
}

/**
 * What a receipt of the Alloggiati communication of a day would prove for the flats asked for (`GET /api/compliance/archive/proofs/coverage`): the stays of those flats that
 * arrived that day, owe the communication and that the receipt turns green. The count is the one of the traffic light: a stay whose communication failed or was only partly
 * accepted is not in it. Nothing is stored by asking.
 */
export interface ReceiptCoverage {
  day: string;
  stays: number;
  properties: ReceiptCoverageProperty[];
}

export interface UploadComplianceProofInput {
  propertyId: string;
  kind: ComplianceProofKind;
  day: string;
  file: File;
  /**
   * The flats an Alloggiati receipt covers, the flat of the request included: `propertyIds` repeated. Only for a receipt that covers more than that flat (the server reads no list,
   * or an empty one, as that flat alone and never as every flat); at most 500, all in Italy.
   */
  propertyIds?: readonly string[];
}
