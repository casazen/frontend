export type DocumentType = 'Passport' | 'IdentityCard' | 'DriversLicense' | 'Other';
export type Gender = 'Male' | 'Female' | 'Other';

export interface GuestSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  city: string;
  country: string;
  createdAt: Date | string;
}

export interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;

  dateOfBirth?: Date | string;
  placeOfBirth: string;
  nationality: string;
  gender?: Gender;
  documentType?: DocumentType;
  documentNumberMasked: string | null;
  documentIssueDate?: Date | string;
  documentExpiryDate?: Date | string;
  documentIssuingCountry: string;
  hasDocumentScan: boolean;

  notes: string;

  dataProcessingConsentDate?: Date | string;
  consentDate?: Date | string;
  consentVersion: string;
  marketingConsent: boolean;
  marketingConsentDate?: Date | string;
  dataRetentionExpiryDate?: Date | string;
  dataProcessingPurpose: string;
  erasureRequested: boolean;
  erasureRequestedDate?: Date | string;
  dataAnonymizedDate?: Date | string;
  isDeleted: boolean;
  deletedAt?: Date | string;
  deletionReason: string;

  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface GuestDocumentNumber {
  guestId: string;
  documentNumber: string;
}

export interface GuestListParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateGuestDto {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  dateOfBirth?: Date | string;
  placeOfBirth?: string;
  nationality?: string;
  documentType?: DocumentType;
  documentNumber?: string;
  documentIssueDate?: Date | string;
  documentExpiryDate?: Date | string;
  documentIssuingCountry?: string;
  gender?: Gender;
  notes?: string;
}

export type UpdateGuestDto = Partial<CreateGuestDto>;
