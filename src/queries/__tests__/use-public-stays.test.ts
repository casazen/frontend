import { describe, expect, it } from 'vitest';
import { cleanStaysQuery } from '../use-public-stays';

/**
 * What the home and the results of a booking site ask the server. The server refuses a stay with only one of its two dates (422
 * `public_stays_dates_invalid`), and the page used to show that as «Non riusciamo a mostrare le strutture» the moment a guest
 * clicked the arrival in the calendar, before choosing the departure.
 */
describe('cleanStaysQuery', () => {
  it('cleanStaysQuery_OnlyTheArrivalChosen_AsksWithoutDates', () => {
    const clean = cleanStaysQuery({ checkIn: '2026-11-12', checkOut: '', adults: 2 });

    expect(clean).toEqual({ adults: 2 });
    expect(clean).not.toHaveProperty('checkIn');
    expect(clean).not.toHaveProperty('checkOut');
  });

  it('cleanStaysQuery_OnlyTheDepartureGiven_AsksWithoutDates', () => {
    expect(cleanStaysQuery({ checkIn: undefined, checkOut: '2026-11-14', adults: 2 })).toEqual({ adults: 2 });
  });

  it('cleanStaysQuery_BothDates_KeepsThem', () => {
    expect(cleanStaysQuery({ checkIn: '2026-11-12', checkOut: '2026-11-14', adults: 3, children: 1, pets: true })).toEqual({
      checkIn: '2026-11-12',
      checkOut: '2026-11-14',
      adults: 3,
      children: 1,
      pets: true,
    });
  });

  it('cleanStaysQuery_EmptyParts_AreLeftOutSoTheSameSearchIsTheSameKey', () => {
    expect(cleanStaysQuery({ checkIn: '', checkOut: '', adults: 2, pets: false, where: '', minPrice: undefined })).toEqual({ adults: 2 });
  });
});
