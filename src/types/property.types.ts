/**
 * Property record of `GET /properties/{id}` (and rows of `GET /properties`). Amounts are in euros; the API has no
 * country nor currency field (A2-27). The record never carries the bookings of the property (A2-32).
 */
export interface Property {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  /** 0 = studio flat (monolocale). */
  bedrooms: number;
  /** Whole number, at least 1. */
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  cleaningFee: number;
  damageDeposit: number;
  amenities: string[];
  photoUrls: string[];
  houseRules: string;
  cinCode: string | null;
  /** IANA time zone, e.g. `Europe/Rome`. */
  timezone: string;
  cancellationPolicyId: string | null;
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
  orgId?: string;
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
  postalCode: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  cleaningFee?: number;
  damageDeposit?: number;
  amenities?: string[];
  photoUrls?: string[];
  houseRules?: string;
  cinCode?: string | null;
  timezone?: string;
  cancellationPolicyId?: string | null;
  slug?: string | null;
  isActive?: boolean;
}

/**
 * Body of `PUT /properties/{id}`, which has PATCH semantics (A2-04): a field left out keeps its stored value;
 * `cinCode`, `slug` and `cancellationPolicyId` sent as `null` are cleared.
 */
export type UpdatePropertyDto = Partial<CreatePropertyDto>;

/** A cancellation policy a property can reference (`GET /properties/cancellation-policies`). */
export interface CancellationPolicyOption {
  id: string;
  name: string;
  description: string;
  fullRefundHours: number;
  partialRefundPercent: number;
  partialRefundHours: number;
}

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

/** Seasonal price suggestions of the property: on/off, last computation, next due Europe/Rome date (yyyy-MM-dd). */
export interface PricingAdapterSummaryDto {
  isEnabled: boolean;
  lastAdaptedAt: string | null;
  nextRunOn: string | null;
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
