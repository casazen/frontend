import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '@/i18n/config';
import { COMMON_AMENITIES, propertyFormSchema } from '../property.schema';
import { getAmenityLabel } from '@/lib/i18n-labels';

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
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('has a translated label for every amenity in COMMON_AMENITIES', () => {
    const t = i18n.getFixedT('en');
    for (const amenity of COMMON_AMENITIES) {
      const label = getAmenityLabel(amenity, t);
      expect(label).toBeTruthy();
      expect(label).not.toBe(`amenity.${amenity}`);
    }
  });

  it('maps enum names to human-readable English display labels', () => {
    const t = i18n.getFixedT('en');
    expect(getAmenityLabel('AirConditioning', t)).toBe('Air Conditioning');
    expect(getAmenityLabel('BBQGrill', t)).toBe('BBQ Grill');
    expect(getAmenityLabel('FirstAidKit', t)).toBe('First Aid Kit');
    expect(getAmenityLabel('PetFriendly', t)).toBe('Pet Friendly');
    expect(getAmenityLabel('CarbonMonoxideDetector', t)).toBe('Carbon Monoxide Detector');
    expect(getAmenityLabel('FireExtinguisher', t)).toBe('Fire Extinguisher');
    expect(getAmenityLabel('FreeParking', t)).toBe('Parking');
    expect(getAmenityLabel('HotTub', t)).toBe('Hot Tub');
    expect(getAmenityLabel('SmokeDetector', t)).toBe('Smoke Detector');
  });

  it('returns Italian labels when locale is Italian', async () => {
    await i18n.changeLanguage('it');
    const t = i18n.getFixedT('it');
    expect(getAmenityLabel('AirConditioning', t)).toBe('Aria condizionata');
    expect(getAmenityLabel('Kitchen', t)).toBe('Cucina');
    expect(getAmenityLabel('FreeParking', t)).toBe('Parcheggio');
  });
});

describe('propertyFormSchema cinCode', () => {
  const cinSchema = propertyFormSchema.shape.cinCode;

  it.each(['IT058091C27G5FFZDZ', 'IT015146A12HOLV2MZ', 'IT-048017-B4-2742QNBZ', 'it 058091 c2 7g5ffzdz', '', undefined])(
    'cinCode_RealCinOrEmpty_IsAccepted (%s)',
    (value) => {
      expect(cinSchema.safeParse(value).success).toBe(true);
    },
  );

  it.each(['IT-12345-1234567890', '015146-CNI-01894', 'IT058091C27G5FFZDZX'])(
    'cinCode_OldFormatOrNotACin_IsRejectedWithI18nKey (%s)',
    (value) => {
      const result = cinSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe('property.validation.cin.format');
    },
  );

  it('cinCode_FormatMessage_IsTranslatedInItalianAndEnglish', () => {
    expect(i18n.getFixedT('it')('property.validation.cin.format')).toContain('IT015146C2ABCDEFGH');
    expect(i18n.getFixedT('en')('property.validation.cin.format')).toContain('IT015146C2ABCDEFGH');
    expect(i18n.getFixedT('it')('property.validation.cin.format')).not.toContain('IT-XXXXX');
  });
});
