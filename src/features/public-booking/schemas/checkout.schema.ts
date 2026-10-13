import { z } from 'zod';
import { isIsoCountryCode } from '@/lib/countries';
import { isStayDate } from '@/lib/stay-dates';

/** Same limits as the API (`CreateDirectBookingRequest`). */
const NAME_MAX_LENGTH = 100;
const EMAIL_MAX_LENGTH = 255;
const PHONE_MAX_LENGTH = 20;
/** Digits of an international number: at most 15 (ITU-T E.164). */
const PHONE_MIN_DIGITS = 6;
const PHONE_MAX_DIGITS = 15;
const PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;

export function isValidPhone(value: string): boolean {
  if (!PHONE_CHARACTERS.test(value)) return false;
  const digits = value.replace(/\D/g, '').length;
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

export interface CheckoutSchemaOptions {
  /** Capacity of the property (adults + children). */
  maxGuests: number;
  /** Today in Europe/Rome (`YYYY-MM-DD`): check-in cannot be earlier. */
  today: string;
}

/** Guest and stay data of the direct checkout. Messages are i18n keys translated by FormFieldError. */
export function createCheckoutSchema({ maxGuests, today }: CheckoutSchemaOptions) {
  return z
    .object({
      checkIn: z
        .string()
        .refine(isStayDate, 'publicBooking.validation.checkInRequired')
        .refine((value) => value >= today, 'publicBooking.validation.checkInPast'),
      checkOut: z.string().refine(isStayDate, 'publicBooking.validation.checkOutRequired'),
      adults: z.number().int().min(1, 'publicBooking.validation.adultsMin'),
      children: z.number().int().min(0, 'publicBooking.validation.childrenMin'),
      firstName: z.string().trim().min(1, 'publicBooking.validation.firstNameRequired').max(NAME_MAX_LENGTH),
      lastName: z.string().trim().min(1, 'publicBooking.validation.lastNameRequired').max(NAME_MAX_LENGTH),
      email: z
        .string()
        .trim()
        .min(1, 'publicBooking.validation.emailRequired')
        .max(EMAIL_MAX_LENGTH)
        .regex(z.regexes.email, 'publicBooking.validation.emailInvalid'),
      phone: z
        .string()
        .trim()
        .max(PHONE_MAX_LENGTH, 'publicBooking.validation.phoneInvalid')
        .refine((value) => value === '' || isValidPhone(value), 'publicBooking.validation.phoneInvalid'),
      country: z.string().refine((value): boolean => isIsoCountryCode(value), 'publicBooking.validation.countryRequired'),
    })
    .superRefine((values, ctx) => {
      if (isStayDate(values.checkIn) && isStayDate(values.checkOut) && values.checkOut <= values.checkIn) {
        ctx.addIssue({ code: 'custom', path: ['checkOut'], message: 'publicBooking.validation.checkOutAfterCheckIn' });
      }
      if (values.adults + values.children > maxGuests) {
        ctx.addIssue({ code: 'custom', path: ['adults'], message: 'publicBooking.validation.tooManyGuests' });
      }
    });
}

export type CheckoutFormValues = z.infer<ReturnType<typeof createCheckoutSchema>>;
