import type { DocumentType, Gender } from './guest.types';
import type { AlloggiatiCodeTable, StayGuestType } from './public-checkin.types';

/**
 * State of an Alloggiati Web communication (CO-11, decision D6). CasaZen does not transmit yet: `Inviato` needs
 * a real receipt (CO-13); until then the host sends it on the Questura portal and declares it
 * (`InviatoManualmente`).
 */
export type AlloggiatiWebStatus =
  | 'DaInviare'
  | 'DaInviareManualmente'
  | 'InviatoManualmente'
  | 'Inviato'
  | 'Rifiutato'
  | 'Errore';

export interface AlloggiatiStatusDto {
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
  documentNumber: string;
  documentIssuePlace: string;
  codes: AlloggiatiRowCodesDto;
  /** Record fields missing or not accepted by the record. */
  missingFields: AlloggiatiRecordField[];
  /** Record fields whose official code is still to complete: they block only the export. */
  codesToComplete: AlloggiatiRecordField[];
  /** `member_without_head` or `head_without_members`; null when the guest fits the order of the stay. */
  compositionIssue: 'member_without_head' | 'head_without_members' | 'invalid_type' | null;
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

export const ALLOGGIATI_CHECKIN_CONSENT_VERSION = '2026-06-01';
