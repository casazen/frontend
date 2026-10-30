import type { PublicStayCard } from '@/types/public-stays.types';
import type { SearchFilters } from './search-state';

/**
 * What the filters of the results work out from the homes of the site (DB-07c): how far the sliders go and which of the options the
 * server could not apply. Pure functions; the sheet and the chips use them.
 */

export interface Bounds {
  min: number;
  max: number;
}

/** The sliders move in steps of ten euros and five square metres: finer than that is a number nobody chooses. */
export const PRICE_STEP = 10;
export const AREA_STEP = 5;

function boundsOf(values: readonly number[], step: number): Bounds | null {
  const known = values.filter((value) => Number.isFinite(value) && value > 0);
  if (known.length < 2) return null;
  const min = Math.floor(Math.min(...known) / step) * step;
  const max = Math.ceil(Math.max(...known) / step) * step;
  return max > min ? { min, max } : null;
}

/** The lowest and the highest night price among the homes, in euros, rounded outwards; `null` when they do not differ (a slider with nothing to choose). */
export function priceBounds(cards: readonly Pick<PublicStayCard, 'price'>[]): Bounds | null {
  return boundsOf(cards.map((card) => card.price.perNightCents / 100), PRICE_STEP);
}

/** The smallest and the largest home among those that said their size, in square metres. */
export function areaBounds(cards: readonly Pick<PublicStayCard, 'areaSqm'>[]): Bounds | null {
  return boundsOf(cards.map((card) => card.areaSqm ?? 0), AREA_STEP);
}

/**
 * The filters without the values the server said it could not apply (`unsupportedFilters`: `amenities:Crib`, `rules:children`...).
 * A filter that cannot be applied is not offered and not kept in the address, so a link never says more than the list shows.
 */
export function dropUnsupported(filters: SearchFilters, unsupported: readonly string[]): SearchFilters {
  if (unsupported.length === 0) return filters;
  const out = new Set(unsupported);
  return {
    ...filters,
    amenities: filters.amenities.filter((amenity) => !out.has(`amenities:${amenity}`)),
    rules: filters.rules.filter((rule) => !out.has(`rules:${rule}`)),
    tags: filters.tags.filter((tag) => !out.has(`tags:${tag}`)),
  };
}

/** Whether the server left this option out of what it can apply. */
export function isUnsupported(unsupported: readonly string[], kind: 'amenities' | 'rules', value: string): boolean {
  return unsupported.includes(`${kind}:${value}`);
}
