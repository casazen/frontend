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
 * True when a number says its country: it starts with `+` or `00`, which is what the server (`CrmNormalizer.NormalizePhone`) takes for an
 * international number. It puts its own default calling code in front of any other, so a WhatsApp consent on «333 1234567» typed by a guest
 * from abroad would be recorded for somebody else's number.
 */
export function hasInternationalPrefix(value: string): boolean {
  return /^[\s(]*\+/.test(value) || value.replace(/\D/g, '').startsWith('00');
}

/**
 * Step 2 of the checkout, «I tuoi dati» (DB-05): the guest who books. The two names stay two fields (the API wants two). The messages are
 * i18n keys that `FormFieldError` translates. The arrival note and the two offers boxes (NF-90, one per channel) are optional and never
 * checked beyond their shape, with two rules for the WhatsApp box: it needs a phone number, as the API does (422 without), and the number
 * must say its country (`+` or `00`: the server would put its own calling code in front of any other, and the consent would be for a stranger).
 * Both are refused on the box itself.
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
    if (!values.offersWhatsApp) return;
    const phone = values.phone.trim();
    if (phone === '') {
      context.addIssue({ code: 'custom', path: ['offersWhatsApp'], message: 'publicBooking.validation.whatsAppNeedsPhone' });
    } else if (isValidPhone(phone) && !hasInternationalPrefix(phone)) {
      // A number that is not a number at all is told on the phone field; here only the one that is valid but does not say its country.
      context.addIssue({ code: 'custom', path: ['offersWhatsApp'], message: 'publicBooking.validation.whatsAppNeedsPrefix' });
    }
  });

export type DetailsFormValues = z.infer<typeof detailsSchema>;
