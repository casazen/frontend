import type { RatingSummary } from './review.types';

export type PublicStayReason =
  | 'busy'
  | 'min_nights'
  | 'arrival_closed'
  | 'departure_closed'
  | 'max_nights'
  | 'advance'
  | 'guests'
  | 'pets'
  | 'past'
  | 'not_bookable';

export type PublicStayTaxState = 'exact' | 'estimated' | 'notIncluded';

export interface PublicLocalizedText {
  it: string;
  en?: string | null;
}

interface PublicStayAvailability {
  available: boolean;
  reason?: PublicStayReason | null;
  minNights?: number | null;
  firstFreeCheckIn?: string | null;
}

interface PublicStayPrice {
  currency: string;
  perNightCents: number;
  totalCents?: number | null;
  includesTouristTax?: PublicStayTaxState | null;
}

interface PublicStayCancellation {
  fullRefundUntil?: string | null;
  partialRefundPercent?: number | null;
  partialRefundUntil?: string | null;
  selfServiceAvailable: boolean;
}

export interface PublicStayCard {
  id: string;
  slug?: string | null;
  name: string;
  comune: string;
  zone?: string | PublicLocalizedText | null;
  latitude: number;
  longitude: number;
  photos: string[];
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  areaSqm?: number | null;
  amenities: string[];
  tags: string[];
  rating?: RatingSummary | null;
  availability: PublicStayAvailability;
  price: PublicStayPrice;
  cancellation?: PublicStayCancellation | null;
  orgSlug?: string | null;
  hostName?: string | null;
  country?: string | null;
}

export interface PublicStayAlternative {
  checkIn: string;
  checkOut: string;
  availableCount: number;
  fromPerNightCents: number;
}

export interface PublicStaysResult {
  currency: string;
  checkIn?: string | null;
  checkOut?: string | null;
  nights?: number | null;
  adults: number;
  children: number;
  pets: boolean;
  totalCount: number;
  availableCount: number;
  page: number;
  pageSize: number;
  items: PublicStayCard[];
  alternatives: PublicStayAlternative[];
  unsupportedFilters: string[];
  generatedAt: string;
  facets?: PublicStaysFacets | null;
}

export interface PublicStaysFacets {
  minNightCents?: number | null;
  maxNightCents?: number | null;
  maxGuests: number;
  minAreaSqm?: number | null;
  maxAreaSqm?: number | null;
  petsAllowed: boolean;
  tags: { tag: string; count: number }[];
  currency?: string | null;
}

export type PublicStaysSort = 'recommended' | 'priceAsc' | 'priceDesc' | 'rating' | 'largest';

export interface PublicStaysQuery {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  pets?: boolean;
  where?: string;
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  minSqm?: number;
  amenities?: string;
  rules?: string;
  tags?: string;
  sort?: PublicStaysSort;
  page?: number;
  pageSize?: number;
}

export interface PublicSiteCalendarDay {
  date: string;
  anyAvailable: boolean;
  fromPriceCents?: number | null;
  minNights?: number | null;
}

export interface PublicSiteCalendar {
  from: string;
  to: string;
  today: string;
  currency: string;
  adults: number;
  children: number;
  days: PublicSiteCalendarDay[];
  generatedAt: string;
}

export interface PublicDestination {
  id: string;
  label: string;
  comune: string;
  count: number;
}
