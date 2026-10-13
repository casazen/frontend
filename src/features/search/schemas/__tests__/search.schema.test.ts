import { describe, expect, it } from 'vitest';
import { SEARCH_LIMITS, parseOptionalNumber, searchFiltersSchema } from '../search.schema';

function messages(input: unknown): Record<string, string> {
  const result = searchFiltersSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

describe('parseOptionalNumber', () => {
  it.each([[''], ['   '], [null], [undefined]])('parseOptionalNumber_Empty_%j_IsNoFilterNotNaN', (value) => {
    expect(parseOptionalNumber(value)).toBeUndefined();
  });

  it.each([
    ['0', 0],
    ['12', 12],
    ['12.5', 12.5],
    [' 7 ', 7],
    [3, 3],
  ])('parseOptionalNumber_%j_Returns%j', (value, expected) => {
    expect(parseOptionalNumber(value)).toBe(expected);
  });

  it('parseOptionalNumber_Garbage_IsNaNSoTheSchemaCanRefuseIt', () => {
    expect(parseOptionalNumber('abc')).toBeNaN();
  });
});

describe('searchFiltersSchema (BK-20, A8-13)', () => {
  it('searchFiltersSchema_OnlyTheCity_IsValid_TheOtherFieldsAreNoFilter', () => {
    // The bug: with valueAsNumber the empty number inputs were NaN and "Cerca" did nothing until all were filled.
    expect(searchFiltersSchema.safeParse({ city: 'Como' }).success).toBe(true);
    expect(searchFiltersSchema.safeParse({}).success).toBe(true);
    expect(
      searchFiltersSchema.safeParse({
        city: 'Como',
        minPrice: undefined,
        maxPrice: undefined,
        minBedrooms: undefined,
        minBathrooms: undefined,
        guests: undefined,
      }).success,
    ).toBe(true);
  });

  it('searchFiltersSchema_AllFilters_AreKept', () => {
    const result = searchFiltersSchema.parse({
      city: '  Como ',
      minPrice: 50,
      maxPrice: 200,
      minBedrooms: 2,
      minBathrooms: 1,
      guests: 4,
    });

    expect(result).toEqual({ city: 'Como', minPrice: 50, maxPrice: 200, minBedrooms: 2, minBathrooms: 1, guests: 4 });
  });

  it.each(['minPrice', 'maxPrice', 'minBedrooms', 'minBathrooms', 'guests'])('searchFiltersSchema_%s_NaN_IsRefusedWithAMessage', (field) => {
    expect(messages({ [field]: Number.NaN })[field]).toBe('search.errors.invalidNumber');
  });

  it.each(['minPrice', 'maxPrice', 'minBedrooms', 'minBathrooms'])('searchFiltersSchema_%s_Negative_IsRefused', (field) => {
    expect(messages({ [field]: -1 })[field]).toBe('search.errors.negative');
  });

  it('searchFiltersSchema_Guests_ZeroOrNegative_IsRefused', () => {
    expect(messages({ guests: 0 }).guests).toBe('search.errors.guestsMin');
    expect(messages({ guests: -2 }).guests).toBe('search.errors.guestsMin');
  });

  it.each(['minBedrooms', 'minBathrooms', 'guests'])('searchFiltersSchema_%s_Fraction_IsRefused', (field) => {
    expect(messages({ [field]: 1.5 })[field]).toBe('search.errors.wholeNumber');
  });

  it('searchFiltersSchema_PriceMayHaveCents', () => {
    expect(searchFiltersSchema.safeParse({ minPrice: 49.9, maxPrice: 120.5 }).success).toBe(true);
  });

  it('searchFiltersSchema_ValuesOverTheBackendLimits_AreRefused', () => {
    expect(messages({ minPrice: SEARCH_LIMITS.priceMax + 1 }).minPrice).toBe('search.errors.tooHigh');
    expect(messages({ minBedrooms: SEARCH_LIMITS.roomsMax + 1 }).minBedrooms).toBe('search.errors.tooHigh');
    expect(messages({ guests: SEARCH_LIMITS.guestsMax + 1 }).guests).toBe('search.errors.tooHigh');
    expect(messages({ city: 'a'.repeat(SEARCH_LIMITS.cityMaxLength + 1) }).city).toBe('search.errors.cityTooLong');
    expect(searchFiltersSchema.safeParse({ minPrice: SEARCH_LIMITS.priceMax, guests: SEARCH_LIMITS.guestsMax }).success).toBe(true);
  });

  it('searchFiltersSchema_MinPriceAboveMaxPrice_IsRefusedOnTheMaxField', () => {
    expect(messages({ minPrice: 300, maxPrice: 100 }).maxPrice).toBe('search.errors.priceRange');
    expect(searchFiltersSchema.safeParse({ minPrice: 100, maxPrice: 100 }).success).toBe(true);
    expect(searchFiltersSchema.safeParse({ minPrice: 300 }).success).toBe(true);
  });

  it('searchFiltersSchema_SeveralWrongFields_ReportsEveryOne', () => {
    const result = messages({ minPrice: -5, minBedrooms: 1.5, guests: 0 });

    expect(Object.keys(result).sort()).toEqual(['guests', 'minBedrooms', 'minPrice']);
  });
});
