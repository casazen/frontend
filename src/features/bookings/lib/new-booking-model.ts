import type { TFunction } from 'i18next';
import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { parseEuros } from '@/features/supplier/services/lib/service-money';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { completeChildrenAges, resizeChildrenAges } from '@/lib/tourist-tax';
import type { BookingChannel, CreateManualBookingDto, HostBookingQuotePayload, StayAvailabilityParams } from '@/types';

/** Name of the flow: the draft of the wizard lives under it. */
export const NEW_BOOKING_DRAFT_ID = 'sr-new-booking';

/** Shape of the draft: 2 since the guest is a name and an email (SR-06a); a draft of the first and last name is not read back. */
export const NEW_BOOKING_DRAFT_VERSION = 2;

/**
 * The wizard keeps a draft of what was typed, but never the contact of a third party (UI-11): it is typed again after a reload.
 * The block of a portal found for the dates is not kept either: it is asked again when the dates are chosen.
 */
export const NEW_BOOKING_DRAFT_EXCLUDE = ['guest.email', 'guest.phone', 'linkedBlock'] as const;

/** The three steps, by the name the address carries (`?step=stay`; `?step=2` works too). */
export const NEW_BOOKING_STEP = { stay: 'stay', guest: 'guest', summary: 'summary' } as const;

/** Guests of one booking: the API accepts 1 to 100 (adults and minors together). */
export const NEW_BOOKING_MAX_GUESTS = 100;

/** Longest note on the price the host agreed (the API refuses a longer one). */
export const PRICE_NOTE_MAX_LENGTH = 80;

/**
 * A portal's reservation that arrived as a block of its calendar and sits on exactly the dates asked (SR-06a): the host completes
 * it with the name of the guest instead of creating a second booking. It is a link only for the property and the dates it was
 * found for.
 */
export interface LinkedBlock {
  blockId: string;
  channel: BookingChannel | null;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
}

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
  /** The guest who booked: the name as the host says it ("Maria De Luca") and the email are all that is needed (SR-06a). */
  guest: { name: string; email: string; phone: string };
  specialRequests: string;
  /** The total the host agreed, as typed ("450,50"); empty = the price the API calculated. With a block: the amount the portal shows. */
  totalPrice: string;
  /** A short note on that price. */
  priceNote: string;
  linkedBlock: LinkedBlock | null;
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
    guest: { name: '', email: '', phone: '' },
    specialRequests: '',
    totalPrice: '',
    priceNote: '',
    linkedBlock: null,
  };
}

/**
 * The name as the host types it, in the two parts the API keeps: the first word is the first name and the rest the last name
 * ("Maria De Luca" is Maria, De Luca). The guest corrects it with the online check-in.
 */
export function splitGuestName(name: string): { firstName: string; lastName: string } {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

/** The block the host linked, as long as the property and the dates are still the ones it was found for; otherwise none. */
export function activeLink(values: Pick<NewBookingValues, 'propertyId' | 'checkInDate' | 'checkOutDate' | 'linkedBlock'>): LinkedBlock | null {
  const link = values.linkedBlock;
  return link && link.propertyId === values.propertyId && link.checkInDate === values.checkInDate && link.checkOutDate === values.checkOutDate
    ? link
    : null;
}

/** The name of a portal in a sentence ("bloccate da Airbnb"); a portal we have no name for is "un altro portale". */
export function portalName(channel: BookingChannel | null | undefined, t: TFunction): string {
  return channel === 'Airbnb' || channel === 'BookingCom'
    ? t(`booking.create.availability.portals.${channel}`)
    : t('booking.create.availability.portals.Other');
}

/**
 * What each step asks before the next one opens (messages are i18n keys, as in every form). They are the rules the API
 * applies when the booking is created, said where the host can still fix them: the check-in cannot be in the past
 * (`booking_create_invalid`), the departure is after the arrival and at least one adult.
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

/**
 * The guest: a name (the first word of it at least two letters, the API's rule for the first name), an email the check-in link goes
 * to, and nothing else that has to be there. The phone is optional; the country and the documents are the guest's to give.
 */
export const guestStepSchema: ZodType<unknown, FieldValues> = z.object({
  guest: z.object({
    name: z.string().refine((name) => splitGuestName(name).firstName.length >= 2, 'booking.validation.firstName.minLength'),
    email: z.string().trim().email('booking.validation.email.format'),
    phone: z.string().trim().max(20, 'booking.validation.phone.maxLength'),
  }),
  specialRequests: z.string().max(1000),
});

/** The agreed total is an amount (or nothing: the price of the quote), and its note is short. */
export const summaryStepSchema: ZodType<unknown, FieldValues> = z.object({
  totalPrice: z.string().refine((text) => parseEuros(text).problem !== 'invalid', 'booking.validation.totalPrice.invalid'),
  priceNote: z.string().max(PRICE_NOTE_MAX_LENGTH, 'booking.validation.priceNote.maxLength'),
});

/** The agreed total in euros, or `null` when the host typed none (or something that is not an amount). */
export function agreedTotal(values: Pick<NewBookingValues, 'totalPrice'>): number | null {
  const { cents } = parseEuros(values.totalPrice);
  return cents === null ? null : cents / 100;
}

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

/**
 * The stay the availability is asked about, or `null` while it cannot be one: no property, dates not in order or an arrival in the
 * past (the form says so by itself, and a date typed one digit at a time passes through many that are not worth a request).
 */
export function toAvailabilityParams(values: Pick<NewBookingValues, 'propertyId' | 'checkInDate' | 'checkOutDate'>): StayAvailabilityParams | null {
  const { propertyId, checkInDate, checkOutDate } = values;
  const stay =
    propertyId !== '' && isStayDate(checkInDate) && isStayDate(checkOutDate) && checkOutDate > checkInDate && checkInDate >= todayInRome();
  return stay ? { propertyId, from: checkInDate, to: checkOutDate } : null;
}

/**
 * The booking as `POST /bookings/manual` takes it: the name split in two, the email, the phone only if given, and the agreed
 * total with its note only if the host typed them (the API prices the stay and keeps the tourist tax of its quote). With a block of a
 * portal the total is the amount the portal shows and there is no note: the portal collects.
 */
export function toManualBookingDto(values: NewBookingValues): CreateManualBookingDto {
  const ages = agesOf(values);
  const { firstName, lastName } = splitGuestName(values.guest.name);
  const phone = values.guest.phone.trim();
  const note = values.specialRequests.trim();
  const priceNote = values.priceNote.trim();
  const total = agreedTotal(values);
  const link = activeLink(values);
  return {
    propertyId: values.propertyId,
    checkInDate: values.checkInDate,
    checkOutDate: values.checkOutDate,
    adults: values.adults,
    children: values.minors,
    ...(ages ? { childrenAges: ages } : {}),
    guest: {
      firstName,
      ...(lastName ? { lastName } : {}),
      email: values.guest.email.trim(),
      ...(phone ? { phone } : {}),
    },
    ...(note ? { note } : {}),
    ...(total !== null ? { totalPrice: total } : {}),
    ...(!link && priceNote && total !== null ? { priceNote } : {}),
    ...(link ? { blockId: link.blockId } : {}),
  };
}
