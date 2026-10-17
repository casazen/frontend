import { describe, expect, it } from 'vitest';
import type { PublicPropertyDto } from '@/types';
import { positiveCount, propertyCardSections, propertyPlace, sectionsOfProperty } from '../property-card-sections';

function property(overrides: Partial<PublicPropertyDto> = {}): PublicPropertyDto {
  return {
    id: 'p-1',
    name: 'Casa del Faro',
    description: 'Vista mare',
    city: 'Camogli',
    postalCode: '16032',
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 120,
    cleaningFee: 30,
    amenities: [],
    photoUrls: [],
    cinCode: 'IT010009C2ABCDEFGH',
    cinStatus: 'Valid',
    timezone: 'Europe/Rome',
    ...overrides,
  };
}

const NOTHING = { place: false, cin: false, description: false, facts: false };

describe('property card sections', () => {
  it('positiveCount_NotAPositiveNumber_IsNull', () => {
    expect(positiveCount(3)).toBe(3);
    expect(positiveCount(0)).toBeNull();
    expect(positiveCount(Number.NaN)).toBeNull();
    expect(positiveCount('3')).toBeNull();
    expect(positiveCount(undefined)).toBeNull();
  });

  it('propertyPlace_CityAndPostalCode_WhicheverTheyHave', () => {
    expect(propertyPlace({ city: 'Roma', postalCode: '00153' })).toBe('Roma (00153)');
    expect(propertyPlace({ city: ' Roma ', postalCode: '' })).toBe('Roma');
    expect(propertyPlace({ city: '', postalCode: '00153' })).toBe('(00153)');
    expect(propertyPlace({ city: '', postalCode: '' })).toBe('');
  });

  it('sectionsOfProperty_CompleteProperty_HasEverything', () => {
    expect(sectionsOfProperty(property())).toEqual({ place: true, cin: true, description: true, facts: true });
  });

  it('sectionsOfProperty_MissingParts_AreLeftOut', () => {
    expect(
      sectionsOfProperty(
        property({ city: '', postalCode: '', description: '', cinStatus: 'Missing', cinCode: null, bedrooms: 0, bathrooms: 0, maxGuests: 0 }),
      ),
    ).toEqual(NOTHING);
  });

  it('sectionsOfProperty_ValidStatusWithoutCode_HasNoCin', () => {
    expect(sectionsOfProperty(property({ cinStatus: 'Valid', cinCode: null })).cin).toBe(false);
    expect(sectionsOfProperty(property({ cinStatus: 'Invalid', cinCode: 'XX' })).cin).toBe(false);
  });

  it('propertyCardSections_EmptyList_HasNothing', () => {
    expect(propertyCardSections([])).toEqual(NOTHING);
  });

  it('propertyCardSections_Cards_HaveEveryPartThatAnyOfThemHas', () => {
    const bare = property({ city: '', postalCode: '', description: '', cinStatus: 'Missing', cinCode: null, bedrooms: 0, bathrooms: 0, maxGuests: 0 });

    expect(propertyCardSections([bare, property({ description: '' }), bare])).toEqual({ place: true, cin: true, description: false, facts: true });
    expect(propertyCardSections([bare, property({ cinStatus: 'Missing', cinCode: null })])).toEqual({ place: true, cin: false, description: true, facts: true });
    expect(propertyCardSections([bare, bare])).toEqual(NOTHING);
  });
});
