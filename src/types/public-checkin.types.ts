export type GuestCheckInSessionStatus =
  | 'Inviato'
  | 'InCompilazione'
  | 'Completo'
  | 'AlloggiatiInviato'
  | 'Scaduto';

export interface PublicCheckInGuestPrefill {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth?: string | null;
  nationality: string;
  documentNumber: string;
  documentIssuingCountry: string;
  placeOfBirth: string;
}

export interface PublicCheckInContextDto {
  sessionId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  status: GuestCheckInSessionStatus;
  guestPrefill?: PublicCheckInGuestPrefill | null;
}

export interface PublicCheckInSubmitRequest {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  nationality: string;
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
