import { describe, it, expect } from 'vitest';
import i18n from '@/i18n/config';
import type { Property } from '@/types';
import { changedPropertyFields, propertyFormPayload } from '@/features/compliance/activation-wizard-model';
import { propertyFormDefaults, propertyFormSchema, toPropertyPayload, type PropertyFormValues } from '../property.schema';

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

const SWISS_PROPERTY: Property = {
  id: 'prop-ch',
  name: 'Casa sul lago',
  description: 'Casa luminosa con vista sul lago',
  address: 'Via Nassa 5',
  city: 'Lugano',
  postalCode: '6900',
  country: 'CH',
  currency: 'CHF',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 150,
  cleaningFee: 60,
  damageDeposit: 300,
  amenities: [],
  photoUrls: [],
  houseRules: '',
  cinCode: null,
  timezone: 'Europe/Zurich',
  cancellationPolicyId: null,
  isActive: false,
  isPaused: false,
  pausedAt: null,
  ownerId: 'auth0|owner',
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-01T10:00:00Z',
};

const valuesOf = (property: Property, overrides: Partial<PropertyFormValues> = {}, variant: 'short-rent' | 'long-rent' = 'short-rent') =>
  ({ ...propertyFormDefaults(property, variant), ...overrides }) as PropertyFormValues;

describe('propertyFormSchema swissMunicipalityCode', () => {
  const schema = propertyFormSchema.shape.swissMunicipalityCode;

  it.each(['5192', '5', '0', '', undefined])('swissMunicipalityCode_ABfsNumberOrNothing_IsAccepted (%s)', (value) => {
    expect(schema.safeParse(value).success).toBe(true);
  });

  it.each(['51920', 'abc', '5 192', '-5192', '5192.0', 'TI'])('swissMunicipalityCode_NotABfsNumber_IsRejectedWithI18nKey (%s)', (value) => {
    const result = schema.safeParse(value);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('property.validation.swissMunicipalityCode.format');
  });

  it('swissMunicipalityCode_FormatMessage_IsTranslatedInItalianAndEnglish', () => {
    expect(i18n.getFixedT('it')('property.validation.swissMunicipalityCode.format')).toContain('comune svizzero');
    expect(i18n.getFixedT('en')('property.validation.swissMunicipalityCode.format')).toContain('Swiss municipality');
  });

  it('swissMunicipalityCode_ASwissPropertyWithNothingConfirmed_PassesTheWholeForm', () => {
    const result = propertyFormSchema.safeParse(valuesOf(SWISS_PROPERTY));
    expect(result.success).toBe(true);
  });
});

describe('propertyFormDefaults swissMunicipalityCode', () => {
  it('propertyFormDefaults_StoredMunicipality_StartsFromIt', () => {
    expect(propertyFormDefaults({ ...SWISS_PROPERTY, swissMunicipalityCode: '5192' }, 'short-rent').swissMunicipalityCode).toBe('5192');
  });

  it.each([null, undefined])('propertyFormDefaults_NoStoredMunicipality_StartsEmpty (%s)', (stored) => {
    expect(propertyFormDefaults({ ...SWISS_PROPERTY, swissMunicipalityCode: stored }, 'short-rent').swissMunicipalityCode).toBe('');
  });

  it('propertyFormDefaults_NewProperty_StartsEmpty', () => {
    expect(propertyFormDefaults(undefined, 'short-rent').swissMunicipalityCode).toBe('');
  });
});

describe('toPropertyPayload swissMunicipalityCode', () => {
  it('toPropertyPayload_SwissPropertyWithAConfirmedMunicipality_SendsIt', () => {
    expect(toPropertyPayload(valuesOf(SWISS_PROPERTY, { swissMunicipalityCode: '5192' }), 'short-rent')).toMatchObject({
      country: 'CH',
      swissMunicipalityCode: '5192',
    });
  });

  it.each(['', undefined])('toPropertyPayload_SwissPropertyWithNothingConfirmed_SendsNullWhichClearsIt (%s)', (value) => {
    expect(toPropertyPayload(valuesOf(SWISS_PROPERTY, { swissMunicipalityCode: value }), 'short-rent').swissMunicipalityCode).toBeNull();
  });

  it('toPropertyPayload_PropertyOfItaly_NeverSendsAMunicipalityOfSwitzerland', () => {
    // Even if the form still holds one: the Swiss place says nothing of an Italian house, and the server clears it itself on a country change.
    const payload = toPropertyPayload(valuesOf(SWISS_PROPERTY, { country: 'IT', currency: 'EUR', swissMunicipalityCode: '5192' }), 'short-rent');
    expect(payload).not.toHaveProperty('swissMunicipalityCode');
  });

  it('toPropertyPayload_LongTermForm_SendsItToo', () => {
    const payload = toPropertyPayload(valuesOf(SWISS_PROPERTY, { swissMunicipalityCode: '5192' }, 'long-rent'), 'long-rent');
    expect(payload.swissMunicipalityCode).toBe('5192');
    expect(payload).not.toHaveProperty('cleaningFee');
  });
});

describe('activation wizard: what changed with the Swiss municipality', () => {
  it('changedPropertyFields_ConfirmingTheMunicipality_IsTheOnlyChangeSent', () => {
    const stored = propertyFormPayload(SWISS_PROPERTY);
    const submitted = toPropertyPayload(valuesOf(SWISS_PROPERTY, { swissMunicipalityCode: '5192' }), 'short-rent');

    expect(changedPropertyFields(stored, submitted)).toEqual({ swissMunicipalityCode: '5192' });
  });

  it('changedPropertyFields_NothingConfirmedAndNothingChanged_SendsNothing', () => {
    const stored = propertyFormPayload(SWISS_PROPERTY);
    const submitted = toPropertyPayload(valuesOf(SWISS_PROPERTY), 'short-rent');

    expect(changedPropertyFields(stored, submitted)).toEqual({});
  });

  it('changedPropertyFields_ClearingTheStoredMunicipality_SendsNullWithTheNewCity', () => {
    const confirmed = { ...SWISS_PROPERTY, swissMunicipalityCode: '5192' };
    const stored = propertyFormPayload(confirmed);
    const submitted = toPropertyPayload(valuesOf(confirmed, { swissMunicipalityCode: '', city: 'Ascona', postalCode: '6612' }), 'short-rent');

    expect(changedPropertyFields(stored, submitted)).toEqual({ swissMunicipalityCode: null, city: 'Ascona', postalCode: '6612' });
  });
});
