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

/** Body of `POST /public/checkin/{token}` (API DTO `PublicCheckInSubmitRequest`). */
export interface PublicCheckInSubmitRequest {
  guests: StayGuestSubmit[];
  gdprConsent: boolean;
  marketingConsent: boolean;
}

/** One entry of an official Alloggiati table. */
export interface AlloggiatiCodeEntryDto {
  table: AlloggiatiCodeTable;
  code: string;
  description: string;
  province?: string | null;
}

export interface CheckInSessionStatusDto {
  sessionId?: string | null;
  status?: GuestCheckInSessionStatus | null;
  sentAt?: string | null;
  completedAt?: string | null;
}

export interface ResendCheckInLinkResponse {
  success: boolean;
  message?: string | null;
}
