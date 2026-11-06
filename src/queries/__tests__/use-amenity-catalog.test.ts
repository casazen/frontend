import { describe, expect, it } from 'vitest';
import type { AmenityCatalog } from '@/types';
import { amenityLabelOf, labelLanguage } from '../use-amenity-catalog';

const CATALOG: AmenityCatalog = {
  groups: [{ id: 'comfort', label: { it: 'Comfort', en: 'Comfort' } }],
  amenities: [
    { name: 'WiFi', icon: 'wifi', group: 'comfort', label: { it: 'Wi-Fi', en: 'Wi-Fi' } },
    { name: 'Washer', icon: 'shirt', group: 'comfort', label: { it: 'Lavatrice', en: 'Washing machine' } },
  ],
};

describe('the labels of the amenities (NF-33): one source, the catalog', () => {
  it('labelLanguage_EnglishForAnEnglishInterface_ItalianForAnythingElse', () => {
    expect(labelLanguage('en')).toBe('en');
    expect(labelLanguage('en-GB')).toBe('en');
    expect(labelLanguage('it')).toBe('it');
    expect(labelLanguage('fr')).toBe('it');
    expect(labelLanguage(undefined)).toBe('it');
  });

  it('amenityLabelOf_ReadsTheLabelOfTheLanguageFromTheCatalog', () => {
    expect(amenityLabelOf(CATALOG, 'Washer', 'it')).toBe('Lavatrice');
    expect(amenityLabelOf(CATALOG, 'Washer', 'en')).toBe('Washing machine');
  });

  it('amenityLabelOf_ANameTheCatalogDoesNotKnow_OrNoCatalogYet_ReadsAsAPlainPhraseNeverAKey', () => {
    expect(amenityLabelOf(CATALOG, 'HeatedFloor', 'it')).toBe('Heated floor');
    expect(amenityLabelOf(undefined, 'BBQGrill', 'en')).toBe('BBQ grill');
  });
});
