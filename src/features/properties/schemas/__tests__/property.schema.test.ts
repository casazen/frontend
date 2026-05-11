import { describe, it, expect } from 'vitest';
import { COMMON_AMENITIES, AMENITY_LABELS } from '../property.schema';

describe('COMMON_AMENITIES', () => {
  it('uses exact C# enum names (no spaces)', () => {
    for (const amenity of COMMON_AMENITIES) {
      expect(amenity).not.toContain(' ');
    }
  });

  it('includes all previously broken amenity names', () => {
    expect(COMMON_AMENITIES).toContain('AirConditioning');
    expect(COMMON_AMENITIES).toContain('BBQGrill');
    expect(COMMON_AMENITIES).toContain('FirstAidKit');
    expect(COMMON_AMENITIES).toContain('PetFriendly');
    expect(COMMON_AMENITIES).toContain('CarbonMonoxideDetector');
    expect(COMMON_AMENITIES).toContain('FireExtinguisher');
    expect(COMMON_AMENITIES).toContain('FreeParking');
    expect(COMMON_AMENITIES).toContain('HotTub');
    expect(COMMON_AMENITIES).toContain('SmokeDetector');
    expect(COMMON_AMENITIES).toContain('Terrace');
  });

  it('does not contain old display-name strings with spaces', () => {
    expect(COMMON_AMENITIES).not.toContain('Air Conditioning');
    expect(COMMON_AMENITIES).not.toContain('BBQ Grill');
    expect(COMMON_AMENITIES).not.toContain('First Aid Kit');
    expect(COMMON_AMENITIES).not.toContain('Pet Friendly');
    expect(COMMON_AMENITIES).not.toContain('Carbon Monoxide Detector');
    expect(COMMON_AMENITIES).not.toContain('Fire Extinguisher');
    expect(COMMON_AMENITIES).not.toContain('Parking');
    expect(COMMON_AMENITIES).not.toContain('Hot Tub');
    expect(COMMON_AMENITIES).not.toContain('Smoke Detector');
  });
});

describe('AMENITY_LABELS', () => {
  it('has a label for every amenity in COMMON_AMENITIES', () => {
    for (const amenity of COMMON_AMENITIES) {
      expect(AMENITY_LABELS).toHaveProperty(amenity);
    }
  });

  it('maps enum names to human-readable display labels', () => {
    expect(AMENITY_LABELS['AirConditioning']).toBe('Air Conditioning');
    expect(AMENITY_LABELS['BBQGrill']).toBe('BBQ Grill');
    expect(AMENITY_LABELS['FirstAidKit']).toBe('First Aid Kit');
    expect(AMENITY_LABELS['PetFriendly']).toBe('Pet Friendly');
    expect(AMENITY_LABELS['CarbonMonoxideDetector']).toBe('Carbon Monoxide Detector');
    expect(AMENITY_LABELS['FireExtinguisher']).toBe('Fire Extinguisher');
    expect(AMENITY_LABELS['FreeParking']).toBe('Parking');
    expect(AMENITY_LABELS['HotTub']).toBe('Hot Tub');
    expect(AMENITY_LABELS['SmokeDetector']).toBe('Smoke Detector');
  });
});
