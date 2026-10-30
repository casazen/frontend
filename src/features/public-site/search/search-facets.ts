import { SITE_TAGS, countTags, isSiteTag, type SiteTag } from '@/features/public-site/cards/site-tags';
import { maxGuestsOf, petsAllowedOf } from '@/features/public-site/home/home-model';
import type { PublicStayCard, PublicStaysFacets } from '@/types/public-stays.types';
import { AREA_STEP, PRICE_STEP, areaBounds, boundsFromRange, priceBounds, type Bounds } from './filters-model';

/**
 * What the controls of the results need to know about the homes they search (DB-07c): how many guests a home takes, whether the switch
 * of the pet is worth offering, how far the price and size sliders go and the labels to press with their counts. The results of one
 * booking site work it out from every home of the site (`facetsOfCards`); the search across all the sites gets it from the server for
 * the place asked (`facetsOfServer`), since it never has all the homes at hand. The sheet, the bar and the chips read this and do not
 * care where it comes from.
 */
export interface SearchFacets {
  /** Most guests any home takes; `undefined` while that is not known (the picker then has no limit). */
  maxGuests: number | undefined;
  petsAllowed: boolean;
  /** In euros per night; `null` when the homes do not differ. */
  prices: Bounds | null;
  /** In square metres. */
  areas: Bounds | null;
  tags: { tag: SiteTag; count: number }[];
  /** What the price sliders and their chips are written in (ISO 4217: `EUR`, or `CHF` for the homes in Switzerland). */
  currency: string;
}

const DEFAULT_CURRENCY = 'EUR';

/** Nothing is known yet: no limits, the switch of the pet offered, no slider, no label. */
export const NO_FACETS: SearchFacets = { maxGuests: undefined, petsAllowed: true, prices: null, areas: null, tags: [], currency: DEFAULT_CURRENCY };

/** The facets of a booking site, from every home of it. */
export function facetsOfCards(cards: readonly PublicStayCard[]): SearchFacets {
  const currencies = new Set(cards.map((card) => card.price.currency).filter(Boolean));
  return {
    maxGuests: maxGuestsOf(cards),
    petsAllowed: petsAllowedOf(cards),
    prices: priceBounds(cards),
    areas: areaBounds(cards),
    tags: countTags(cards),
    // The homes of a site share their currency; if they ever do not, the sliders speak euros.
    currency: currencies.size === 1 ? [...currencies][0] : DEFAULT_CURRENCY,
  };
}

/** The facets the server worked out for the place asked in the search across all the sites. */
export function facetsOfServer(facets: PublicStaysFacets | null | undefined): SearchFacets {
  if (!facets) return NO_FACETS;
  const counts = new Map(facets.tags.filter((item) => isSiteTag(item.tag)).map((item) => [item.tag, item.count]));
  return {
    maxGuests: facets.maxGuests > 0 ? facets.maxGuests : undefined,
    petsAllowed: facets.petsAllowed,
    prices: boundsFromRange(
      typeof facets.minNightCents === 'number' ? facets.minNightCents / 100 : null,
      typeof facets.maxNightCents === 'number' ? facets.maxNightCents / 100 : null,
      PRICE_STEP,
    ),
    areas: boundsFromRange(facets.minAreaSqm, facets.maxAreaSqm, AREA_STEP),
    tags: SITE_TAGS.filter((tag) => counts.has(tag)).map((tag) => ({ tag, count: counts.get(tag) ?? 0 })),
    currency: facets.currency || DEFAULT_CURRENCY,
  };
}
