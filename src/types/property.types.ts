/**
 * Property record of `GET /properties/{id}` (and rows of `GET /properties`). Amounts are in euros; the API has no
 * country nor currency field (A2-27). The record never carries the bookings of the property (A2-32).
 */
export interface Property {
  id: string;
  name: string;
  description: string;
  address: string;
  /** Interno / scala (PC-06): tells apart the apartments of one building; `null` when the property has none. */
  unit?: string | null;
  city: string;
  postalCode: string;
  /** WGS84 degrees, -90..90, six decimals (about 0.1 m, A2-33); 0 with a longitude of 0 = not set. */
  latitude?: number;
  /** WGS84 degrees, -180..180, six decimals. */
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
  /** Host-set pause (A2-05): hidden from public search/bookings until reactivated with `POST /properties/:id/activate`. */
  isPaused: boolean;
  /** ISO instant the property was paused; `null` when not paused. */
  pausedAt: string | null;
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
  /** Interno / scala; `null` or blank clears it. The same address and unit twice in an org is a 409 `duplicate_property_address`. */
  unit?: string | null;
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
  houseRules?: string;
  cinCode?: string | null;
  timezone?: string;
  cancellationPolicyId?: string | null;
  slug?: string | null;
}

/**
 * Body of `PUT /properties/{id}`, which has PATCH semantics (A2-04): a field left out keeps its stored value;
 * `cinCode`, `slug` and `cancellationPolicyId` sent as `null` are cleared.
 */
export type UpdatePropertyDto = Partial<CreatePropertyDto>;

/**
 * Photo gallery of a property (`GET /properties/{id}/images`, PC-04) and the answer of every change to it: the photo
 * URLs in display order (absolute public URLs of the storage; the first is the cover that the public pages show first)
 * and the rules the upload enforces. The photos are never part of `CreatePropertyDto` / `UpdatePropertyDto`: the API
 * ignores a `photoUrls` sent there.
 */
export interface PropertyPhotosDto {
  photoUrls: string[];
  maxPhotos: number;
  maxFilesPerRequest: number;
  maxFileSizeBytes: number;
  allowedContentTypes: string[];
}

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
  /**
   * Current slug of the org that owns the property: with `slug`, the property page of its booking site
   * (`/book/{orgSlug}/property/{slug}`). Absent only from an older backend (BK-20, A3-27).
   */
  orgSlug?: string;
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
  /** Absolute URL of the property page on the public domain, from the backend (BK-15); null when it is not configured. */
  canonicalUrl?: string | null;
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
  /** Interno / scala (PC-06); `null` when the property has none. */
  unit?: string | null;
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
  /** Host-set pause (A2-05): hidden from public search/bookings until reactivated. */
  isPaused: boolean;
  /** ISO instant the property was paused; `null` when not paused. */
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: PropertyDocumentDto[];
  otaIntegrations: OtaIntegrationSummaryDto[];
  bookingsSummary: BookingsSummaryDto;
  pricingAdapterSummary: PricingAdapterSummaryDto;
}

/** `POST /properties/:id/pause` and `POST /properties/:id/activate` (A2-05): the pause state right after the change. */
export interface PropertyPauseStatus {
  isPaused: boolean;
  pausedAt: string | null;
}

/**
 * Filters of the public search, all optional (BK-20, A8-13): `city` is a part of the name, the minimums are inclusive,
 * `guests` is the number of guests the property must sleep. Every one of them is sent to `GET /api/properties/search`.
 */
export interface PropertySearchParams {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  guests?: number;
}
