import type { DocumentType, Gender } from './guest.types';

export type AlloggiatiWebStatus = 'Pending' | 'Submitted' | 'Confirmed' | 'Failed';

export interface AlloggiatiStatusDto {
  bookingId: string;
  status: AlloggiatiWebStatus;
  confirmationNumber: string | null;
  errorMessage: string | null;
  reportedAt: string | null;
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
