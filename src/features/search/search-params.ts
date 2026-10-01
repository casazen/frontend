import { BOOKING_QUERY_KEYS, buildPropertyBookingPath } from '@/lib/booking-url';
import type { PublicPropertyDto } from '@/types';
import { SEARCH_LIMITS, type SearchFiltersFormValues } from './schemas/search.schema';

/**
 * The filters of the public search live in the page URL (`/search?city=Como&guests=2`): a search can be shared and
 * reopened, the back button returns to it from a property page, and a link can open it already filled in (BK-20).
 * `guests` is also the deep-link key of the property page, so the number of guests chosen here carries over.
 */
const KEYS = {
  city: 'city',
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  minBedrooms: 'bedrooms',
  minBathrooms: 'bathrooms',
  guests: 'guests',
} as const;

function readNumber(value: string | null, { min, max, integer }: { min: number; max: number; integer: boolean }): number | undefined {
  const text = value?.trim() ?? '';
  if (!/^\d+(\.\d+)?$/.test(text)) return undefined;
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) return undefined;
  if (integer && !Number.isInteger(number)) return undefined;
  return number;
}

/** The filters of a URL; a value that is missing, malformed or out of range is ignored, never `NaN`. */
export function filtersFromSearchParams(search: URLSearchParams): SearchFiltersFormValues {
  const filters: SearchFiltersFormValues = {};
  const city = search.get(KEYS.city)?.trim();
  if (city) filters.city = city.slice(0, SEARCH_LIMITS.cityMaxLength);

  const price = { min: 0, max: SEARCH_LIMITS.priceMax, integer: false };
  const rooms = { min: 0, max: SEARCH_LIMITS.roomsMax, integer: true };
  const minPrice = readNumber(search.get(KEYS.minPrice), price);
  const maxPrice = readNumber(search.get(KEYS.maxPrice), price);
  const minBedrooms = readNumber(search.get(KEYS.minBedrooms), rooms);
  const minBathrooms = readNumber(search.get(KEYS.minBathrooms), rooms);
  const guests = readNumber(search.get(KEYS.guests), { min: SEARCH_LIMITS.guestsMin, max: SEARCH_LIMITS.guestsMax, integer: true });

  if (minPrice !== undefined) filters.minPrice = minPrice;
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;
  if (minBedrooms !== undefined) filters.minBedrooms = minBedrooms;
  if (minBathrooms !== undefined) filters.minBathrooms = minBathrooms;
  if (guests !== undefined) filters.guests = guests;
  return filters;
}

/** The URL query of the filters: only the ones that are set. */
export function filtersToSearchParams(filters: SearchFiltersFormValues): URLSearchParams {
  const search = new URLSearchParams();
  if (filters.city?.trim()) search.set(KEYS.city, filters.city.trim());
  if (filters.minPrice !== undefined) search.set(KEYS.minPrice, String(filters.minPrice));
  if (filters.maxPrice !== undefined) search.set(KEYS.maxPrice, String(filters.maxPrice));
  if (filters.minBedrooms !== undefined) search.set(KEYS.minBedrooms, String(filters.minBedrooms));
  if (filters.minBathrooms !== undefined) search.set(KEYS.minBathrooms, String(filters.minBathrooms));
  if (filters.guests !== undefined) search.set(KEYS.guests, String(filters.guests));
  return search;
}

/**
 * Where a result goes: the property page of its org's booking site, with the number of guests of the search as the
 * guests of the stay. Without the org slug (an older backend) there is no page to go to: no link, rather than one that
 * leads nowhere.
 */
export function propertyResultPath(property: PublicPropertyDto, guests?: number) {
  if (!property.orgSlug) return undefined;
  return {
    pathname: buildPropertyBookingPath(property.orgSlug, property),
    search: guests ? new URLSearchParams({ [BOOKING_QUERY_KEYS.guests]: String(guests) }).toString() : '',
  };
}
