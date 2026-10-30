import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { LISTING_DESCRIPTION_MAX, LISTING_TITLE_MAX, suggestListingText, type ListingTextInput } from '../suggest-listing-text';

const t = i18n.getFixedT('it');

const apartment: ListingTextInput = {
  accommodationType: 'Apartment',
  name: 'Casa Lago',
  city: 'Como',
  maxGuests: 4,
  bedrooms: 2,
  beds: 3,
  bathrooms: 1,
  areaSqm: '',
  amenities: [],
};

describe('suggestListingText', () => {
  it('suggestListingText_WhatWasEntered_SaysThatAndNothingElse', () => {
    const text = suggestListingText({ ...apartment, areaSqm: '70', amenities: ['WiFi', 'Pool', 'Garden', 'Gym'] }, t);

    // Every word comes from a field of the first steps: no «check-in semplice», no view, no quiet. Only the first three amenities.
    expect(text.title).toBe('Appartamento a Como · 4 ospiti');
    expect(text.description).toBe(
      'Appartamento «Casa Lago» a Como. Ospita fino a 4 persone. 2 camere da letto, 3 letti e 1 bagno. Superficie: 70 m². Tra le dotazioni: WiFi, Piscina e Giardino.',
    );
  });

  it('suggestListingText_DataMissing_LeavesTheSentenceOut', () => {
    const text = suggestListingText({ ...apartment, accommodationType: 'RoomOrSuite', bedrooms: 0, beds: 1, maxGuests: 1, name: '' }, t);

    // No name, no area, no amenity: those sentences are not made up. A studio flat has no bedrooms, and says so.
    expect(text.title).toBe('Stanza o suite a Como · 1 ospite');
    expect(text.description).toBe('Stanza o suite a Como. Ospita 1 persona. Monolocale, 1 letto e 1 bagno.');
  });

  it('suggestListingText_LongNames_StaysInsideTheLimitsOfTheFields', () => {
    const name = 'Villa dei Cipressi Secolari con Vista Sul Lago e Sulle Montagne '.repeat(8).trim().slice(0, 100);
    const city = 'Sant’Angelo in Pontano di Sopra e di Sotto Frazione';
    const text = suggestListingText({ ...apartment, name, city, amenities: ['WiFi', 'Pool', 'Garden'] }, t);

    expect(text.title.length).toBeLessThanOrEqual(LISTING_TITLE_MAX);
    expect(text.description.length).toBeLessThanOrEqual(LISTING_DESCRIPTION_MAX);
    // The headline falls back to the kind and the place when the guests do not fit, and is never cut in the middle of a word.
    const plain = `Appartamento a ${city}`;
    expect(plain.startsWith(text.title)).toBe(true);
    expect([' ', undefined]).toContain(plain[text.title.length]);
  });
});
