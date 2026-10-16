import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { completeChildrenAges, resizeChildrenAges } from '@/lib/tourist-tax';
import type { CreateBookingDto, HostBookingQuotePayload } from '@/types';

/** Name of the flow: the draft of the wizard lives under it. */
export const NEW_BOOKING_DRAFT_ID = 'sr-new-booking';

/** The wizard keeps a draft of what was typed, but never the contact of a third party (UI-11): it is typed again after a reload. */
export const NEW_BOOKING_DRAFT_EXCLUDE = ['guest.email', 'guest.phone'] as const;

/** The three steps, by the name the address carries (`?step=stay`; `?step=2` works too). */
export const NEW_BOOKING_STEP = { stay: 'stay', guest: 'guest', summary: 'summary' } as const;

/** Guests of one booking: the API accepts 1 to 100 (adults and minors together). */
export const NEW_BOOKING_MAX_GUESTS = 100;

/** What the host answers in the new-booking wizard: the values of its form. */
export interface NewBookingValues {
  propertyId: string;
  /** Stay dates (`YYYY-MM-DD`): the departure day is not a night. */
  checkInDate: string;
  checkOutDate: string;
  /** Guests of 18 or more (at least one). */
  adults: number;
  /** Minors among the guests. */
  minors: number;
  /** Age at check-in of each minor, `null` until chosen: asked only when the tourist tax of the comune depends on it (BK-03). */
  childrenAges: (number | null)[];
  /** Contact of the guest who booked: the API asks for every field. */
  guest: { firstName: string; lastName: string; email: string; phone: string; country: string };
  specialRequests: string;
}

/** The answers before anything is typed. A property given in the address (the "new booking" of a property page) is chosen. */
export function emptyNewBooking(propertyId = ''): NewBookingValues {
  return {
    propertyId,
    checkInDate: '',
    checkOutDate: '',
    adults: 2,
    minors: 0,
    childrenAges: [],
    guest: { firstName: '', lastName: '', email: '', phone: '', country: '' },
    specialRequests: '',
  };
}

/**
 * What each step asks before the next one opens (messages are i18n keys, as in every form). They are the rules the API
 * applies when the booking is created, said where the host can still fix them: the check-in cannot be in the past
 * (`booking_create_invalid`), the departure is after the arrival, at least one adult, and every field of the guest.
 */
export const stayStepSchema: ZodType<unknown, FieldValues> = z
  .object({
    propertyId: z.string().min(1, 'booking.validation.propertyId.required'),
    checkInDate: z.string().refine(isStayDate, 'booking.validation.checkInDate.required'),
    checkOutDate: z.string().refine(isStayDate, 'booking.validation.checkOutDate.required'),
    adults: z
      .number({ error: 'booking.validation.numberOfGuests.min' })
      .int('booking.validation.numberOfGuests.min')
      .min(1, 'booking.validation.numberOfGuests.min'),
    minors: z
      .number({ error: 'booking.validation.numberOfChildren.invalid' })
      .int('booking.validation.numberOfChildren.invalid')
      .min(0, 'booking.validation.numberOfChildren.invalid'),
    childrenAges: z.array(z.number().nullable()),
  })
  .superRefine((stay, context) => {
    if (isStayDate(stay.checkInDate) && stay.checkInDate < todayInRome()) {
      context.addIssue({ code: 'custom', path: ['checkInDate'], message: 'booking.validation.checkInDate.inPast' });
    }
    if (isStayDate(stay.checkInDate) && isStayDate(stay.checkOutDate) && stay.checkOutDate <= stay.checkInDate) {
      context.addIssue({ code: 'custom', path: ['checkOutDate'], message: 'booking.validation.checkOutDate.afterCheckIn' });
    }
  });

export const guestStepSchema: ZodType<unknown, FieldValues> = z.object({
  guest: z.object({
    firstName: z.string().trim().min(2, 'booking.validation.firstName.minLength'),
    lastName: z.string().trim().min(2, 'booking.validation.lastName.minLength'),
    email: z.string().trim().email('booking.validation.email.format'),
    phone: z.string().trim().min(10, 'booking.validation.phone.minLength').max(20, 'booking.validation.phone.maxLength'),
    country: z.string().trim().min(2, 'booking.validation.country.required'),
  }),
  specialRequests: z.string().max(1000),
});

/** The ages of the minors, one slot per minor (an age is kept when the number of minors changes). */
function agesOf(values: Pick<NewBookingValues, 'minors' | 'childrenAges'>): number[] | undefined {
  return values.minors > 0 ? completeChildrenAges(resizeChildrenAges(values.childrenAges, values.minors)) : undefined;
}

/**
 * The stay as the price quote of the API takes it, or `null` while something is missing (property, dates in order,
 * guests): the quote is not asked then. The ages go with it once every minor has one.
 */
export function toQuotePayload(values: NewBookingValues): HostBookingQuotePayload | null {
  const { propertyId, checkInDate, checkOutDate, adults, minors } = values;
  const complete =
    propertyId !== '' &&
    isStayDate(checkInDate) &&
    isStayDate(checkOutDate) &&
    checkOutDate > checkInDate &&
    Number.isInteger(adults) &&
    adults >= 1 &&
    Number.isInteger(minors) &&
    minors >= 0 &&
    adults + minors <= NEW_BOOKING_MAX_GUESTS;
  if (!complete) return null;
  const ages = agesOf(values);
  return {
    propertyId,
    checkInDate,
    checkOutDate,
    numberOfGuests: adults + minors,
    numberOfChildren: minors,
    ...(ages ? { childrenAges: ages } : {}),
  };
}

/** The booking as `POST /bookings` takes it: created Confirmed with the source Manual, priced by the API. */
export function toCreateBookingDto(values: NewBookingValues): CreateBookingDto {
  const ages = agesOf(values);
  const { firstName, lastName, email, phone, country } = values.guest;
  return {
    propertyId: values.propertyId,
    checkInDate: values.checkInDate,
    checkOutDate: values.checkOutDate,
    numberOfGuests: values.adults + values.minors,
    numberOfChildren: values.minors,
    ...(ages ? { childrenAges: ages } : {}),
    guest: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), phone: phone.trim(), country: country.trim() },
    specialRequests: values.specialRequests.trim(),
  };
}
