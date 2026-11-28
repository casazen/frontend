import type { PropertyModeChange } from './property-mode.types';
import type { RatingSummary } from './review.types';
import type { SwissPlace } from './swiss-places.types';

export type RentalMode = 'Short' | 'Long';

export const ACCOMMODATION_TYPES = ['Apartment', 'HouseOrVilla', 'TrulloOrMasseria', 'LoftOrPenthouse', 'RoomOrSuite'] as const;
export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];

export type SmokingPolicy = 'No' | 'OutdoorsOnly' | 'Yes';
export type PetsPolicy = 'No' | 'OnRequest' | 'Yes';
export type PartiesPolicy = 'No' | 'OnRequest';
export type ChildrenPolicy = 'No' | 'OnRequest' | 'Yes';

type PropertyLifecycleStatus = 'NeedsAttention' | 'Active' | 'Paused' | 'Suspended';

type PropertySiteVisibility = 'Published' | 'Hidden' | 'NotReady';

export interface Property {
  id: string;
  name: string;
  description: string;
  address: string;
  unit?: string | null;
  city: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  minNights?: number | null;
  weekendSurchargePercent?: number;
  rentalMode?: RentalMode;
  cleaningFee: number;
  damageDeposit: number;
  amenities: string[];
  photoUrls: string[];
  houseRules: string;
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
  childrenPolicy?: ChildrenPolicy | null;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
  extraGuestFeePerNight?: number | null;
  lifecycleStatus?: PropertyLifecycleStatus;
  occupancy30?: number;
  photoCount?: number;
  coverPhotoUrl?: string;
  siteVisibility?: PropertySiteVisibility;
  suspensionReasons?: string[];
  cinCode: string | null;
  country: 'IT' | 'CH';
  currency: 'EUR' | 'CHF';
  /**
   * ISTAT code (6 digits, text) of the comune chosen from the official list (SU-04); null until chosen: it is never
   * inferred from the free-text `city`.
   */
  comuneIstatCode?: string | null;
  regionCode?: string | null;
  /** The CIN is valid and its ISTAT comune differs from `comuneIstatCode`: a non-blocking warning. */
  cinIstatMismatch?: boolean;
  swissMunicipalityCode?: string | null;
  swissMunicipalityName?: string | null;
  swissCantonCode?: string | null;
  swissPlace?: SwissPlace | null;
  timezone: string;
  cancellationPolicyId: string | null;
  cancellationFullRefundHours?: number | null;
  cancellationPartialRefundHours?: number | null;
  cancellationPartialRefundPercent?: number | null;
  cancellationRefundType?: 'Percent' | 'NonRefundable';
  isActive: boolean;
  isPaused: boolean;
  pausedAt: string | null;
  complianceStatus?: string | null;
  slug?: string | null;
  /**
   * The change of rental mode that waits for its day (PM-02, AM-13b): in the list asked with `?view=overview`, for a property in either
   * mode, and only while it is `Scheduled`; absent otherwise. The same object `GET /properties/:id/mode` gives as `scheduledChange`.
   */
  scheduledModeChange?: PropertyModeChange | null;
  cadastralSheet?: string | null;
  cadastralParcel?: string | null;
  cadastralSubaltern?: string | null;
  cadastralCategory?: string | null;
  cadastralIncome?: number | null;
  ownerId: string;
  responsibleUserId?: string | null;
  orgId?: string;
  missing?: PropertyMissingItem[];
  createdAt: string;
  updatedAt: string;
}

export interface PropertyMissingItem {
  /** `base_data`, `cin`, `documents`, `safety`, `activation_not_confirmed` (blocking) or `photos`, `calendar` (advice). */
  code: string;
  blocking: boolean;
}

export interface PropertyCadastralData {
  sheet: string | null;
  parcel: string | null;
  subaltern: string | null;
  category: string | null;
  income: number | null;
}

export interface ApeIdentification {
  code: string;
  energyClass: string;
}

