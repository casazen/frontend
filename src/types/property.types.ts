import type { RatingSummary } from './review.types';

/** How a property is let (PM-01): exclusive, a property is in the short-rent or in the long-rent section, never both. */
export type RentalMode = 'Short' | 'Long';

/** The kind of accommodation (SR-07a): the five choices of the first step of «Aggiungi immobile». */
export const ACCOMMODATION_TYPES = ['Apartment', 'HouseOrVilla', 'TrulloOrMasseria', 'LoftOrPenthouse', 'RoomOrSuite'] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

/** What the house rules say about smoking, pets and parties (SR-07a). */
export type SmokingPolicy = 'No' | 'OutdoorsOnly' | 'Yes';
export type PetsPolicy = 'No' | 'OnRequest' | 'Yes';
export type PartiesPolicy = 'No' | 'OnRequest';

/** The one state of a short-stay property in the host's list (SR-07a): derived by the server, never worked out here. */
export type PropertyLifecycleStatus = 'NeedsAttention' | 'Active' | 'Paused' | 'Suspended';

/** Where a short-stay property stands on the booking site: on it, ready but kept off (paused or switched off), or not ready. */
export type PropertySiteVisibility = 'Published' | 'Hidden' | 'NotReady';

/**
 * One thing a property still lacks (SR-07a), told by the server with a stable `code`: `base_data`, `cin`, `documents`, `safety`
 * and `activation_not_confirmed` block the activation; `photos` and `calendar` are advice.
 */
export interface PropertyMissingItem {
  code: string;
  blocking: boolean;
}

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
  /** `Short` = short-rent section, `Long` = long-rent section. Set at creation, changed only by the scheduled mode change. */
  rentalMode?: RentalMode;
  cleaningFee: number;
  damageDeposit: number;
  amenities: string[];
  photoUrls: string[];
  houseRules: string;
  /** The fields of the wizard «Aggiungi immobile» (SR-07a): `null` = the host never said. */
  accommodationType?: AccommodationType | null;
  beds?: number | null;
  /** Living area in square metres. */
  areaSqm?: number | null;
  /** The headline of the listing, at most 60 characters; `null` = the listing uses the name. */
  listingTitle?: string | null;
  /** «Mostra la casa sul sito»: `false` = the host keeps the property off the booking site (it never publishes by itself). */
  publishedOnSite?: boolean;
  /** `HH:mm:ss` on the property's clock. */
  checkInFrom?: string | null;
  checkOutBy?: string | null;
  smokingPolicy?: SmokingPolicy | null;
  petsPolicy?: PetsPolicy | null;
  partiesPolicy?: PartiesPolicy | null;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
  /** What the host asks per night for each extra guest, in euros; `null` = extra guests are not accepted. */
  extraGuestFeePerNight?: number | null;
  /**
   * Only in the rows of `GET /properties?view=overview` (SR-07a), told by the server: the one state, what is missing, the
   * occupancy of the last 30 days (percent, active properties only), the photos and where the property stands on the site.
   */
  lifecycleStatus?: PropertyLifecycleStatus;
  missing?: PropertyMissingItem[];
  occupancy30?: number;
  photoCount?: number;
  coverPhotoUrl?: string;
  siteVisibility?: PropertySiteVisibility;
  /** With `lifecycleStatus` `Suspended`: the blocker codes that suspended the property. */
  suspensionReasons?: string[];
  cinCode: string | null;
  /** ISO 3166-1 alpha-2 country code (ADR-001-R7). */
  country: 'IT' | 'CH';
  /** ISO 4217 currency code (ADR-001-R7). */
  currency: 'EUR' | 'CHF';
  /**
   * ISTAT code (6 digits, text) of the comune chosen from the official list (SU-04); null until chosen: it is never
   * inferred from the free-text `city`.
   */
  comuneIstatCode?: string | null;
  /** CasaZen's region code (`LOM`) that follows the comune; null until a comune is chosen. */
  regionCode?: string | null;
  /** The CIN is valid and its ISTAT comune differs from `comuneIstatCode`: a non-blocking warning. */
  cinIstatMismatch?: boolean;
  /** IANA time zone, e.g. `Europe/Rome`. */
  timezone: string;
  cancellationPolicyId: string | null;
  cancellationFullRefundHours?: number | null;
  cancellationPartialRefundHours?: number | null;
  cancellationPartialRefundPercent?: number | null;
  cancellationRefundType?: 'Percent' | 'NonRefundable';
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
  /**
   * The member in charge of the property (AM-03): the account id of an `OrgMember` (`userId`), told with the administrators when
   * something happens on it. `null` while nobody is named (the creator is told). Changed with `PUT /properties/:id/responsible`.
   */
  responsibleUserId?: string | null;
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
  /**
   * ISTAT code of the comune chosen from the official list (`GET /api/comuni`): validated by the API, the region follows it.
   * `null` clears it; a city changed without a comune clears the stored one.
   */
  comuneIstatCode?: string | null;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  /** Sent on creation only (an update must carry the stored mode: 422 `property_rental_mode_change_not_allowed`). */
  rentalMode?: RentalMode;
  cleaningFee?: number;
  damageDeposit?: number;
  amenities?: string[];
  houseRules?: string;
  /** The fields of the wizard «Aggiungi immobile» (SR-07a); on an update `null` clears them and leaving one out keeps it. */
  accommodationType?: AccommodationType | null;
  beds?: number | null;
  areaSqm?: number | null;
  listingTitle?: string | null;
  publishedOnSite?: boolean;
  checkInFrom?: string | null;
  checkOutBy?: string | null;
  smokingPolicy?: SmokingPolicy | null;
  petsPolicy?: PetsPolicy | null;
  partiesPolicy?: PartiesPolicy | null;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
  extraGuestFeePerNight?: number | null;
  cinCode?: string | null;
  timezone?: string;
  cancellationPolicyId?: string | null;
  cancellationFullRefundHours?: number | null;
  cancellationPartialRefundHours?: number | null;
  cancellationPartialRefundPercent?: number | null;
  cancellationRefundType?: 'Percent' | 'NonRefundable';
  slug?: string | null;
  /** ISO 3166-1 alpha-2 country code (ADR-001-R7). */
  country?: 'IT' | 'CH';
  /** ISO 4217 currency code (ADR-001-R7), auto-derived from country. */
  currency?: 'EUR' | 'CHF';
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
  /** Stable identifier of the catalog (SR-07a): the name and the description may be reworded, the slug never. */
  slug?: string;
}

