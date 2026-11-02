import { describe, expect, it } from 'vitest';
import { detailsSchema, isValidPhone, type DetailsFormValues } from '../details-schema';

const valid: DetailsFormValues = {
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario.rossi@example.com',
  phone: '+39 333 123 4567',
  country: 'DE',
  arrival: '',
  offers: false,
};

/** Messages (i18n keys) of the issues on `field`. */
function messagesFor(values: Partial<DetailsFormValues>, field: keyof DetailsFormValues): string[] {
  const result = detailsSchema.safeParse({ ...valid, ...values });
  if (result.success) return [];
  return result.error.issues.filter((issue) => issue.path[0] === field).map((issue) => issue.message);
}

describe('detailsSchema', () => {
  it('safeParse_ValidGuest_Succeeds', () => {
    expect(detailsSchema.safeParse(valid).success).toBe(true);
  });

  it('safeParse_TrailingSpaces_TrimsNamesAndEmail', () => {
    const result = detailsSchema.parse({ ...valid, firstName: ' Mario ', email: ' mario.rossi@example.com ' });

    expect(result.firstName).toBe('Mario');
    expect(result.email).toBe('mario.rossi@example.com');
  });

  it('safeParse_BothNamesAreRequired_EachWithItsOwnMessage', () => {
    expect(messagesFor({ firstName: '  ' }, 'firstName')).toContain('publicBooking.validation.firstNameRequired');
    expect(messagesFor({ lastName: '' }, 'lastName')).toContain('publicBooking.validation.lastNameRequired');
  });

  it('safeParse_InvalidEmail_ReportsEmailInvalid', () => {
    expect(messagesFor({ email: 'mario.rossi@' }, 'email')).toContain('publicBooking.validation.emailInvalid');
    expect(messagesFor({ email: 'mario rossi@example.com' }, 'email')).toContain('publicBooking.validation.emailInvalid');
  });

  it('safeParse_EmptyEmail_ReportsRequiredFirst', () => {
    expect(messagesFor({ email: '' }, 'email')[0]).toBe('publicBooking.validation.emailRequired');
  });

  it('safeParse_InvalidPhone_ReportsPhoneInvalid', () => {
    expect(messagesFor({ phone: 'call me' }, 'phone')).toEqual(['publicBooking.validation.phoneInvalid']);
    expect(messagesFor({ phone: '12345' }, 'phone')).toEqual(['publicBooking.validation.phoneInvalid']);
    expect(messagesFor({ phone: '+39 333 123 4567 8901' }, 'phone')).toContain('publicBooking.validation.phoneInvalid');
  });

  it('safeParse_EmptyPhone_IsAccepted', () => {
    expect(messagesFor({ phone: '' }, 'phone')).toEqual([]);
  });

  it('safeParse_CountryNotIso_ReportsCountryRequired', () => {
    expect(messagesFor({ country: '' }, 'country')).toEqual(['publicBooking.validation.countryRequired']);
    expect(messagesFor({ country: 'Italia' }, 'country')).toEqual(['publicBooking.validation.countryRequired']);
    expect(messagesFor({ country: 'IT' }, 'country')).toEqual([]);
  });
});

describe('isValidPhone', () => {
  it('isValidPhone_CommonFormats_AreAccepted', () => {
    expect(isValidPhone('+393331234567')).toBe(true);
    expect(isValidPhone('(06) 1234-5678')).toBe(true);
    expect(isValidPhone('+1 415.555.0100')).toBe(true);
  });

  it('isValidPhone_PlusNotAtStartOrTooManyDigits_IsRejected', () => {
    expect(isValidPhone('39+3331234567')).toBe(false);
    expect(isValidPhone('1234567890123456')).toBe(false);
  });
});
