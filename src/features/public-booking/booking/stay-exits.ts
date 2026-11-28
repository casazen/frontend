import { addDays } from '@/lib/stay-dates';
import {
  dayState,
  minNightsAt,
  rangeProblem,
  type CalendarIndex,
  type RangeProblem,
  type StayRange,
} from '@/features/public-site/stay/stay-calendar-model';

const MAX_SEARCH_DAYS = 400;

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
      return null;
  }
}

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

/**
 * The same arrival with as many nights as its minimum asks, when those nights are free; null when they are not. `atLeast` is the minimum
 * that a refusal of the server gave (its `limit`): the calendar can be older than the rule, so the stay has the larger of the two and is
 * never shorter than what the server asked for.
 */
export function extendToMinimum(index: CalendarIndex, checkIn: string, atLeast = 1): StayRange | null {
  const minimum = Math.max(minNightsAt(index, checkIn), Math.max(1, Math.round(atLeast)));
  const checkOut = addDays(checkIn, minimum);
  return rangeProblem(index, checkIn, checkOut) === null ? { checkIn, checkOut } : null;
}

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
