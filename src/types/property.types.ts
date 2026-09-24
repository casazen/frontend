export interface Property {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;  // ✅ Fixed: was zipCode
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;  // ✅ Fixed: was pricePerNight
  cleaningFee: number;  // ✅ Added - missing from backend
  damageDeposit: number;  // ✅ Added - missing from backend
  currency: string;
  amenities: string[];
  photoUrls: string[];  // ✅ Fixed: was images
  houseRules: string;  // ✅ Added - missing from backend
  cinCode: string | null;  // ✅ Added - Italian compliance
  timezone: string;  // ✅ Added - missing from backend
  cancellationPolicyId: string | null;  // ✅ Added - missing from backend
  isActive: boolean;
  complianceStatus?: string | null;
  slug?: string | null;
  /** Cadastral identification of the unit (LT-10): used by the lease contract; the sheet also finds the concordato zone. */
  cadastralSheet?: string | null;
  cadastralParcel?: string | null;
  cadastralSubaltern?: string | null;
  cadastralCategory?: string | null;
  cadastralIncome?: number | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

/** `PUT /properties/:id/cadastral` (LT-10): empty values clear the field; only lengths are checked. */
export interface PropertyCadastralData {
  sheet: string | null;
  parcel: string | null;
  subaltern: string | null;
  category: string | null;
  income: number | null;
}

/** `PUT /properties/:id/documents/:docId/ape` (LT-10): what is printed on the APE. */
export interface ApeIdentification {
  code: string;
  energyClass: string;
}

export interface CreatePropertyDto {
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;  // ✅ Fixed: was zipCode
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;  // ✅ Fixed: was pricePerNight
  currency?: string;
  amenities?: string[];
  photoUrls?: string[];  // ✅ Fixed: was images
  cinCode?: string | null;
  slug?: string | null;
  isActive?: boolean;
}

export type UpdatePropertyDto = Partial<CreatePropertyDto>;

export type PropertyDocumentType =
  | 'CinCertificate'
  | 'FloorPlan'
  | 'InsurancePolicy'
  | 'PropertyLicense'
  | 'SafetyCompliance'
  | 'Ape'
  | 'Other';

export interface PropertyDocument {
  id: string;
  fileName: string;
  storageUrl: string;
  documentType: PropertyDocumentType;
  uploadedBy: string;
  uploadedAt: string;
}

export type CinStatus = 'Valid' | 'Missing' | 'Invalid';

/** Public list read-model (US-001 #212) — no ownerId or internal fields. */
export interface PublicPropertyDto {
  id: string;
  slug?: string | null;
  name: string;
  description: string;
  city: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  cleaningFee: number;
  amenities: string[];
  photoUrls: string[];
  cinCode: string | null;
  cinStatus: CinStatus;
  timezone: string;
}

/** Public detail read-model for branded site / checkout (US-001 #212). */
export interface PublicPropertyDetailDto extends PublicPropertyDto {
  houseRules: string;
  cancellationPolicySummary: string;
  minNights: number | null;
  currency: string;
}

export type OtaSyncStatus = 'Pending' | 'InProgress' | 'Success' | 'Failed' | null;

export interface PropertyDocumentDto {
  id: string;
  fileName: string;
  fileType: string;
  /** Kind of document: the lease form needs `Ape` on file before a contract can be drafted (A7-06). */
  documentType: PropertyDocumentType;
  uploadedAt: string;
  downloadUrl: string;
  /** APE documents only (LT-10): code and energy class printed on it; null until the landlord enters them. */
  apeCode?: string | null;
  apeEnergyClass?: string | null;
}

export interface OtaIntegrationSummaryDto {
  id: string;
  platform: string;
  syncStatus: OtaSyncStatus;
  lastSyncAt: string;
  isActive: boolean;
  syncEnabled: boolean;
}

export interface BookingsSummaryDto {
  totalBookings: number;
  upcomingBookings: number;
  activeBookings: number;
  nextCheckIn: string | null;
  nextCheckOut: string | null;
}

export interface PricingAdapterSummaryDto {
  isEnabled: boolean;
  lastAdaptedAt: string | null;
  nextScheduledRunAt: string | null;
}

export interface PropertyDetailDto {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  cleaningFee: number;
  damageDeposit: number;
  cinCode: string | null;
  cinStatus: CinStatus;
  timezone: string;
  amenities: string[];
  photoUrls: string[];
  houseRules: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documents: PropertyDocumentDto[];
  otaIntegrations: OtaIntegrationSummaryDto[];
  bookingsSummary: BookingsSummaryDto;
  pricingAdapterSummary: PricingAdapterSummaryDto;
}

export interface PropertySearchParams {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  page?: number;
  limit?: number;
}
