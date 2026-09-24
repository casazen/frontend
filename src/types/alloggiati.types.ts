import type { DocumentType, Gender } from './guest.types';

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

export type AlloggiatiGuestKind = 'SingleGuest' | 'HeadOfFamilyOrGroup';

/** Record fields the host copies on the portal; names match `AlloggiatiGuestRowDto` properties. */
export type AlloggiatiRecordField =
  | 'kind'
  | 'arrivalDate'
  | 'stayDays'
  | 'lastName'
  | 'firstName'
  | 'gender'
  | 'dateOfBirth'
  | 'placeOfBirth'
  | 'citizenship'
  | 'documentType'
  | 'documentNumber'
  | 'documentIssuePlace';

/** One guest, as stored in CasaZen (text, never a table code). */
export interface AlloggiatiGuestRowDto {
  guestId: string;
  kind: AlloggiatiGuestKind;
  arrivalDate: string;
  stayDays: number;
  lastName: string;
  firstName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  placeOfBirth: string;
  citizenship: string;
  documentType: DocumentType | null;
  documentNumber: string;
  documentIssuePlace: string;
  missingFields: AlloggiatiRecordField[];
}

export interface AlloggiatiGuestSummaryDto {
  bookingId: string;
  status: AlloggiatiWebStatus;
  arrivalDate: string;
  stayDays: number;
  /** The portal accepts at most 30 days per schedina. */
  stayExceedsMaxDays: boolean;
  /** Guests declared on the booking; only `guests` are registered in CasaZen. */
  declaredGuests: number;
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
