import { describe, expect, it } from 'vitest';
import { filtersFromSearchParams, filtersToSearchParams, propertyResultPath } from '../search-params';
import type { PublicPropertyDto } from '@/types';

describe('filtersFromSearchParams', () => {
  it('filtersFromSearchParams_AllKeys_ReadsEveryFilter', () => {
    const filters = filtersFromSearchParams(
      new URLSearchParams('city=Como&minPrice=50&maxPrice=200.5&bedrooms=2&bathrooms=1&guests=4'),
    );

    expect(filters).toEqual({ city: 'Como', minPrice: 50, maxPrice: 200.5, minBedrooms: 2, minBathrooms: 1, guests: 4 });
  });

  it('filtersFromSearchParams_NoParams_IsNoFilter', () => {
    expect(filtersFromSearchParams(new URLSearchParams())).toEqual({});
  });

  it.each([
    'minPrice=abc',
    'minPrice=-5',
    'minPrice=1e3',
    'minPrice=',
    'maxPrice=1000001',
    'bedrooms=1.5',
    'bedrooms=51',
    'bathrooms=-1',
    'guests=0',
    'guests=101',
    'guests=NaN',
    'guests=Infinity',
  ])('filtersFromSearchParams_%s_IsIgnoredNeverNaN', (query) => {
    expect(filtersFromSearchParams(new URLSearchParams(query))).toEqual({});
  });

  it('filtersFromSearchParams_BlankCity_IsIgnoredAndLongCityIsCut', () => {
    expect(filtersFromSearchParams(new URLSearchParams('city=%20%20'))).toEqual({});
    expect(filtersFromSearchParams(new URLSearchParams(`city=${'a'.repeat(150)}`)).city).toHaveLength(100);
  });

  it('filtersFromSearchParams_UnrelatedParams_AreIgnored', () => {
    expect(filtersFromSearchParams(new URLSearchParams('utm_source=x&city=Como'))).toEqual({ city: 'Como' });
  });
});

describe('filtersToSearchParams', () => {
  it('filtersToSearchParams_OnlyTheFiltersThatAreSet_AreWritten', () => {
    const search = filtersToSearchParams({ city: ' Como ', minPrice: undefined, guests: 2, minBedrooms: 0 });

    expect(search.toString()).toBe('city=Como&bedrooms=0&guests=2');
  });

  it('filtersToSearchParams_BlankCity_IsNotWritten', () => {
    expect(filtersToSearchParams({ city: '   ' }).toString()).toBe('');
  });

  it('filtersToSearchParams_RoundTrip_KeepsTheFilters', () => {
    const filters = { city: 'Lago di Como', minPrice: 40, maxPrice: 180, minBedrooms: 1, minBathrooms: 1, guests: 3 };

    expect(filtersFromSearchParams(filtersToSearchParams(filters))).toEqual(filters);
  });
});

describe('propertyResultPath', () => {
  const property = { id: 'p-1', slug: 'casa-del-faro', orgSlug: 'villa-mare' } as PublicPropertyDto;

  it('propertyResultPath_WithOrgSlug_IsThePropertyPageOfThatOrgSite', () => {
    expect(propertyResultPath(property)).toEqual({ pathname: '/book/villa-mare/property/casa-del-faro', search: '' });
  });

  it('propertyResultPath_WithGuests_CarriesThemAsTheGuestsOfTheStay', () => {
    expect(propertyResultPath(property, 3)).toEqual({ pathname: '/book/villa-mare/property/casa-del-faro', search: 'guests=3' });
  });

  it('propertyResultPath_PropertyWithoutSlug_UsesItsId', () => {
    expect(propertyResultPath({ ...property, slug: null })?.pathname).toBe('/book/villa-mare/property/p-1');
  });

  it('propertyResultPath_WithoutOrgSlug_HasNoDestination', () => {
    expect(propertyResultPath({ ...property, orgSlug: undefined })).toBeUndefined();
    expect(propertyResultPath({ ...property, orgSlug: '' })).toBeUndefined();
  });
});
