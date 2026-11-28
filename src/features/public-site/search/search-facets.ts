import type { TFunction } from 'i18next';
import { SITE_TAGS, countTags, isSiteTag, type SiteTag } from '@/features/public-site/cards/site-tags';
import { maxGuestsOf } from '@/features/public-site/home/home-model';
import { formatPrice, formatPriceAmount } from '@/features/public-site/stay/stay-format';
import { currencyCodeOf } from '@/lib/money-format';
import type { PublicStayCard, PublicStaysFacets } from '@/types/public-stays.types';
import { AREA_STEP, PRICE_STEP, areaBounds, boundsFromRange, priceBounds, type Bounds } from './filters-model';

export type FacetsCurrencyState = 'pending' | 'one' | 'mixed' | 'none';

/**
 * What the controls of the results need to know about the homes they search (DB-07c): how many guests a home takes, how far the price
 * and size sliders go and the labels to press with their counts (the pet is always asked: the list says which homes take it). The results of one
 * booking site work it out from every home of the site (`facetsOfCards`); the search across all the sites gets it from the server for
 * the place asked (`facetsOfServer`), since it never has all the homes at hand. The sheet, the bar and the chips read this and do not
 * care where it comes from.
 */
export interface SearchFacets {
  maxGuests: number | undefined;
  prices: Bounds | null;
  areas: Bounds | null;
  tags: { tag: SiteTag; count: number }[];
  currency: string | null;
  currencyState: FacetsCurrencyState;
}

export type FacetsCurrency = Pick<SearchFacets, 'currency' | 'currencyState'>;

export const NO_FACETS: SearchFacets = { maxGuests: undefined, prices: null, areas: null, tags: [], currency: null, currencyState: 'pending' };

function currencyOfCodes(codes: ReadonlySet<string>): FacetsCurrency {
  if (codes.size === 1) return { currency: [...codes][0], currencyState: 'one' };
  return { currency: null, currencyState: codes.size === 0 ? 'none' : 'mixed' };
}

export function facetsOfCards(cards: readonly PublicStayCard[] | undefined): SearchFacets {
  if (!cards) return NO_FACETS;
  const codes = new Set<string>();
  for (const card of cards) {
    const code = currencyCodeOf(card.price.currency);
    if (code) codes.add(code);
  }
  return {
    maxGuests: maxGuestsOf(cards),
    prices: priceBounds(cards),
    areas: areaBounds(cards),
    tags: countTags(cards),
    ...currencyOfCodes(codes),
  };
}

export function facetsOfServer(facets: PublicStaysFacets | null | undefined): SearchFacets {
  if (facets === undefined) return NO_FACETS;
  if (facets === null) return { ...NO_FACETS, currencyState: 'none' };
  const counts = new Map(facets.tags.filter((item) => isSiteTag(item.tag)).map((item) => [item.tag, item.count]));
  const currency = currencyCodeOf(facets.currency);
  return {
    maxGuests: facets.maxGuests > 0 ? facets.maxGuests : undefined,
    prices: boundsFromRange(
      typeof facets.minNightCents === 'number' ? facets.minNightCents / 100 : null,
      typeof facets.maxNightCents === 'number' ? facets.maxNightCents / 100 : null,
      PRICE_STEP,
    ),
    areas: boundsFromRange(facets.minAreaSqm, facets.maxAreaSqm, AREA_STEP),
    tags: SITE_TAGS.filter((tag) => counts.has(tag)).map((tag) => ({ tag, count: counts.get(tag) ?? 0 })),
    currency,
    currencyState: currency ? 'one' : 'none',
  };
}

export function writeFacetPrice(value: number, facets: FacetsCurrency, locale: string, t: TFunction): string {
  if (facets.currencyState === 'mixed' || facets.currencyState === 'pending') return formatPriceAmount(value * 100, locale);
  return formatPrice(value * 100, facets.currency, locale, t);
}
