import { describe, expect, it } from 'vitest';
import { createCheckoutSchema, isValidPhone, type CheckoutFormValues } from '../checkout.schema';

const TODAY = '2026-09-23';
const schema = createCheckoutSchema({ maxGuests: 4, today: TODAY });

const valid: CheckoutFormValues = {
  checkIn: '2026-10-01',
  checkOut: '2026-10-04',
  adults: 2,
  children: 1,
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario.rossi@example.com',
  phone: '+39 333 123 4567',
  country: 'DE',
};

/** Messages (i18n keys) of the issues on `field`. */
function messagesFor(values: Partial<CheckoutFormValues>, field: keyof CheckoutFormValues): string[] {
  const result = schema.safeParse({ ...valid, ...values });
  if (result.success) return [];
  return result.error.issues.filter((issue) => issue.path[0] === field).map((issue) => issue.message);
}

describe('createCheckoutSchema', () => {
  it('safeParse_ValidGuestAndStay_Succeeds', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it('safeParse_TrailingSpaces_TrimsNamesAndEmail', () => {
    const result = schema.parse({ ...valid, firstName: ' Mario ', email: ' mario.rossi@example.com ' });

    expect(result.firstName).toBe('Mario');
    expect(result.email).toBe('mario.rossi@example.com');
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

  it('safeParse_GuestsOverCapacity_ReportsTooManyGuests', () => {
    expect(messagesFor({ adults: 3, children: 2 }, 'adults')).toEqual(['publicBooking.validation.tooManyGuests']);
    expect(messagesFor({ adults: 4, children: 0 }, 'adults')).toEqual([]);
  });

  it('safeParse_NoAdults_ReportsAdultsMin', () => {
    expect(messagesFor({ adults: 0, children: 1 }, 'adults')).toContain('publicBooking.validation.adultsMin');
  });

  it('safeParse_CheckInInThePast_ReportsCheckInPast', () => {
    expect(messagesFor({ checkIn: '2026-09-22' }, 'checkIn')).toEqual(['publicBooking.validation.checkInPast']);
  });

  it('safeParse_CheckInToday_IsAccepted', () => {
    expect(messagesFor({ checkIn: TODAY, checkOut: '2026-09-24' }, 'checkIn')).toEqual([]);
  });

  it('safeParse_MissingDates_ReportsRequired', () => {
    expect(messagesFor({ checkIn: '' }, 'checkIn')[0]).toBe('publicBooking.validation.checkInRequired');
    expect(messagesFor({ checkOut: '' }, 'checkOut')[0]).toBe('publicBooking.validation.checkOutRequired');
  });

  it('safeParse_CheckOutNotAfterCheckIn_ReportsCheckOutAfterCheckIn', () => {
    expect(messagesFor({ checkOut: '2026-10-01' }, 'checkOut')).toEqual(['publicBooking.validation.checkOutAfterCheckIn']);
    expect(messagesFor({ checkOut: '2026-09-30' }, 'checkOut')).toEqual(['publicBooking.validation.checkOutAfterCheckIn']);
  });

  it('safeParse_CountryNotIso_ReportsCountryRequired', () => {
    expect(messagesFor({ country: '' }, 'country')).toEqual(['publicBooking.validation.countryRequired']);
    expect(messagesFor({ country: 'Italia' }, 'country')).toEqual(['publicBooking.validation.countryRequired']);
    expect(messagesFor({ country: 'IT' }, 'country')).toEqual([]);
  });

  it('safeParse_OtherFieldInvalid_StillChecksDatesAndCapacity', () => {
    const result = schema.safeParse({ ...valid, email: 'x', checkOut: '2026-09-30', adults: 5 });

    expect(result.success).toBe(false);
    const messages = result.error?.issues.map((issue) => issue.message) ?? [];
    expect(messages).toContain('publicBooking.validation.checkOutAfterCheckIn');
    expect(messages).toContain('publicBooking.validation.tooManyGuests');
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
