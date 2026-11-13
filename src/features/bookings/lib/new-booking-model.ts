import type { TFunction } from 'i18next';
import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { parseEuros } from '@/features/supplier/services/lib/service-money';
import { isStayDate, todayInRome } from '@/lib/stay-dates';
import { completeChildrenAges, resizeChildrenAges } from '@/lib/tourist-tax';
import {
  HOST_PAYMENT_ARRANGEMENTS,
  type BookingChannel,
  type CreateManualBookingDto,
  type HostBookingQuotePayload,
  type HostPaymentArrangement,
  type ManualBooking,
  type StayAvailability,
  type StayAvailabilityConflict,
  type StayAvailabilityParams,
} from '@/types';

/** Name of the flow: the draft of the wizard lives under it. */
export const NEW_BOOKING_DRAFT_ID = 'sr-new-booking';

/**
 * Shape of the draft: 3 since the payment step (NF-74: stay, guest, price, payment, summary); a draft of the three steps has no answer about how the guest
 * pays and is not read back (2 was the guest as a name and an email, SR-06a).
 */
export const NEW_BOOKING_DRAFT_VERSION = 3;

/**
 * The wizard keeps a draft of what was typed, but never the contact of a third party (UI-11): it is typed again after a reload.
 * The block of a portal found for the dates is not kept either: it is asked again when the dates are chosen.
 */
export const NEW_BOOKING_DRAFT_EXCLUDE = ['guest.email', 'guest.phone', 'linkedBlock'] as const;

/** The five steps, by the name the address carries (`?step=stay`; `?step=2` works too). */
export const NEW_BOOKING_STEP = { stay: 'stay', guest: 'guest', price: 'price', payment: 'payment', summary: 'summary' } as const;

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
  /**
   * How the guest pays (NF-74). Empty until the host chooses: there is no default, because the choice decides money (a link starts a payment on the
   * host's Stripe account, the others leave the income to record by hand). Not asked, and not sent, for a portal's reservation: the portal collects.
   */
  paymentArrangement: HostPaymentArrangement | '';
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
    paymentArrangement: '',
    linkedBlock: null,
  };
}

/** What the wizard hands to its result: the booking the API created and whether its property is mirrored on the channel manager (`null`: not known). */
export interface NewBookingResult {
  booking: ManualBooking;
  channelManager: boolean | null;
}

/**
 * The stay the availability was last asked about on the way out of the stay step, and what it said about the channel manager: `mirrored` is
 * `channelManagerChecked !== null`, because the API leaves it `null` for a property that is not mirrored there (nothing to ask, nothing to push) and says
 * `true` or `false` for one that is.
 */
export interface CheckedStay {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  mirrored: boolean;
}

/** The stay as the availability answered it: the property is mirrored when the channel manager was asked (or could not be). */
export function checkedStayOf(values: Pick<NewBookingValues, 'propertyId' | 'checkInDate' | 'checkOutDate'>, availability: StayAvailability): CheckedStay {
  return {
    propertyId: values.propertyId,
    checkInDate: values.checkInDate,
    checkOutDate: values.checkOutDate,
    mirrored: availability.channelManagerChecked !== null && availability.channelManagerChecked !== undefined,
  };
}

/**
 * Whether the property is mirrored on the channel manager, for the stay the values hold now: what the last check said when it was about this property and these
 * dates, `null` otherwise (a draft taken up at the summary, a stay changed since): then nothing is told about it, the result reads the booking instead.
 */
export function channelManagerOf(
  checked: CheckedStay | null,
  values: Pick<NewBookingValues, 'propertyId' | 'checkInDate' | 'checkOutDate' | 'linkedBlock'>,
): boolean | null {
  // A portal's reservation completed by the host is a booking of that portal: it is not pushed to the channel manager.
  if (activeLink(values)) return false;
  const same =
    checked !== null &&
    checked.propertyId === values.propertyId &&
    checked.checkInDate === values.checkInDate &&
    checked.checkOutDate === values.checkOutDate;
  return same ? checked.mirrored : null;
}

/** The conflict the channel manager answered with (its "not available"), if the dates are taken there. */
export function channelManagerConflict(availability: Pick<StayAvailability, 'conflicts'>): StayAvailabilityConflict | undefined {
  return availability.conflicts.find((conflict) => conflict.type === 'channelManager');
}

