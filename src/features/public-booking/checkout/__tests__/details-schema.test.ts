import { describe, expect, it } from 'vitest';
import { detailsSchema, hasInternationalPrefix, isValidPhone, type DetailsFormValues } from '../details-schema';

const valid: DetailsFormValues = {
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario.rossi@example.com',
  phone: '+39 333 123 4567',
  country: 'DE',
  arrival: '',
  offersEmail: false,
  offersWhatsApp: false,
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

  it('safeParse_WhatsAppBoxWithoutAPhone_IsRefusedOnTheBoxWithItsOwnMessage', () => {
    for (const phone of ['', '   ']) {
      expect(messagesFor({ offersWhatsApp: true, phone }, 'offersWhatsApp')).toEqual(['publicBooking.validation.whatsAppNeedsPhone']);
    }
  });

  it('safeParse_WhatsAppBoxWithAPhone_OrUntickedOrEmailOnly_IsAccepted', () => {
    expect(detailsSchema.safeParse({ ...valid, offersWhatsApp: true, phone: '+39 333 123 4567' }).success).toBe(true);
    // The box left unticked needs no number, and the e-mail box needs none either.
    expect(detailsSchema.safeParse({ ...valid, phone: '' }).success).toBe(true);
    expect(detailsSchema.safeParse({ ...valid, offersEmail: true, phone: '' }).success).toBe(true);
  });

  it('safeParse_WhatsAppBoxWithANumberThatDoesNotSayItsCountry_IsRefusedOnTheBoxWithItsOwnMessage', () => {
    // The server puts its own calling code in front of such a number: the consent would be recorded for somebody else's phone.
    for (const phone of ['333 123 4567', '3331234567', '06 1234 5678']) {
      expect(messagesFor({ offersWhatsApp: true, phone }, 'offersWhatsApp'), phone).toEqual(['publicBooking.validation.whatsAppNeedsPrefix']);
    }
  });

  it('safeParse_WhatsAppBoxWithANumberThatSaysItsCountry_IsAccepted', () => {
    for (const phone of ['+39 333 123 4567', '+44 20 7946 0000', '0039 333 123 4567', '00 44 20 7946 0000']) {
      expect(messagesFor({ offersWhatsApp: true, phone }, 'offersWhatsApp'), phone).toEqual([]);
    }
  });

  it('safeParse_NumberWithoutPrefixAndNoWhatsAppBox_IsAccepted', () => {
    // The number of a guest who only wants to be reached on arrival (or by e-mail offers) is not sent for a consent: no prefix is asked.
    expect(detailsSchema.safeParse({ ...valid, phone: '333 123 4567' }).success).toBe(true);
    expect(detailsSchema.safeParse({ ...valid, phone: '333 123 4567', offersEmail: true }).success).toBe(true);
  });

  it('safeParse_WhatsAppBoxWithANumberThatIsNotANumber_TellsItOnThePhoneFieldOnly', () => {
    expect(messagesFor({ offersWhatsApp: true, phone: 'call me' }, 'phone')).toEqual(['publicBooking.validation.phoneInvalid']);
    expect(messagesFor({ offersWhatsApp: true, phone: 'call me' }, 'offersWhatsApp')).toEqual([]);
  });
});

describe('hasInternationalPrefix', () => {
  it('hasInternationalPrefix_PlusOrDoubleZero_IsTrue', () => {
    expect(hasInternationalPrefix('+393331234567')).toBe(true);
    expect(hasInternationalPrefix('0039 333 1234567')).toBe(true);
    expect(hasInternationalPrefix('00 39 333 1234567')).toBe(true);
    expect(hasInternationalPrefix('(+39) 333 1234567')).toBe(true);
  });

  it('hasInternationalPrefix_NationalNumber_IsFalse', () => {
    expect(hasInternationalPrefix('3331234567')).toBe(false);
    expect(hasInternationalPrefix('06 1234 5678')).toBe(false);
    expect(hasInternationalPrefix('39+3331234567')).toBe(false);
    expect(hasInternationalPrefix('')).toBe(false);
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
