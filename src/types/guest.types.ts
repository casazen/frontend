// ✅ Complete Guest interface matching backend entity

export type DocumentType = 'Passport' | 'IdentityCard' | 'DriversLicense' | 'Other';
export type Gender = 'Male' | 'Female' | 'Other';

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

  // Alloggiati Web - Italian police reporting
  dateOfBirth?: Date | string;
  placeOfBirth: string;
  nationality: string;
  documentType?: DocumentType;
  documentNumber: string;
  documentIssueDate?: Date | string;
  documentExpiryDate?: Date | string;
  documentIssuingCountry: string;

  // GDPR Compliance
  dataProcessingConsentDate?: Date | string;
  consentIpAddress: string;
  dataRetentionExpiryDate?: Date | string;
  erasureRequested: boolean;
  erasureRequestedDate?: Date | string;
  dataAnonymizedDate?: Date | string;

  notes: string;
  gender?: Gender;
  consentDate?: Date | string;
  consentVersion: string;
  marketingConsent: boolean;
  marketingConsentDate?: Date | string;
  dataRetentionUntil: Date | string;
  dataProcessingPurpose: string;
  isDeleted: boolean;
  deletedAt?: Date | string;
  deletionReason: string;

  createdAt: Date | string;
  updatedAt: Date | string;
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

export interface UpdateGuestDto extends Partial<CreateGuestDto> {}
