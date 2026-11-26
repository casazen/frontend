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

/** Where the guests of a stay stand on the channel manager (`ChannelManagerWriteState` of the backend, by name). */
export type ChannelManagerWriteState = 'NotApplicable' | 'NothingWritten' | 'InProgress' | 'Entrusted' | 'Failed';

/**
 * One guest of a stay as it stands on the channel manager (`AlloggiatiChannelManagerGuestDto`). No name and no document: the position of the guest in the stay (from 0,
 * as the stay lists them), the state and the codes.
 */
export interface AlloggiatiChannelManagerGuestDto {
  position: number;
  state: OctorateSyncStatus;
  /** Written as a draft (the sender was not the channel manager): not entrusted. */
  sentAsDraft: boolean;
  /** Why the last attempt failed (`place_not_recognized`, `octorate_auth`, ...); a code this version does not know gets the generic words. Null after a success. */
  errorCode: string | null;
  /** The fields of the guest to correct for `place_not_recognized` (`birthComune`, `residenceComune`, `documentIssuePlace`, comma separated); null otherwise. */
  errorFields: string | null;
  attempts: number;
  /** UTC instant of the last attempt. */
  lastAttemptAt: string | null;
}

/** Whether an archived receipt covers the arrival day of the stay: the only thing that makes it green. */
export interface AlloggiatiReceiptCoverageDto {
  archived: boolean;
  /** `casazen_receipt` or `manual_upload`; null when none. */
  source: string | null;
  /** UTC instant; null when none or when it has no date. */
  archivedAt: string | null;
}

/**
 * The guests of a stay on the channel manager and the receipt that covers its arrival day (`AlloggiatiChannelManagerDto`): the block the per-stay status and the compliance of a
 * booking share, built by the server from the same facts and rules as the cockpit. The client never works a light out: it shows the one the server says.
 */
export interface AlloggiatiChannelManagerDto {
  /** Who sends the police communication of the stay, as far as CasaZen can rely on it (`ChannelManager` only while the connector is on). */
  sender: ComplianceSenderType;
  state: ChannelManagerWriteState;
  /** The guests written to the channel manager, by position; empty when it is not the sender. */
  guests: AlloggiatiChannelManagerGuestDto[];
  receiptCoverage: AlloggiatiReceiptCoverageDto;
  /** The light of the cockpit for the stay: yellow for an entrusted stay without a receipt, never green without one; null before the arrival day or when nothing is due. */
  light: ComplianceLightName | null;
  /** The stable reason of the light (`receipt_archived`, `entrusted_to_channel_manager`, `alloggiati_failed`, ...); null with no light. */
  reason: string | null;
  /** What can help: `RetryOctorateWrite` when asking again can mend a write that failed. */
  actions: string[];
}

/** The outcome of a send of the guests to the channel manager (`OctorateCheckInSendState`). */
export type OctorateCheckInSendState = 'NotMirrored' | 'NotApplicable' | 'NothingToSend' | 'Sent' | 'PartlyFailed' | 'Failed';

/** What the retry of the write of the guests did (`POST /alloggiati/{bookingId}/retry-octorate-write`): the outcome and, when it did nothing, why. No personal data. */
export interface AlloggiatiRetryResultDto {
  state: OctorateCheckInSendState;
  /** Why nothing was tried (`sender_not_channel_manager`, `booking_not_active`, ...); null when guests were tried. */
  reason: string | null;
}

export interface AlloggiatiStatusDto {
  directSubmission?: boolean;
  directAttempt?: string | null;
  canDownloadDirectReceipt?: boolean;
  bookingId: string;
  status: AlloggiatiWebStatus;
  /** Receipt reference, only with `Inviato`. */
  confirmationNumber: string | null;
  /** Stable error code, only with `Errore` or `Rifiutato`. */
  errorCode: string | null;
  /** Sent (receipt) or declared sent by the host; null while not sent. */
  reportedAt: string | null;
  /** Legal deadline (UTC instant): arrival + 24 h, or + 6 h for a stay of at most one night. */
  deadlineAt: string;
  isShortStay: boolean;
  hoursUntilDeadline: number;
  isOverdue: boolean;
  dataComplete: boolean;
  /** The guests on the channel manager, the sender and the receipt coverage (E20/F01/US01/T02); null or missing where the status is answered without it. */
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

/** Official codes of a guest's line, from the imported tables (null = to complete or not part of the line). */
export interface AlloggiatiRowCodesDto {
  type: string | null;
  birthComune: string | null;
  birthCountry: string | null;
  citizenship: string | null;
  documentType: string | null;
  documentTypeDescription: string | null;
  documentIssuePlace: string | null;
}

/** One guest of the stay, as stored in CasaZen; `codes` are official codes found in the imported tables. */
export interface AlloggiatiGuestRowDto {
  /** Null for the booker shown before any guest is registered. */
  stayGuestId: string | null;
  position: number;
  type: StayGuestType;
  /** Under 18 on the arrival date; null without a date of birth. */
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
  /** Record fields missing or not accepted by the record. */
  missingFields: AlloggiatiRecordField[];
  /** Record fields whose official code is still to complete: they block only the export. */
  codesToComplete: AlloggiatiRecordField[];
  /** `member_without_head` or `head_without_members`; null when the guest fits the order of the stay. */
  compositionIssue: 'member_without_head' | 'head_without_members' | 'invalid_type' | null;
  /** Who entered the data (CO-09): the guest on the portal, the host, or not recorded (booker record, older data). */
  dataSource: StayGuestDataSource;
  /** When the data was entered; null for the booker shown before any guest is registered. */
  enteredAt: string | null;
}

/** Author of the data of a guest of the stay (API enum `StayGuestDataSource`). */
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
  /** The portal accepts at most 30 days per schedina. */
  stayExceedsMaxDays: boolean;
  /** Guests declared on the booking; `guests` are the ones registered. */
  declaredGuests: number;
  /** Every guest has every record field and the order of the guests is valid. */
  dataComplete: boolean;
  /** Data complete and every official code found: the record can be exported. */
  exportReady: boolean;
  /** Official tables not imported yet. */
  missingCodeTables: AlloggiatiCodeTable[];
  /** In record order: a head of family or group before its members. */
  guests: AlloggiatiGuestRowDto[];
}

export interface MarkAlloggiatiSentManuallyRequest {
  /** `yyyy-MM-dd`, from the check-in date to today (Europe/Rome). */
  sentOn: string;
}

export interface CheckInGuestDto {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string | null;
  placeOfBirth: string;
  nationality: string;
  gender?: Gender | null;
  documentType?: DocumentType | null;
  documentNumber: string;
  documentExpiryDate?: string | null;
  documentIssuingCountry: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  documentScanUrl?: string | null;
}

export interface CheckInContextDto {
  bookingId: string;
  guestId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  guest: CheckInGuestDto;
  dataComplete: boolean;
}

export interface SubmitGuestCheckInRequest {
  dateOfBirth: string;
  placeOfBirth: string;
  nationality: string;
  gender: Gender;
  documentType: DocumentType;
  documentNumber: string;
  documentExpiryDate?: string | null;
  documentIssuingCountry: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  consentAccepted: boolean;
}

export interface GuestCheckInDataResponse {
  dataComplete: boolean;
}

export interface GuestDocumentUploadResponse {
  documentScanUrl: string;
}
