import { SITE_TAGS, type SiteTag } from '@/features/public-site/cards/site-tags';
import { WHERE_PARAM } from '@/features/public-site/stay/use-stay-state';
import type { StayState } from '@/features/public-site/stay/stay-state';
import type { PublicStaysQuery, PublicStaysSort } from '@/types/public-stays.types';

/**
 * The search of the booking site as its address says it (DB-07c): the place, the filters, the sort, the view and the hearts. The
 * stay (dates, guests, pet) is `stay-state.ts`; this is everything else. The address is the state: it is shared, Back finds it
 * again, and a value that makes no sense (a typed or an old link) is left out, never an error. The names are those of the API
 * (`checkin`, `checkout`, `guests`, `children`, `pets`, `where`, `minPrice`, `maxPrice`, `bedrooms`, `bathrooms`, `minSqm`,
 * `amenities`, `rules`, `tags`, `sort`) plus `view=map` and `favorites=1`, so that a link reads the same everywhere. The Italian
 * names of the prototype (`dove`, `dal`, `al`, `adulti`...) are not used.
 */
export const SEARCH_PARAMS = {
  where: WHERE_PARAM,
  minPrice: 'minPrice',
  maxPrice: 'maxPrice',
  bedrooms: 'bedrooms',
  bathrooms: 'bathrooms',
  minSqm: 'minSqm',
  amenities: 'amenities',
  rules: 'rules',
  tags: 'tags',
  sort: 'sort',
  view: 'view',
  favorites: 'favorites',
} as const;

/** The amenities of the filter, as the names of the `PropertyAmenity` enum the server takes, in the order they are offered. */
export const FILTER_AMENITIES = ['Pool', 'FreeParking', 'WiFi', 'AirConditioning', 'Terrace', 'Washer', 'Crib'] as const;
export type FilterAmenity = (typeof FILTER_AMENITIES)[number];

/** The rules of the house the filter knows (`rules` of the API): the home allows all that are asked. */
export const FILTER_RULES = ['pets', 'children', 'selfCheckin', 'smoking', 'parties'] as const;
export type FilterRule = (typeof FILTER_RULES)[number];

export const SORTS: readonly PublicStaysSort[] = ['recommended', 'priceAsc', 'priceDesc', 'rating', 'largest'];

export interface SearchFilters {
  /** Price per night, in euros. */
  minPrice: number | null;
  maxPrice: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  minSqm: number | null;
  amenities: FilterAmenity[];
  rules: FilterRule[];
  tags: SiteTag[];
}

export interface SearchState {
  /** The id of the place (a destination of the site), empty for everywhere. */
  where: string;
  filters: SearchFilters;
  sort: PublicStaysSort;
  view: 'list' | 'map';
  /** Only the homes saved with the heart on this device. */
  onlyFavorites: boolean;
}

function readInt(params: URLSearchParams, key: string, min: number, max: number): number | null {
  const text = params.get(key)?.trim() ?? '';
  if (!/^\d{1,6}$/.test(text)) return null;
  const value = Number(text);
  return value >= min && value <= max ? value : null;
}

function readList<T extends string>(params: URLSearchParams, key: string, allowed: readonly T[]): T[] {
  const wanted = new Set((params.get(key) ?? '').split(',').map((item) => item.trim()));
  return allowed.filter((item) => wanted.has(item));
}

/** The search as the address says it; what is not understood is left out. */
export function readSearch(params: URLSearchParams): SearchState {
  let minPrice = readInt(params, SEARCH_PARAMS.minPrice, 0, 100_000);
  let maxPrice = readInt(params, SEARCH_PARAMS.maxPrice, 0, 100_000);
  if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) {
    // A range upside down means nothing: keep the lower bound, which is the one a person moves first.
    maxPrice = null;
    minPrice = minPrice > 0 ? minPrice : null;
  }
  const sortText = params.get(SEARCH_PARAMS.sort)?.trim();
  const sort = SORTS.find((item) => item === sortText) ?? 'recommended';
  return {
    where: params.get(SEARCH_PARAMS.where)?.trim() ?? '',
    filters: {
      minPrice: minPrice || null,
      maxPrice,
      bedrooms: readInt(params, SEARCH_PARAMS.bedrooms, 1, 20),
      bathrooms: readInt(params, SEARCH_PARAMS.bathrooms, 1, 20),
      minSqm: readInt(params, SEARCH_PARAMS.minSqm, 1, 2000),
      amenities: readList(params, SEARCH_PARAMS.amenities, FILTER_AMENITIES),
      rules: readList(params, SEARCH_PARAMS.rules, FILTER_RULES),
      tags: readList(params, SEARCH_PARAMS.tags, SITE_TAGS),
    },
    sort,
    view: params.get(SEARCH_PARAMS.view) === 'map' ? 'map' : 'list',
    onlyFavorites: params.get(SEARCH_PARAMS.favorites) === '1',
  };
}

/** The call to the server for this stay and this search: the filters travel as the API names them. */
export function toStaysQuery(stay: StayState, search: SearchState): PublicStaysQuery {
  const { filters } = search;
  return {
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    adults: stay.adults,
    children: stay.children,
    pets: stay.pets,
    where: search.where,
    minPrice: filters.minPrice ?? undefined,
    maxPrice: filters.maxPrice ?? undefined,
    bedrooms: filters.bedrooms ?? undefined,
    bathrooms: filters.bathrooms ?? undefined,
    minSqm: filters.minSqm ?? undefined,
    amenities: filters.amenities.join(',') || undefined,
    rules: filters.rules.join(',') || undefined,
    tags: filters.tags.join(',') || undefined,
    sort: search.sort === 'recommended' ? undefined : search.sort,
  };
}
