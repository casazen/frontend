import { describe, expect, it } from 'vitest';
import type { PublicStayCard } from '@/types/public-stays.types';
import { siteRating, zonesOf } from '../home-model';

function card(overrides: Partial<PublicStayCard>): PublicStayCard {
  return {
    id: 'p',
    name: 'Casa',
    comune: 'Ostuni',
    latitude: 40.73,
    longitude: 17.58,
    photos: [],
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 2,
    amenities: [],
    tags: [],
    availability: { available: true },
    price: { currency: 'EUR', perNightCents: 10000 },
    ...overrides,
  };
}

/** How many decimals a number is written with. */
const decimals = (value: number) => (String(value).split('.')[1] ?? '').length;

describe('zonesOf (DB-07b): the position of a zone is never more exact than the homes publish', () => {
  it('ZonesOf_HomesWithRoundedPositions_GivesAPinWithAtMostTwoDecimals', () => {
    // The middle of 40.73 and 40.74 is 40.735: written with three decimals it would be a finer position than any home gives.
    const zones = zonesOf(
      [
        card({ id: 'a', latitude: 40.73, longitude: 17.58 }),
        card({ id: 'b', latitude: 40.74, longitude: 17.59 }),
        card({ id: 'c', comune: 'Lecce', latitude: 40.35, longitude: 18.17 }),
      ],
      [],
    );

    for (const zone of zones) {
      expect(decimals(zone.lat), zone.name).toBeLessThanOrEqual(2);
      expect(decimals(zone.lon), zone.name).toBeLessThanOrEqual(2);
    }
  });

  it('ZonesOf_TwoComuni_GivesOneZoneEachWithCountLowestNightAndTheDestinationId', () => {
    const zones = zonesOf(
      [
        card({ id: 'a', price: { currency: 'EUR', perNightCents: 15000 } }),
        card({ id: 'b', price: { currency: 'EUR', perNightCents: 9000 } }),
        card({ id: 'c', comune: 'Lecce', latitude: 40.35, longitude: 18.17 }),
      ],
      [{ id: 'ostuni', label: 'Ostuni', comune: 'Ostuni', count: 2 }],
    );

    expect(zones).toHaveLength(2);
    expect(zones[0]).toMatchObject({ id: 'ostuni', name: 'Ostuni', count: 2, fromPerNightCents: 9000 });
    // A comune the server does not list yet falls back to its name, which the `where` filter also takes.
    expect(zones[1]).toMatchObject({ id: 'Lecce', count: 1 });
  });

  it('ZonesOf_HomesWithoutAPosition_KeepTheirZoneWithZeroZeroNotInTheMiddle', () => {
    // The data say «no position» with 0, 0 (the host never gave one): such a home is in its comune all the same, the map puts its pin
    // there, and its 0, 0 must not be averaged with the position of a home that has one (it would drag the pin into the Gulf of Guinea).
    const zones = zonesOf(
      [
        card({ id: 'a', comune: 'Como', latitude: 0, longitude: 0 }),
        card({ id: 'b', comune: 'Como', latitude: 45.81, longitude: 9.08 }),
        card({ id: 'c', comune: 'Roma', latitude: 0, longitude: 0 }),
        card({ id: 'd', comune: 'Milano', latitude: Number.NaN, longitude: Number.NaN }),
      ],
      [],
    );

    expect(zones.map((zone) => zone.name)).toEqual(['Como', 'Roma', 'Milano']);
    expect(zones[0]).toMatchObject({ count: 2, lat: 45.81, lon: 9.08 });
    expect(zones[1]).toMatchObject({ count: 1, lat: 0, lon: 0 });
    expect(zones[2]).toMatchObject({ count: 1, lat: 0, lon: 0 });
  });

  it('ZonesOf_HomeWithoutAComune_IsInNoZone', () => {
    expect(zonesOf([card({ id: 'a', comune: '  ' })], [])).toHaveLength(0);
  });
});

describe('siteRating (DB-07b)', () => {
  it('SiteRating_NoReviews_IsNull', () => {
    expect(siteRating([card({}), card({ rating: null })])).toBeNull();
  });

  it('SiteRating_TwoHomes_WeighsEachByItsReviews', () => {
    const rating = siteRating([card({ rating: { count: 9, average: 5 } }), card({ rating: { count: 1, average: 3 } })]);

    expect(rating).toEqual({ count: 10, average: 4.8 });
  });
});
