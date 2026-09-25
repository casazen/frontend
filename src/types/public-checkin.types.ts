export type GuestCheckInSessionStatus =
  | 'Inviato'
  | 'InCompilazione'
  | 'Completo'
  | 'AlloggiatiInviato'
  | 'Scaduto';

/** Values of the API `Gender` enum. */
export type GuestGender = 'Male' | 'Female' | 'Other';

/**
 * Genders a guest can submit: Alloggiati Web accepts only 1 = male and 2 = female
 * (tracciato record, field "Sesso"), so the API rejects `Other` on the public portal.
 */
export type AlloggiatiGender = Extract<GuestGender, 'Male' | 'Female'>;

/**
 * Kind of guest ("tipo alloggiato"): the five official categories of Alloggiati Web (RS-1). Values of the API enum
 * `StayGuestType`, never the table codes.
 */
export type StayGuestType = 'SingleGuest' | 'HeadOfFamily' | 'HeadOfGroup' | 'FamilyMember' | 'GroupMember';

/** Official Alloggiati code tables (API enum `AlloggiatiCodeTable`). */
export type AlloggiatiCodeTable = 'Comuni' | 'Stati' | 'Documenti' | 'TipiAlloggiato';

/** Lists the forms search: `luoghi` = comuni and states (place of issue of a document). */
export type AlloggiatiCodeList = 'comuni' | 'stati' | 'documenti' | 'luoghi';

/** Document kinds offered when the official document table is not imported (`Other` has no Alloggiati value). */
export type AlloggiatiDocumentKind = 'Passport' | 'IdentityCard' | 'DriversLicense';

/** A guest on file (at least the booker), to prefill the form. The document number is never returned in full. */
export interface PublicCheckInGuestPrefill {
  type: StayGuestType;
  firstName: string;
  lastName: string;
  gender?: GuestGender | null;
  dateOfBirth?: string | null;
  bornInItaly?: boolean | null;
  birthComuneCode?: string | null;
  birthComuneName: string;
  birthProvince?: string | null;
  birthCountryCode?: string | null;
  birthCountryName: string;
  citizenshipCode?: string | null;
  citizenshipName: string;
  documentType?: string | null;
  documentTypeCode?: string | null;
  /** Document number on file with only its last characters visible (e.g. `*****567`), never the full number. */
  documentNumberMasked?: string | null;
  documentIssuePlaceCode?: string | null;
  documentIssuePlaceName: string;
}

/**
 * Context of `GET /public/checkin/{token}`. Once the guest has submitted (`completed`), the API returns only
 * `completed` and `status`: no booking data and no guest data.
 */
export interface PublicCheckInContextDto {
  completed: boolean;
  status: GuestCheckInSessionStatus;
  sessionId?: string;
  propertyName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  /** Guests declared on the booking: the form starts with as many. */
  declaredGuests?: number;
  /** Guests on file in record order (head of family or group first). */
  guests?: PublicCheckInGuestPrefill[];
  /** Official tables imported: only these offer codes in the form. */
  availableCodeTables?: AlloggiatiCodeTable[];
  /** Version of the privacy notice shown (art. 13 GDPR); absent when not configured. */
  privacyNoticeVersion?: string;
  /** Version of the optional marketing consent text; absent when the consent is not offered. */
  marketingConsentVersion?: string;
}

/**
 * One guest of `POST /public/checkin/{token}` and `PUT /alloggiati/{bookingId}/stay-guests` (API DTO
 * `StayGuestSubmitDto`). Every key is always sent (null or empty when not applicable), so the payload is stable.
 */
export interface StayGuestSubmit {
  type: StayGuestType;
  firstName: string;
  lastName: string;
  gender: AlloggiatiGender;
  dateOfBirth: string;
  bornInItaly: boolean;
  birthComuneName: string;
  birthComuneCode: string | null;
  birthProvince: string | null;
  birthCountryName: string;
  birthCountryCode: string | null;
  citizenshipName: string;
  citizenshipCode: string | null;
  documentType: string | null;
  documentTypeCode: string | null;
  documentNumber: string | null;
  documentIssuePlaceName: string | null;
  documentIssuePlaceCode: string | null;
}

/**
 * Body of `POST /public/checkin/{token}` (API DTO `PublicCheckInSubmitRequest`). No consent for the Alloggiati
 * registration (legal obligation, CO-15): only the optional marketing consent, offered when the context has its version.
 */
export interface PublicCheckInSubmitRequest {
  guests: StayGuestSubmit[];
  marketingConsent: boolean;
}

/** One entry of an official Alloggiati table. */
export interface AlloggiatiCodeEntryDto {
  table: AlloggiatiCodeTable;
  code: string;
  description: string;
  province?: string | null;
}

/** Delivery of the check-in link by email (API enum `GuestCheckInLinkEmailStatus`, CO-09). */
export type CheckInLinkEmailStatus = 'NotRequested' | 'Queued' | 'Sent' | 'Failed';

/** Stable reasons of a failed link email (API `GuestCheckInLinkEmailErrors`). */
export const CHECK_IN_LINK_EMAIL_ERRORS = [
  'no_recipient',
  'provider_not_configured',
  'queue_failed',
  'rejected',
  'not_delivered',
  'link_unavailable',
  'link_not_usable',
] as const;

/**
 * The check-in link of a booking as the host sees it (`GET /bookings/{id}/checkin-session`). Every field but
 * `canIssueLink` is null when no link was ever issued; `status` is `Scaduto` once the link is past its expiry.
 */
export interface CheckInSessionStatusDto {
  sessionId?: string | null;
  status?: GuestCheckInSessionStatus | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  /** When the email was handed to the provider; null when it was not. */
  sentAt?: string | null;
  completedAt?: string | null;
  /** Null for links issued before the email outcome was recorded. */
  emailStatus?: CheckInLinkEmailStatus | null;
  emailError?: string | null;
  /** The booking accepts a new link (confirmed or checked in, check-in not completed by the guest). */
  canIssueLink: boolean;
}

/**
 * A link the host just generated (`POST /bookings/{id}/checkin/link`) or sent (`POST .../checkin/resend-link`): the
 * link is always returned, with the real state of its email.
 */
export interface CheckInLinkResponse {
  checkInLink: string;
  expiresAt: string;
  emailStatus: CheckInLinkEmailStatus;
  emailError?: string | null;
}
