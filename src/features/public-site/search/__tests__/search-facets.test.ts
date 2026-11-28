import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { PublicStayCard, PublicStaysFacets } from '@/types/public-stays.types';
import { NO_FACETS, facetsOfCards, facetsOfServer, writeFacetPrice, type FacetsCurrency } from '../search-facets';

function card(overrides: Partial<PublicStayCard> = {}): PublicStayCard {
  return {
    id: 'p-1',
    slug: 'casa',
    name: 'Casa',
    comune: 'Como',
    latitude: 45.81,
    longitude: 9.08,
    photos: [],
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: 'EUR', perNightCents: 12000 },
    ...overrides,
  };
}

describe('facetsOfServer (SEARCH-GLOBAL): the controls of the search across all the sites read what the server worked out for the place', () => {
  it('FacetsOfServer_AnswerWithoutFacets_OffersNothingThatIsNotKnown', () => {
    expect(facetsOfServer(undefined)).toEqual(NO_FACETS);
    expect(facetsOfServer(null).maxGuests).toBeUndefined();
  });

  it('FacetsOfServer_AnswerOnItsWay_IsNotKnownYetAndAnswerWithoutFacets_SaysNoCurrency', () => {
    expect(NO_FACETS.currencyState).toBe('pending');
    expect(facetsOfServer(undefined).currencyState).toBe('pending');
    expect(facetsOfServer(null).currencyState).toBe('none');
    expect(facetsOfServer(null).currency).toBeNull();
  });

  it('FacetsOfServer_TheReachOfTheSlidersIsTheOneOfTheServerRoundedOutwards', () => {
    const facets: PublicStaysFacets = {
      minNightCents: 11_850,
      maxNightCents: 30_200,
      maxGuests: 8,
      minAreaSqm: 32,
      maxAreaSqm: 140,
      petsAllowed: true,
      tags: [
        { tag: 'piscina', count: 3 },
        { tag: 'mare', count: 5 },
        { tag: 'sconosciuta', count: 1 },
      ],
      currency: 'EUR',
    };

    const result = facetsOfServer(facets);

    expect(result.prices).toEqual({ min: 110, max: 310 });
    expect(result.areas).toEqual({ min: 30, max: 140 });
    expect(result.maxGuests).toBe(8);
    expect(result.tags).toEqual([
      { tag: 'mare', count: 5 },
      { tag: 'piscina', count: 3 },
    ]);
  });

  it('FacetsOfServer_HomesInSwitzerland_WriteTheSlidersInFrancs', () => {
    const result = facetsOfServer({ minNightCents: 15_000, maxNightCents: 40_000, maxGuests: 6, petsAllowed: false, tags: [], currency: 'CHF' });

    expect(result.currency).toBe('CHF');
    expect(result.currencyState).toBe('one');
    expect(result.prices).toEqual({ min: 150, max: 400 });
  });

  it('FacetsOfServer_NoCurrencySaid_HasNoCurrencyAndNoneIsGuessed', () => {
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [] }).currency).toBeNull();
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [], currency: null }).currency).toBeNull();
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [], currency: '' }).currency).toBeNull();
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [], currency: 'XX1' }).currency).toBeNull();
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [], currency: '' }).currencyState).toBe('none');
    expect(NO_FACETS.currency).toBeNull();
  });

  it('FacetsOfServer_HomesThatDoNotDiffer_HaveNoSlider', () => {
    const result = facetsOfServer({ minNightCents: 15_000, maxNightCents: 15_000, maxGuests: 4, petsAllowed: true, tags: [] });

    expect(result.prices).toBeNull();
  });
});

