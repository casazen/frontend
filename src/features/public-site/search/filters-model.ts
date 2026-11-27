import type { PublicStayCard } from '@/types/public-stays.types';
import type { SearchFilters } from './search-state';

export interface Bounds {
  min: number;
  max: number;
}

export const PRICE_STEP = 10;
export const AREA_STEP = 5;

function boundsOf(values: readonly number[], step: number): Bounds | null {
  const known = values.filter((value) => Number.isFinite(value) && value > 0);
  if (known.length < 2) return null;
  const min = Math.floor(Math.min(...known) / step) * step;
  const max = Math.ceil(Math.max(...known) / step) * step;
  return max > min ? { min, max } : null;
}

export function boundsFromRange(low: number | null | undefined, high: number | null | undefined, step: number): Bounds | null {
  return boundsOf([low ?? 0, high ?? 0], step);
}

export function priceBounds(cards: readonly Pick<PublicStayCard, 'price'>[]): Bounds | null {
  return boundsOf(cards.map((card) => card.price.perNightCents / 100), PRICE_STEP);
}

export function areaBounds(cards: readonly Pick<PublicStayCard, 'areaSqm'>[]): Bounds | null {
  return boundsOf(cards.map((card) => card.areaSqm ?? 0), AREA_STEP);
}

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

export function isUnsupported(unsupported: readonly string[], kind: 'amenities' | 'rules', value: string): boolean {
  return unsupported.includes(`${kind}:${value}`);
}