export interface CreatePropertyDto {
  name: string;
  description: string;
  address: string;
  unit?: string | null;
  city: string;
  postalCode: string;
  /**
   * ISTAT code of the comune chosen from the official list (`GET /api/comuni`): validated by the API, the region follows it.
   * `null` clears it; a city changed without a comune clears the stored one.
   */
  comuneIstatCode?: string | null;
  swissMunicipalityCode?: string | null;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;
  minNights?: number | null;
  weekendSurchargePercent?: number;
  rentalMode?: RentalMode;
  cleaningFee?: number;
  damageDeposit?: number;
  amenities?: string[];
  houseRules?: string;
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
  childrenPolicy?: ChildrenPolicy | null;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
  extraGuestFeePerNight?: number | null;
  cinCode?: string | null;
  ticinoStructureId?: string | null;
  timezone?: string;
  cancellationPolicyId?: string | null;
  cancellationFullRefundHours?: number | null;
  cancellationPartialRefundHours?: number | null;
  cancellationPartialRefundPercent?: number | null;
  cancellationRefundType?: 'Percent' | 'NonRefundable';
  slug?: string | null;
  country?: 'IT' | 'CH';
  currency?: 'EUR' | 'CHF';
}

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

export interface CancellationPolicyOption {
  id: string;
  name: string;
  description: string;
  fullRefundHours: number;
  partialRefundPercent: number;
  partialRefundHours: number;
  slug?: string;
}