describe('facetsOfCards (DB-07c): a site reads the same from every home it has', () => {
  it('FacetsOfCards_HomesThatShareACurrency_SpeakIt', () => {
    expect(facetsOfCards([card({ price: { currency: 'CHF', perNightCents: 20_000 } }), card({ id: 'p-2', price: { currency: 'CHF', perNightCents: 25_000 } })]).currency).toBe('CHF');
  });

  it('FacetsOfCards_HomesOfTwoCurrencies_HaveNoCommonCurrencyAndNoneIsChosenForThem', () => {
    const facets = facetsOfCards([card(), card({ id: 'p-2', price: { currency: 'CHF', perNightCents: 20_000 } })]);

    expect(facets.currency).toBeNull();
    expect(facets.currencyState).toBe('mixed');
  });

  it('FacetsOfCards_HomesThatSayNoCurrency_HaveNoCurrency', () => {
    const silent = (id: string, currency: string | undefined) => card({ id, price: { currency: currency as string, perNightCents: 20_000 } });

    expect(facetsOfCards([silent('p-1', ''), silent('p-2', undefined)]).currency).toBeNull();
    expect(facetsOfCards([silent('p-1', ''), silent('p-2', undefined)]).currencyState).toBe('none');
    expect(facetsOfCards([silent('p-1', 'XX1')]).currencyState).toBe('none');
    expect(facetsOfCards([]).currency).toBeNull();
    expect(facetsOfCards([]).currencyState).toBe('none');
  });

  it('FacetsOfCards_HomesThatShareACurrencyWrittenTwoWays_AreOneCurrency', () => {
    const facets = facetsOfCards([card({ price: { currency: 'chf', perNightCents: 20_000 } }), card({ id: 'p-2', price: { currency: ' CHF ', perNightCents: 25_000 } })]);

    expect(facets.currency).toBe('CHF');
    expect(facets.currencyState).toBe('one');
  });

  it('FacetsOfCards_HomesNotInYet_AreNotKnownAndAreNotNone', () => {
    expect(facetsOfCards(undefined)).toEqual(NO_FACETS);
    expect(facetsOfCards(undefined).currencyState).toBe('pending');
  });

  it('FacetsOfCards_TheGuestsTheSliderAndTheLabelsComeFromTheCards', () => {
    const result = facetsOfCards([
      card({ maxGuests: 2, price: { currency: 'EUR', perNightCents: 9000 }, tags: ['mare'] }),
      card({ id: 'p-2', maxGuests: 6, price: { currency: 'EUR', perNightCents: 21_000 }, tags: ['mare', 'piscina'] }),
    ]);

    expect(result.maxGuests).toBe(6);
    expect(result.prices).toEqual({ min: 90, max: 210 });
    expect(result.tags).toEqual([
      { tag: 'mare', count: 2 },
      { tag: 'piscina', count: 1 },
    ]);
  });
});

describe('writeFacetPrice (CHF-MONEY): a price of the filters is written the way the currency of the homes says', () => {
  const italian = i18n.getFixedT('it');
  const english = i18n.getFixedT('en');
  const one = (currency: string): FacetsCurrency => ({ currency, currencyState: 'one' });
  const none: FacetsCurrency = { currency: null, currencyState: 'none' };
  const mixed: FacetsCurrency = { currency: null, currencyState: 'mixed' };
  const pending: FacetsCurrency = { currency: null, currencyState: 'pending' };

  it('WriteFacetPrice_OneCurrency_IsWrittenInIt', () => {
    expect(writeFacetPrice(150, one('CHF'), 'it-IT', italian)).toBe(new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'CHF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(150));
    expect(writeFacetPrice(150, one('EUR'), 'en-GB', english)).toContain('€');
    expect(writeFacetPrice(150, one('CHF'), 'en-GB', english)).not.toContain('€');
  });

  it('WriteFacetPrice_NoUsableCurrency_IsTheAmountAndThePhraseThatSaysItIsNotAvailable', () => {
    expect(writeFacetPrice(150, none, 'it-IT', italian)).toBe('150 (valuta non disponibile)');
    expect(writeFacetPrice(150, none, 'en-GB', english)).toBe('150 (currency not available)');
  });

  it('WriteFacetPrice_HomesOfTwoCurrencies_IsTheNumberAloneWithNoSymbolAndNoPhrase', () => {
    expect(writeFacetPrice(150, mixed, 'it-IT', italian)).toBe('150');
    expect(writeFacetPrice(150, mixed, 'en-GB', english)).toBe('150');
    expect(writeFacetPrice(150.5, mixed, 'en-GB', english)).toBe('150.50');
  });

  it('WriteFacetPrice_HomesNotInYet_IsTheNumberAlone', () => {
    expect(writeFacetPrice(150, pending, 'it-IT', italian)).toBe('150');
  });
});