/**
 * How many properties the org has of how many its plan allows (`GET /properties/plan-usage`, SR-07a): readable by whoever may
 * read properties, and deliberately without the name of the plan or the billing.
 */
export interface PlanUsage {
  used: number;
  /** `null` when the plan has no limit. */
  max: number | null;
  unlimited: boolean;
  canAdd: boolean;
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
  /** Count and average of the public reviews (DB-12a). Absent while the property has none: no stars, no «0 recensioni». */
  ratingSummary?: RatingSummary;
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
  /**
   * Only in the answer of an APE upload: what the automatic reading found. Anything but `Verified` is a certificate kept all the
   * same, which the landlord confirms by typing its code and energy class.
   */
  apeCheck?: ApeCheckOutcome | null;
  /** With `apeCheck` `Incomplete`: the data that were not read, in words of the language of the request. */
  apeUnreadFields?: string[] | null;
  /** With `apeCheck`: where the code found automatically came from, the file itself or the public register of the region. */
  apeIdentificationSource?: 'Document' | 'Registry' | null;
}

export type ApeCheckOutcome = 'Verified' | 'Incomplete' | 'NotRecognized' | 'NotChecked' | 'Expired';

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
  /** Section the property belongs to (PM-01). */
  rentalMode?: RentalMode;
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
  /** The CIN is valid and its ISTAT comune differs from the property's chosen comune: a non-blocking warning (SU-04). */
  cinIstatMismatch?: boolean;
  /** ISTAT code of the comune chosen from the official list; null until chosen. */
  comuneIstatCode?: string | null;
  /** CasaZen's region code that follows the comune; null until a comune is chosen. */
  regionCode?: string | null;
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
  /** ISO 3166-1 alpha-2 country code (ADR-001-R7). */
  country: 'IT' | 'CH';
  /** ISO 4217 currency code (ADR-001-R7). */
  currency: 'EUR' | 'CHF';
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
