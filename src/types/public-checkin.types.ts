import type { InvoiceDataText, InvoiceRecipientKind } from './invoice-data.types';

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
  /** Day the document was issued (`YYYY-MM-DD`), when on file (NF-40). */
  documentIssuedOn?: string | null;
  /** Day the document expires (`YYYY-MM-DD`), when on file (NF-40). */
  documentExpiresOn?: string | null;
  /** Residence (NF-40): in Italy the comune and the province, abroad the state. Null until the guest says. */
  residenceInItaly?: boolean | null;
  residenceComuneCode?: string | null;
  residenceComuneName?: string | null;
  residenceProvince?: string | null;
  residenceCountryCode?: string | null;
  residenceCountryName?: string | null;
  /** Statistical fields (NF-40), codes of the closed lists, asked only where the region requires them. */
  tourismType?: string | null;
  travelWay?: string | null;
  educationLevel?: string | null;
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
  /**
   * The statistical fields the region requires (`TourismType`, `TravelWay`, `EducationLevel`): the page asks these and no other
   * (NF-40, data minimization). Empty when the region requires none.
   */
  requiredGuestFields?: string[];
  /** The language to open the page in (`it`, `en`, `de`, `fr`, `es`): the guest's earlier choice, else the browser's, else `it`. Open session only. */
  language?: string;
  /** The languages the guest can choose. Open session only. */
  supportedLanguages?: string[];
  /**
   * The answer to «Ti serve la fattura?» is already yes (FIS-01, E06/F02/US01/T03): the step starts with the question answered. Open session only.
   * The invoice data itself is write-only from this page (the link is anonymous): the page never receives a fiscal code, a VAT number, an address or
   * a PEC, only this flag and `hasInvoiceData`.
   */
  invoiceRequested?: boolean;
  /** The booking already has the data of an invoice recipient (the host wrote it, or the channel manager had it); never its content. Open session only. */
  hasInvoiceData?: boolean;
}

/** Answer of `PUT /public/checkin/{token}/language`: the language now saved on the session. */
export interface PublicCheckInLanguageResponse {
  language: string;
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
  /** Optional (NF-40): sent with the document, `null` when not given. */
  documentIssuedOn?: string | null;
  documentExpiresOn?: string | null;
  /** Optional residence (NF-40): in Italy comune and province, abroad the state; `null` when not said. */
  residenceInItaly?: boolean | null;
  residenceComuneName?: string | null;
  residenceComuneCode?: string | null;
  residenceProvince?: string | null;
  residenceCountryName?: string | null;
  residenceCountryCode?: string | null;
  /** Statistical fields (NF-40): present only when the region requires them (absent otherwise, never sent empty). */
  tourismType?: string | null;
  travelWay?: string | null;
  educationLevel?: string | null;
  /**
   * The tourist tax exemption the host chose (a reason code, NF-46): sent by the host's entries only. The guest portal never sends it, and the
   * server ignores it there.
   */
  taxExemptionCode?: string | null;
}

/**
 * The «Ti serve la fattura?» block of the check-in (API DTO `PublicCheckInInvoiceDto`, FIS-01, E06/F02/US01/T03): sent only for a «yes». Everything
 * but `needInvoice` is optional and write-only, a text the guest left empty is not sent, and the server checks the formats as a whole (422
 * `invoice_data_*` with the `field`, nothing saved, the check-in included). The kind of recipient and the country go with the texts, never
 * alone: a block with only a kind would ask for an identification the guest was not asked for.
 */
export interface PublicCheckInInvoiceRequest extends InvoiceDataText {
  needInvoice: boolean;
  recipientKind?: InvoiceRecipientKind;
}

/**
 * Body of `POST /public/checkin/{token}` (API DTO `PublicCheckInSubmitRequest`). No consent for the Alloggiati
 * registration (legal obligation, CO-15): only the optional marketing consent, offered when the context has its version.
 * NF-05 adds per-channel consent with a separate marketing email.
 */
export interface PublicCheckInSubmitRequest {
  guests: StayGuestSubmit[];
  /** Guest ticked the email marketing channel (NF-05). */
  marketingConsentEmail: boolean;
  /** Guest ticked the WhatsApp marketing channel (NF-05). */
  marketingConsentWhatsApp: boolean;
  /** Marketing email address (required when any channel is ticked, NF-05). */
  marketingEmail?: string | null;
  /**
   * The optional answer to «Ti serve la fattura?» (FIS-01): present only when the guest said yes. A guest who skips the step, or says no, sends no
   * block at all, and the check-in is never blocked by it.
   */
  invoice?: PublicCheckInInvoiceRequest;
}

/** One entry of an official Alloggiati table. */
export interface AlloggiatiCodeEntryDto {
  table: AlloggiatiCodeTable;
  code: string;
  description: string;
  province?: string | null;
  /** Citizenship adjective (Italiano). Absent for a place. */
  citizenshipLabel?: string | null;
}

/** Answer of `POST /public/checkin/{token}/read-document`. The photo is not returned. */
export interface CheckInDocumentReadResult {
  read: boolean;
  reason?: string | null;
  guest?: {
    firstName?: string | null;
    lastName?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
    bornInItaly?: boolean | null;
    birthPlace?: string | null;
    birthProvince?: string | null;
    citizenship?: string | null;
    documentKind?: string | null;
    documentNumber?: string | null;
    issuePlace?: string | null;
  } | null;
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

/** Biometric verification outcome (API enum `BiometricOutcome`). */
export type BiometricOutcome = 'Accept' | 'Escalate' | 'Reject';

/**
 * Response of `POST /api/public/checkin/{token}/selfie`. The backend processes the selfie
 * synchronously and returns the outcome within 3 seconds per ADR-013-R1.
 */
export interface BiometricVerificationResponse {
  outcome: BiometricOutcome;
  attemptsRemaining: number;
}

/**
 * Biometric consent request. Records the consent timestamp and version per ADR-013-R9.
 */
export interface BiometricConsentRequest {
  consentGiven: boolean;
  consentVersion: string;
  consentTimestamp: string;
}