export interface PlanUsage {
  used: number;
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

export type CinStatus = 'Valid' | 'Missing' | 'Invalid';

export interface PublicPropertyDto {
  id: string;
  slug?: string | null;
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
  currency?: string;
  amenities: string[];
  photoUrls: string[];
  cinCode: string | null;
  cinStatus: CinStatus;
  timezone: string;
}

export interface PublicLocalizedText {
  it: string;
  en?: string | null;
}

/**
 * The cancellation policy of a property as a page can draw it (DB-03b): the catalog policy with what the host changed of it for a
 * stay under `longStayNights` nights. A window the policy does not have is `null` (`fullRefundHours` null = never refunded in full).
 * `description` is the catalog text, `null` once the host changed the windows (`hostOverrideApplies`). The dates of a stay are in
 * the quote (`cancellation`), not here.
 */
export interface PublicCancellationPolicy {
  slug: string;
  name: string;
  description: string | null;
  fullRefundHours: number | null;
  partialRefundHours: number | null;
  partialRefundPercent: number | null;
  hostOverrideApplies: boolean;
  longStayNights: number;
}

export interface PublicHighlight {
  icon: string;
  title: PublicLocalizedText;
  text?: PublicLocalizedText | null;
}

export const PUBLIC_POI_TYPES = ['beach', 'sight', 'food', 'shop', 'transport', 'health', 'parking'] as const;

export interface PublicPointOfInterest {
  id: string;
  type: string;
  name: PublicLocalizedText | string;
  mode: 'walk' | 'car';
  minutes: number;
  bearingDeg: number;
  distanceM: number;
}

export interface PublicFloorPlanLevel {
  id: string;
  name: PublicLocalizedText | string;
  imageUrl: string;
  alt?: PublicLocalizedText | string | null;
  areaSqm?: number | null;
}

interface PublicFloorPlan {
  levels: PublicFloorPlanLevel[];
}

export type PublicAreaKind = 'Country' | 'Coast' | 'Historic';

/**
 * What the host chose to say about the house beyond the fields every property has (DB-11a, the wizard «Aggiungi immobile» of SR-07a
 * and the site profile). Every member is optional: **the page shows a block only when its data is there**, never a placeholder, and
 * never says what the host did not say (D24, D37). A member that an older backend does not send is simply absent.
 */
interface PublicPropertyProfile {
  areaSqm?: number | null;
  beds?: number | null;
  floorLevel?: number | null;
  renovatedYear?: number | null;
  energyClass?: string | null;
  energyIndex?: number | null;
  areaKind?: PublicAreaKind | null;
  childrenWelcome?: boolean | null;
  checkInFrom?: string | null;
  checkInTo?: string | null;
  checkOutBy?: string | null;
  smokingPolicy?: SmokingPolicy | null;
  petsPolicy?: PetsPolicy | null;
  partiesPolicy?: PartiesPolicy | null;
  quietHoursFrom?: string | null;
  quietHoursTo?: string | null;
  videoUrl?: string | null;
  tourUrl?: string | null;
  zone?: PublicLocalizedText | null;
  near?: PublicLocalizedText | null;
  floorNote?: PublicLocalizedText | null;
  outdoorNote?: PublicLocalizedText | null;
  checkInMethod?: PublicLocalizedText | null;
  rulesNote?: PublicLocalizedText | null;
  highlights?: PublicHighlight[] | null;
  safetyNotes?: PublicLocalizedText[] | null;
  tags?: string[] | null;
  pointsOfInterest?: PublicPointOfInterest[] | null;
  floorPlan?: PublicFloorPlan | null;
}

export interface PublicPropertyDetailDto extends PublicPropertyDto, PublicPropertyProfile {
  houseRules: string;
  cancellationPolicySummary: string;
  cancellationPolicy?: PublicCancellationPolicy | null;
  minNights: number | null;
  weekendSurchargePercent?: number;
  currency: string;
  acceptsBookings?: boolean;
  hostName?: string | null;
  publicPhone?: string | null;
  canonicalUrl?: string | null;
  ratingSummary?: RatingSummary;
}

interface PublicCalendarDayDto {
  date: string;
  available: boolean;
  nightlyPriceCents: number;
  minNights: number;
  maxNights?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  minAdvanceDays?: number | null;
  maxAdvanceDays?: number | null;
}

export interface PublicCalendarDto {
  propertyId: string;
  startDate: string;
  endDate: string;
  today: string;
  currency: string;
  days: PublicCalendarDayDto[];
  generatedAt: string;
}

type OtaSyncStatus = 'Pending' | 'InProgress' | 'Success' | 'Failed' | null;

export interface PropertyDocumentDto {
  id: string;
  fileName: string;
  fileType: string;
  documentType: PropertyDocumentType;
  uploadedAt: string;
  downloadUrl: string;
  apeCode?: string | null;
  apeEnergyClass?: string | null;
  apeCheck?: ApeCheckOutcome | null;
  apeUnreadFields?: string[] | null;
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

interface BookingsSummaryDto {
  totalBookings: number;
  upcomingBookings: number;
  activeBookings: number;
  nextCheckIn: string | null;
  nextCheckOut: string | null;
}

interface PricingAdapterSummaryDto {
  isEnabled: boolean;
  lastAdaptedAt: string | null;
  nextRunOn: string | null;
}

export interface PropertyDetailDto {
  id: string;
  ownerId: string;
  rentalMode?: RentalMode;
  name: string;
  description: string;
  address: string;
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
  ticinoStructureId?: string | null;
  /** The property is in canton Ticino: its guests go to the cantonal police (notifiche.ti.ch), not to Alloggiati Web. */
  isInTicino?: boolean;
  /** The CIN is valid and its ISTAT comune differs from the property's chosen comune: a non-blocking warning (SU-04). */
  cinIstatMismatch?: boolean;
  /** ISTAT code of the comune chosen from the official list; null until chosen. */
  comuneIstatCode?: string | null;
  regionCode?: string | null;
  timezone: string;
  amenities: string[];
  photoUrls: string[];
  houseRules: string;
  isActive: boolean;
  isPaused: boolean;
  pausedAt: string | null;
  createdAt: string;
  updatedAt: string;
  documents: PropertyDocumentDto[];
  otaIntegrations: OtaIntegrationSummaryDto[];
  bookingsSummary: BookingsSummaryDto;
  pricingAdapterSummary: PricingAdapterSummaryDto;
  country: 'IT' | 'CH';
  currency: 'EUR' | 'CHF';
}

export interface PropertyPauseStatus {
  isPaused: boolean;
  pausedAt: string | null;
}

export interface PropertySearchParams {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  minBathrooms?: number;
  guests?: number;
}
