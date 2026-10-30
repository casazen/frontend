import type { OutcomeView } from '@/features/public-booking/checkout-outcome';
import { pickText, shortTime } from '@/features/public-booking/lib/property-profile';
import type { CheckoutOutcome, PublicPropertyDetailDto } from '@/types';

/**
 * What the confirmation page works out from the state of the booking (DB-06b), as pure functions: which of the seven shapes the page
 * takes, what the status chip and the note of the ticket say, which steps «Cosa succede ora» lists and which of them is the one that
 * is happening, and what the guest may take to their calendar. Only a booking the backend confirmed is called confirmed (D24).
 */

/**
 * The shape of the page. `ok`: confirmed and paid (or to be paid in the property); `later`: confirmed, the saved card is charged on
 * a day of the booking; `email` and `wait`: a request to pay in the property, waiting for the guest's email and for the host;
 * `processing`: the payment is being confirmed; `pay`: the payment failed or is still to be done; `problem`: nothing to wait for.
 */
export type ConfirmationVariant = 'ok' | 'later' | 'email' | 'wait' | 'processing' | 'pay' | 'problem';

type StateOfPayment = Pick<CheckoutOutcome, 'paymentOption' | 'deferredChargeDate'>;

export function confirmationVariant(view: OutcomeView, outcome: StateOfPayment): ConfirmationVariant {
  switch (view) {
    case 'confirmed':
      return outcome.paymentOption === 'OnCancellationDeadline' && outcome.deferredChargeDate ? 'later' : 'ok';
    case 'awaitingEmail':
      return 'email';
    case 'awaitingHost':
      return 'wait';
    case 'processing':
      return 'processing';
    case 'failed':
    case 'awaitingPayment':
      return 'pay';
    default:
      return 'problem';
  }
}

/** The word on the chip of the ticket, always with an icon and never by color alone. */
export type ChipKind =
  | 'confirmed'
  | 'emailPending'
  | 'waiting'
  | 'processing'
  | 'unpaid'
  | 'expired'
  | 'declined'
  | 'unavailable'
  | 'cancelled';

export type ChipTone = 'ok' | 'warn' | 'err' | 'neutral';

const CHIPS: Record<OutcomeView, { kind: ChipKind; tone: ChipTone }> = {
  confirmed: { kind: 'confirmed', tone: 'ok' },
  awaitingEmail: { kind: 'emailPending', tone: 'warn' },
  awaitingHost: { kind: 'waiting', tone: 'warn' },
  processing: { kind: 'processing', tone: 'warn' },
  failed: { kind: 'unpaid', tone: 'warn' },
  awaitingPayment: { kind: 'unpaid', tone: 'warn' },
  expired: { kind: 'expired', tone: 'neutral' },
  declined: { kind: 'declined', tone: 'err' },
  datesUnavailable: { kind: 'unavailable', tone: 'err' },
  cancelled: { kind: 'cancelled', tone: 'neutral' },
};

export function chipOf(view: OutcomeView): { kind: ChipKind; tone: ChipTone } {
  return CHIPS[view];
}

/** What the ticket says about the money, in one line; null when there is nothing true to say. */
export type TicketNote = 'paid' | 'onSite' | 'later' | 'request' | 'processing' | 'unpaid';

export function ticketNote(variant: ConfirmationVariant, outcome: StateOfPayment): TicketNote | null {
  switch (variant) {
    case 'ok':
      if (outcome.paymentOption === 'Immediate') return 'paid';
      return outcome.paymentOption === 'OnSite' ? 'onSite' : null;
    case 'later':
      return 'later';
    case 'email':
    case 'wait':
      return 'request';
    case 'processing':
      return 'processing';
    case 'pay':
      return 'unpaid';
    case 'problem':
      return null;
  }
}

export type NextStepId = 'confirmed' | 'charge' | 'email' | 'host' | 'ifAccepted' | 'arrival' | 'departure';
export type StepState = 'done' | 'current' | 'todo';

