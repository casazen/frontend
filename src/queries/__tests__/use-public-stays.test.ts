import { describe, expect, it } from 'vitest';
import { cleanStaysQuery } from '../use-public-stays';

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
