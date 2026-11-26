import type { TFunction } from 'i18next';
import { SITE_TAGS, countTags, isSiteTag, type SiteTag } from '@/features/public-site/cards/site-tags';
import { maxGuestsOf } from '@/features/public-site/home/home-model';
import { formatPrice, formatPriceAmount } from '@/features/public-site/stay/stay-format';
import { currencyCodeOf } from '@/lib/money-format';
import type { PublicStayCard, PublicStaysFacets } from '@/types/public-stays.types';
import { AREA_STEP, PRICE_STEP, areaBounds, boundsFromRange, priceBounds, type Bounds } from './filters-model';

/**
 * What the currency of the price sliders and their chips is, as the data say it:
 * - `pending`: the homes the facets come from are not in yet, so nothing is known (this is not «none»: nothing about the currency is written yet);
 * - `one`: every home that says a currency says the same one (`SearchFacets.currency`);
 * - `mixed`: the homes say different currencies, so a slider has no one currency to name;
 * - `none`: no home says a usable one (the data lack it, or give something that is not a code).
 */
export type FacetsCurrencyState = 'pending' | 'one' | 'mixed' | 'none';

/**
 * What the controls of the results need to know about the homes they search (DB-07c): how many guests a home takes, how far the price
 * and size sliders go and the labels to press with their counts (the pet is always asked: the list says which homes take it). The results of one
 * booking site work it out from every home of the site (`facetsOfCards`); the search across all the sites gets it from the server for
 * the place asked (`facetsOfServer`), since it never has all the homes at hand. The sheet, the bar and the chips read this and do not
 * care where it comes from.
 */
export interface SearchFacets {
  /** Most guests any home takes; `undefined` while that is not known (the picker then has no limit). */
  maxGuests: number | undefined;
  /** In the currency of the homes (`currency`) per night, as a number; `null` when the homes do not differ. */
  prices: Bounds | null;
  /** In square metres. */
  areas: Bounds | null;
  tags: { tag: SiteTag; count: number }[];
  /**
   * What the price sliders and their chips are written in (ISO 4217: `EUR`, or `CHF` for the homes in Switzerland). Only what the data says: the one
   * currency the homes say (`currencyState` `one`), else `null`: while the homes are not in (`pending`), when they say different ones (`mixed`) and when
   * none says a usable one (`none`).
   */
  currency: string | null;
  /** Why `currency` is what it is: `writeFacetPrice` writes a price the way each state asks, and a price chip waits while it is `pending`. */
  currencyState: FacetsCurrencyState;
}

/** The part of the facets that says how a price of the filters is written. */
export type FacetsCurrency = Pick<SearchFacets, 'currency' | 'currencyState'>;

/** Nothing is known yet: no limits, no slider, no label, and nothing about the currency (not even that there is none). */
export const NO_FACETS: SearchFacets = { maxGuests: undefined, prices: null, areas: null, tags: [], currency: null, currencyState: 'pending' };

/** The currency the homes of a list say, from the codes they gave. */
function currencyOfCodes(codes: ReadonlySet<string>): FacetsCurrency {
  if (codes.size === 1) return { currency: [...codes][0], currencyState: 'one' };
  return { currency: null, currencyState: codes.size === 0 ? 'none' : 'mixed' };
}

/** The facets of a booking site, from every home of it; `undefined` while the homes are not in (nothing is known yet). */
export function facetsOfCards(cards: readonly PublicStayCard[] | undefined): SearchFacets {
  if (!cards) return NO_FACETS;
  // A home that says no usable currency does not count: the homes of a site share theirs, and if they ever do not, no one currency is chosen for them.
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

/**
 * The facets the server worked out for the place asked in the search across all the sites. `undefined` while the answer is on its way (nothing is known
 * yet); `null` when the answer came, or failed, without any (nothing is known, and the data say no currency).
 */
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

/**
 * A price of the filters (a number of the currency of the homes, per night) written the way the facets say:
 * - one currency: in it (`150 CHF`);
 * - no usable currency (`none`): the amount and the phrase that says the currency is not available (`150 (valuta non disponibile)`);
 * - different currencies (`mixed`): the number alone, with no symbol and no phrase: the currency is not missing, a slider just has no one to name;
 * - `pending`: the number alone as well (nothing is known about the currency yet), though the chip of the price is not drawn until it is.
 */
export function writeFacetPrice(value: number, facets: FacetsCurrency, locale: string, t: TFunction): string {
  if (facets.currencyState === 'mixed' || facets.currencyState === 'pending') return formatPriceAmount(value * 100, locale);
  return formatPrice(value * 100, facets.currency, locale, t);
}
