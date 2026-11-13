import { addDays } from '@/lib/stay-dates';
import {
  dayState,
  minNightsAt,
  rangeProblem,
  type CalendarIndex,
  type RangeProblem,
  type StayRange,
} from '@/features/public-site/stay/stay-calendar-model';

/**
 * The ways out of a stay that cannot be had (DB-04b), worked out from the calendar of the property and nothing else. Pure: no React,
 * no network. They only propose dates; what the stay costs is the quote of the server, never worked out here.
 */

/** The longest search for free dates: the calendar covers 13 months, nothing is offered beyond what it knows. */
const MAX_SEARCH_DAYS = 400;

/**
 * What is wrong with the stay the guest asked for, as the card says it. `arrivalClosed`, `departureClosed`, `maxNights` and `advance`
 * are the rules of the nights the host set (E08/F05/US01, NF-36).
 */
export type StayProblemKind =
  | 'past'
  | 'datesUnavailable'
  | 'arrivalClosed'
  | 'departureClosed'
  | 'minNights'
  | 'maxNights'
  | 'advance'
  | 'tooManyGuests'
  | 'petsNotAllowed'
  | 'invalidStay'
  | 'notBookable'
  | 'failed';

/** Why the calendar refuses a range, in the words of the card. `null` when the range can be had as far as the calendar knows. */
export function problemOfRange(problem: RangeProblem | null): StayProblemKind | null {
  if (!problem) return null;
  switch (problem.kind) {
    case 'past':
      return 'past';
    case 'busyArrival':
    case 'busyBetween':
      return 'datesUnavailable';
    case 'arrivalClosed':
      return 'arrivalClosed';
    case 'departureClosed':
      return 'departureClosed';
    case 'minNights':
      return 'minNights';
    case 'maxNights':
      return 'maxNights';
    case 'advance':
      return 'advance';
    case 'unknown':
      // A night the calendar does not know is not a reason to refuse: the server answers for it.
      return null;
  }
}

/**
 * The first stay of `nights` nights (or the minimum of its arrival, if longer) that is free and that no rule of the host refuses (closed
 * arrival or departure, maximum stay, advance), from `from` on; null when there is none.
 */
export function firstFreeStay(index: CalendarIndex, nights: number, from: string): StayRange | null {
  const wanted = Math.max(1, Math.round(nights));
  const start = from && from > index.today ? from : index.today;
  for (let arrival = start, scanned = 0; arrival < index.end && scanned < MAX_SEARCH_DAYS; arrival = addDays(arrival, 1), scanned += 1) {
    if (dayState(index, arrival) !== 'free') continue;
    const stayNights = Math.max(wanted, minNightsAt(index, arrival));
    const checkOut = addDays(arrival, stayNights);
    if (rangeProblem(index, arrival, checkOut) === null) return { checkIn: arrival, checkOut };
  }
  return null;
}

/** The same arrival with as many nights as its minimum asks, when those nights are free; null when they are not. */
export function extendToMinimum(index: CalendarIndex, checkIn: string): StayRange | null {
  const minimum = minNightsAt(index, checkIn);
  const checkOut = addDays(checkIn, minimum);
  return rangeProblem(index, checkIn, checkOut) === null ? { checkIn, checkOut } : null;
}

/** The guests that fit a home: the adults first, then the children that are left. */
export function fitGuests(adults: number, children: number, maxGuests: number): { adults: number; children: number } {
  const capacity = Math.max(1, Math.floor(maxGuests));
  const fitAdults = Math.min(Math.max(1, adults), capacity);
  return { adults: fitAdults, children: Math.min(Math.max(0, children), capacity - fitAdults) };
}

/**
 * The limit a refusal of the quote or of the checkout carries (the `limit` of its problem body: the nights or the days of the rule the
 * stay broke, E08/F05/US01/T03), when it is a whole number above zero; `undefined` otherwise.
 */
export function limitOfProblem(data: unknown): number | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const limit = (data as { limit?: unknown }).limit;
  return typeof limit === 'number' && Number.isInteger(limit) && limit > 0 ? limit : undefined;
}

/** What the booking endpoints say when they refuse a stay (`docs/runbooks/direct-booking.md` §7), as the card says it. */
export function problemOfCode(code: string | undefined): StayProblemKind {
  switch (code) {
    case 'booking_dates_unavailable':
      return 'datesUnavailable';
    case 'direct_booking_arrival_closed':
      return 'arrivalClosed';
    case 'direct_booking_departure_closed':
      return 'departureClosed';
    case 'direct_booking_min_nights_not_met':
      return 'minNights';
    case 'direct_booking_max_nights_exceeded':
      return 'maxNights';
    case 'direct_booking_advance_too_short':
    case 'direct_booking_advance_too_long':
      return 'advance';
    case 'booking_too_many_guests':
      return 'tooManyGuests';
    case 'direct_booking_invalid_stay':
      return 'invalidStay';
    case 'direct_booking_payments_not_ready':
    case 'property_not_bookable_in_long_mode':
      return 'notBookable';
    default:
      return 'failed';
  }
}