/** What the host reads when the channel manager says the dates cannot be booked: it names the channel only when the API does, and never a channel it did not name. */
export function channelManagerBlockedMessage(conflict: Pick<StayAvailabilityConflict, 'title'>, t: TFunction): string {
  const channel = conflict.title?.trim();
  return channel
    ? t('booking.create.availability.channelManagerBlockedNamed', { channel })
    : t('booking.create.availability.channelManagerBlocked');
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

/** The price step: the agreed total is an amount (or nothing: the price of the quote), and its note is short. */
export const priceStepSchema: ZodType<unknown, FieldValues> = z.object({
  totalPrice: z.string().refine((text) => parseEuros(text).problem !== 'invalid', 'booking.validation.totalPrice.invalid'),
  priceNote: z.string().max(PRICE_NOTE_MAX_LENGTH, 'booking.validation.priceNote.maxLength'),
});

/** The agreed total in euros, or `null` when the host typed none (or something that is not an amount). */
export function agreedTotal(values: Pick<NewBookingValues, 'totalPrice'>): number | null {
  const { cents } = parseEuros(values.totalPrice);
  return cents === null ? null : cents / 100;
}

/**
 * Why the payment link cannot be chosen now: the caller may not take payments on the property (`payment.write`, the API answers 403 otherwise), the
 * organization has no Stripe account ready to take them (422 `payment_link_unavailable`), or the host agreed a total of zero, so there is nothing to pay.
 */
export type PaymentLinkBlock = 'permission' | 'account' | 'nothingToPay';

/** The words of each reason, as the payment step says them and as its rule answers when the link is chosen all the same (keys of both languages). */
export const PAYMENT_LINK_BLOCK_KEYS: Readonly<Record<PaymentLinkBlock, string>> = {
  permission: 'booking.create.payment.reason.permission',
  account: 'booking.create.payment.reason.account',
  nothingToPay: 'booking.create.payment.reason.nothingToPay',
};

/**
 * What stops the payment link, `null` when nothing does. `accountReady` is `null` while the status of the Stripe account is not known (loading, or it could
 * not be read): the link is then offered and the API, which checks before it writes anything, has the last word. `agreed` is the total the host typed.
 */
export function paymentLinkBlockOf(input: { canWritePayments: boolean; accountReady: boolean | null; agreed: number | null }): PaymentLinkBlock | null {
  if (!input.canWritePayments) return 'permission';
  if (input.accountReady === false) return 'account';
  if (input.agreed !== null && input.agreed <= 0) return 'nothingToPay';
  return null;
}

/**
 * The payment step: one of the three ways must be chosen (there is no default: it decides money), and the link only while nothing stops it. A
 * link chosen before something stopped it (a total of zero typed afterwards, an account that was disconnected since a draft was saved) is refused here, with its
 * reason, and not at the end by the API.
 */
export function paymentStepSchemaFor(block: PaymentLinkBlock | null): ZodType<unknown, FieldValues> {
  return z
    .object({
      paymentArrangement: z
        .string()
        .refine((value) => (HOST_PAYMENT_ARRANGEMENTS as readonly string[]).includes(value), 'booking.validation.paymentArrangement.required'),
    })
    .superRefine((payment, context) => {
      if (block !== null && payment.paymentArrangement === 'paymentLink') {
        context.addIssue({ code: 'custom', path: ['paymentArrangement'], message: PAYMENT_LINK_BLOCK_KEYS[block] });
      }
    });
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
 * The booking as `POST /bookings/manual` takes it: the name split in two, the email, the phone only if given, the agreed
 * total with its note only if the host typed them (the API prices the stay and keeps the tourist tax of its quote) and how the guest pays. With a block of a
 * portal the total is the amount the portal shows, there is no note and no way of paying to send: the portal collects.
 */
export function toManualBookingDto(values: NewBookingValues): CreateManualBookingDto {
  const ages = agesOf(values);
  const { firstName, lastName } = splitGuestName(values.guest.name);
  const phone = values.guest.phone.trim();
  const note = values.specialRequests.trim();
  const priceNote = values.priceNote.trim();
  const total = agreedTotal(values);
  const link = activeLink(values);
  const arrangement = values.paymentArrangement;
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
    ...(link ? { blockId: link.blockId } : arrangement !== '' ? { paymentArrangement: arrangement } : {}),
  };
}
