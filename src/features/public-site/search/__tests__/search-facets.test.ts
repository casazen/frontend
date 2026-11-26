import { describe, expect, it } from 'vitest';
import type { PublicStayCard, PublicStaysFacets } from '@/types/public-stays.types';
import { NO_FACETS, facetsOfCards, facetsOfServer } from '../search-facets';

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
    // The labels the page does not know are not drawn, and the known ones come in the order of the vocabulary.
    expect(result.tags).toEqual([
      { tag: 'mare', count: 5 },
      { tag: 'piscina', count: 3 },
    ]);
  });

  it('FacetsOfServer_HomesInSwitzerland_WriteTheSlidersInFrancs', () => {
    const result = facetsOfServer({ minNightCents: 15_000, maxNightCents: 40_000, maxGuests: 6, petsAllowed: false, tags: [], currency: 'CHF' });

    expect(result.currency).toBe('CHF');
    expect(result.prices).toEqual({ min: 150, max: 400 });
  });

  it('FacetsOfServer_NoCurrencySaid_HasNoCurrencyAndNoneIsGuessed', () => {
    // The currency comes only from the data (CHF-MONEY): the sliders do not speak euros when the server did not say so.
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [] }).currency).toBeNull();
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [], currency: null }).currency).toBeNull();
    expect(facetsOfServer({ maxGuests: 2, petsAllowed: true, tags: [], currency: '' }).currency).toBeNull();
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
    // A slider has one currency: with two there is none to speak, and it is not the euro that is picked (CHF-MONEY).
    expect(facetsOfCards([card(), card({ id: 'p-2', price: { currency: 'CHF', perNightCents: 20_000 } })]).currency).toBeNull();
  });

  it('FacetsOfCards_HomesThatSayNoCurrency_HaveNoCurrency', () => {
    const silent = (id: string, currency: string | undefined) => card({ id, price: { currency: currency as string, perNightCents: 20_000 } });

    expect(facetsOfCards([silent('p-1', ''), silent('p-2', undefined)]).currency).toBeNull();
    expect(facetsOfCards([]).currency).toBeNull();
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
