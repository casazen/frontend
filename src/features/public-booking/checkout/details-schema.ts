import { z } from 'zod';
import { isIsoCountryCode } from '@/lib/countries';

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

/**
 * Step 2 of the checkout, «I tuoi dati» (DB-05): the guest who books. The two names stay two fields (the API wants two). The messages are
 * i18n keys that `FormFieldError` translates. The arrival note and the two offers boxes (NF-90, one per channel) are optional and never
 * checked beyond their shape, with one rule: the WhatsApp box needs a phone number, as the API does (422 without), so the box ticked
 * with no number typed is refused on the box itself.
 */
export const detailsSchema = z
  .object({
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
    arrival: z.string().max(32),
    offersEmail: z.boolean(),
    offersWhatsApp: z.boolean(),
  })
  .superRefine((values, context) => {
    if (values.offersWhatsApp && values.phone.trim() === '') {
      context.addIssue({ code: 'custom', path: ['offersWhatsApp'], message: 'publicBooking.validation.whatsAppNeedsPhone' });
    }
  });

export type DetailsFormValues = z.infer<typeof detailsSchema>;
