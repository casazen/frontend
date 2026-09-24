import { describe, expect, it } from 'vitest';
import { ISO_COUNTRY_CODES, getCountryOptions, isIsoCountryCode } from '@/lib/countries';

describe('countries', () => {
  it('ISO_COUNTRY_CODES_OfficiallyAssignedCodes_AreUniqueAlpha2', () => {
    expect(ISO_COUNTRY_CODES).toHaveLength(249);
    expect(new Set(ISO_COUNTRY_CODES).size).toBe(249);
    expect(ISO_COUNTRY_CODES.every((code) => /^[A-Z]{2}$/.test(code))).toBe(true);
  });

  it('isIsoCountryCode_UnknownOrLowercaseCode_ReturnsFalse', () => {
    expect(isIsoCountryCode('IT')).toBe(true);
    expect(isIsoCountryCode('it')).toBe(false);
    expect(isIsoCountryCode('XX')).toBe(false);
    expect(isIsoCountryCode('')).toBe(false);
  });

  it('getCountryOptions_ItalianLocale_UsesLocalizedNamesSortedByName', () => {
    const options = getCountryOptions('it');

    expect(options).toHaveLength(249);
    expect(options.find((o) => o.code === 'DE')?.name).toBe('Germania');
    expect(options.find((o) => o.code === 'IT')?.name).toBe('Italia');
    const names = options.map((o) => o.name);
    expect(names).toEqual([...names].sort(new Intl.Collator('it').compare));
  });

  it('getCountryOptions_EnglishLocale_UsesEnglishNames', () => {
    expect(getCountryOptions('en').find((o) => o.code === 'DE')?.name).toBe('Germany');
  });
});
