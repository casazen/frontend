import type { ComplianceSenderType, OctorateSyncStatus } from './checkin-wizard.types';
import type { ComplianceLightName } from './compliance.types';
import type { DocumentType, Gender } from './guest.types';
import type { AlloggiatiCodeTable, StayGuestType } from './public-checkin.types';

/**
 * State of an Alloggiati Web communication (CO-11, decision D6, ADR-015).
 * SentReceiptPending: sent successfully, awaiting receipt retrieval.
 * NotDue: the guests never came (a no-show), so no communication is owed; the API derives it, no report holds it.
 * EntrustedToChannelManager: every guest of the stay is on the channel manager for good and the channel manager sends them to the police (E20/F01/US01/T02).
 * It is not «sent» (derived, never stored): the stay is green only with an archived receipt.
 * ChannelManagerWriteFailed: at least one guest could not be written to the channel manager (derived, never stored): `channelManager.guests` says which and why.
 */
export type AlloggiatiWebStatus =
  | 'DaInviare'
  | 'DaInviareManualmente'
  | 'InviatoManualmente'
  | 'Inviato'
  | 'Sending'
  | 'PartiallyAccepted'
  | 'ToVerify'
  | 'SentReceiptPending'
  | 'Rifiutato'
  | 'Errore'
  | 'NotDue'
  | 'EntrustedToChannelManager'
  | 'ChannelManagerWriteFailed';

type ChannelManagerWriteState = 'NotApplicable' | 'NothingWritten' | 'InProgress' | 'Entrusted' | 'Failed';

export interface AlloggiatiChannelManagerGuestDto {
  position: number;
  state: OctorateSyncStatus;
  sentAsDraft: boolean;
  errorCode: string | null;
  /** The fields of the guest to correct for `place_not_recognized` (`birthComune`, `residenceComune`, `documentIssuePlace`, comma separated); null otherwise. */
  errorFields: string | null;
  attempts: number;
  lastAttemptAt: string | null;
}

interface AlloggiatiReceiptCoverageDto {
  archived: boolean;
  source: string | null;
  archivedAt: string | null;
}

export interface AlloggiatiChannelManagerDto {
  sender: ComplianceSenderType;
  state: ChannelManagerWriteState;
  guests: AlloggiatiChannelManagerGuestDto[];
  receiptCoverage: AlloggiatiReceiptCoverageDto;
  light: ComplianceLightName | null;
  reason: string | null;
  actions: string[];
}

export type OctorateCheckInSendState = 'NotMirrored' | 'NotApplicable' | 'NothingToSend' | 'Sent' | 'PartlyFailed' | 'Failed';

/** What the retry of the write of the guests did (`POST /alloggiati/{bookingId}/retry-octorate-write`): the outcome and, when it did nothing, why. No personal data. */
export interface AlloggiatiRetryResultDto {
  state: OctorateCheckInSendState;
  reason: string | null;
}

export interface AlloggiatiStatusDto {
  directGuests?: { position: number; outcome: string }[];
  directSubmission?: boolean;
  directAttempt?: string | null;
  canDownloadDirectReceipt?: boolean;
  bookingId: string;
  status: AlloggiatiWebStatus;
  confirmationNumber: string | null;
  errorCode: string | null;
  reportedAt: string | null;
  deadlineAt: string;
  isShortStay: boolean;
  hoursUntilDeadline: number;
  isOverdue: boolean;
  dataComplete: boolean;
  channelManager?: AlloggiatiChannelManagerDto | null;
  /** What the retry of the write did; only in the answer of the retry. */
  retry?: AlloggiatiRetryResultDto | null;
}

export interface AlloggiatiSummaryDto {
  bookingId: string;
  guestName: string;
  propertyName: string;
  checkInDate: string;
  status: AlloggiatiWebStatus;
  dataComplete: boolean;
  isOverdue: boolean;
  hoursUntilDeadline: number;
  deadlineAt: string;
  isShortStay: boolean;
}

/**
 * Record fields the host copies on the portal, in the order of the Alloggiati record. Also the names the API uses in
 * `missingFields` and `codesToComplete` (`AlloggiatiRecordRules.Field*`).
 */
export type AlloggiatiRecordField =
  | 'type'
  | 'arrivalDate'
  | 'stayDays'
  | 'lastName'
  | 'firstName'
  | 'gender'
  | 'dateOfBirth'
  | 'bornInItaly'
  | 'birthComune'
  | 'birthProvince'
  | 'birthCountry'
  | 'citizenship'
  | 'documentType'
  | 'documentNumber'
  | 'documentIssuePlace';

interface AlloggiatiRowCodesDto {
  type: string | null;
  birthComune: string | null;
  birthCountry: string | null;
  citizenship: string | null;
  documentType: string | null;
  documentTypeDescription: string | null;
  documentIssuePlace: string | null;
}

export interface AlloggiatiGuestRowDto {
  stayGuestId: string | null;
  position: number;
  type: StayGuestType;
  isMinor: boolean | null;
  arrivalDate: string;
  stayDays: number;
  lastName: string;
  firstName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  bornInItaly: boolean | null;
  birthComune: string;
  birthProvince: string | null;
  birthCountry: string;
  citizenship: string;
  requiresDocument: boolean;
  documentType: DocumentType | null;
  /**
   * Document number with only its last characters visible (`*****567`), like on the guest portal; null when none is on
   * file. The full number comes from `GET /alloggiati/{bookingId}/stay-guests/document-numbers` (audited).
   */
  documentNumberMasked: string | null;
  documentIssuePlace: string;
  codes: AlloggiatiRowCodesDto;
  missingFields: AlloggiatiRecordField[];
  codesToComplete: AlloggiatiRecordField[];
  compositionIssue: 'member_without_head' | 'head_without_members' | 'invalid_type' | null;
  dataSource: StayGuestDataSource;
  enteredAt: string | null;
}

export type StayGuestDataSource = 'NotRecorded' | 'GuestPortal' | 'Host';

/** Full document number of a guest (`GET /alloggiati/{bookingId}/stay-guests/document-numbers`). */
export interface StayGuestDocumentNumberDto {
  position: number;
  stayGuestId: string | null;
  documentNumber: string;
}

export interface AlloggiatiGuestSummaryDto {
  bookingId: string;
  status: AlloggiatiWebStatus;
  arrivalDate: string;
  stayDays: number;
  stayExceedsMaxDays: boolean;
  declaredGuests: number;
  dataComplete: boolean;
  exportReady: boolean;
  missingCodeTables: AlloggiatiCodeTable[];
  guests: AlloggiatiGuestRowDto[];
}

export interface MarkAlloggiatiSentManuallyRequest {
  sentOn: string;
}