export interface NextStep {
  id: NextStepId;
  state: StepState;
  /** `YYYY-MM-DD` of the step when it has a day of its own (the charge, the arrival, the departure); null otherwise. */
  date: string | null;
}

interface StepsInput {
  variant: ConfirmationVariant;
  outcome: Pick<CheckoutOutcome, 'checkInDate' | 'checkOutDate' | 'deferredChargeDate'>;
  /** Today in Europe/Rome (`YYYY-MM-DD`). */
  today: string;
}

/**
 * The steps «Cosa succede ora» of a booking, each with its day when it has one. The first step that is not done is the one that
 * is happening; the ones after it are still to come. The shapes without steps (a payment to wait for or to redo, a booking that is
 * over) give none: there is nothing the guest is told to expect. Nothing is promised that the system does not do (D24): no
 * «risponde entro 24 ore», no reminders that are not sent.
 */
export function buildNextSteps({ variant, outcome, today }: StepsInput): NextStep[] {
  const arrival = { id: 'arrival' as const, date: outcome.checkInDate, done: outcome.checkInDate < today };
  const departure = { id: 'departure' as const, date: outcome.checkOutDate, done: outcome.checkOutDate < today };

  let draft: { id: NextStepId; date: string | null; done: boolean }[];
  switch (variant) {
    case 'ok':
      draft = [{ id: 'confirmed', date: null, done: true }, arrival, departure];
      break;
    case 'later': {
      const charge = outcome.deferredChargeDate;
      draft = [
        { id: 'confirmed', date: null, done: true },
        ...(charge ? [{ id: 'charge' as const, date: charge, done: charge < today }] : []),
        arrival,
        departure,
      ];
      break;
    }
    case 'email':
      draft = [
        { id: 'email', date: null, done: false },
        { id: 'host', date: null, done: false },
        { id: 'ifAccepted', date: null, done: false },
        arrival,
      ];
      break;
    case 'wait':
      draft = [
        { id: 'email', date: null, done: true },
        { id: 'host', date: null, done: false },
        { id: 'ifAccepted', date: null, done: false },
        arrival,
      ];
      break;
    default:
      return [];
  }

  let happening = false;
  return draft.map(({ id, date, done }): NextStep => {
    if (done) return { id, date, state: 'done' };
    if (happening) return { id, date, state: 'todo' };
    happening = true;
    return { id, date, state: 'current' };
  });
}

const STAY_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function utcDay(date: string): Date | null {
  const match = STAY_DAY.exec(date);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
}

/**
 * The days of a stay as a person says them in a sentence: «24–27 ottobre» (the format of the language, so a stay across two months
 * or two years is written in full). An empty string when a day is missing. Days are read as written, never moved by a time zone.
 */
export function formatStayRangeLong(checkIn: string, checkOut: string, locale: string): string {
  const start = utcDay(checkIn);
  const end = utcDay(checkOut);
  if (!start || !end) return '';
  const crossesYear = start.getUTCFullYear() !== end.getUTCFullYear();
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', ...(crossesYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });
  return typeof format.formatRange === 'function' ? format.formatRange(start, end) : `${format.format(start)} – ${format.format(end)}`;
}

/** The hours the host published for the arrival and the departure (`HH:mm`), each empty when the host did not say. */
export function stayTimes(property: Pick<PublicPropertyDetailDto, 'checkInFrom' | 'checkOutBy'> | undefined): {
  arrivalFrom: string;
  departureBy: string;
} {
  return { arrivalFrom: shortTime(property?.checkInFrom), departureBy: shortTime(property?.checkOutBy) };
}

/**
 * Where the event of the calendar says the house is: the zone the host wrote, else the city. The public record of a house has no
 * street and no number, and this is the only place a calendar ever gets (the guest has the address from the host's own instructions).
 */
export function calendarPlace(
  property: Pick<PublicPropertyDetailDto, 'zone' | 'city'> | undefined,
  language: string | undefined,
): string {
  if (!property) return '';
  return pickText(property.zone, language) || (property.city ?? '').trim();
}
