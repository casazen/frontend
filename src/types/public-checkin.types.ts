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

export interface PublicCheckInGuestPrefill {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string | null;
  nationality: string;
  gender?: GuestGender | null;
  /** Document number on file with only its last characters visible (e.g. `*****567`), never the full number. */
  documentNumberMasked?: string | null;
  documentIssuingCountry: string;
  placeOfBirth: string;
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
  guestPrefill?: PublicCheckInGuestPrefill | null;
}

/** Body of `POST /public/checkin/{token}` (API DTO `PublicCheckInSubmitRequest`). */
export interface PublicCheckInSubmitRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
  gender: AlloggiatiGender;
  documentType: string;
  documentNumber: string;
  documentIssuingCountry: string;
  placeOfBirth: string;
  gdprConsent: boolean;
  marketingConsent: boolean;
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
