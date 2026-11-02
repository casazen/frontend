import { addDays, endOfMonth, isStayDate, nightsBetween, startOfMonth, startOfWeek } from '@/lib/stay-dates';

/**
 * The rules of the range calendar of the public site (DB-20), without a screen: what a night is, which ranges can be chosen
 * and why one cannot. Dates are stay dates (`YYYY-MM-DD`) and all the date arithmetic is `stay-dates.ts`, in UTC calendar days,
 * so a change of summer time or the end of a month moves nothing. "Today" is a value that the caller gives (Europe/Rome).
 */

/** One night of the calendar of a property: the night that starts on `date`. */
export interface CalendarDay {
  date: string;
  /** A stay can start this night: no booking, hold, request or block takes it. */
  available: boolean;
  /** What the night costs, in cents; null when it is not known. */
  priceCents: number | null;
  /** The fewest nights of a stay that starts on this day (1 = no minimum). */
  minNights: number;
}

/** The stay chosen: `checkOut` is empty while only the arrival is chosen, both are empty before. */
export interface StayRange {
  checkIn: string;
  checkOut: string;
}

/** What the calendar knows about the nights. */
export interface CalendarIndex {
  days: ReadonlyMap<string, CalendarDay>;
  /** Today in Europe/Rome: earlier days are over. */
  today: string;
  /** End of the range that was loaded (excluded): nights from here on are not known, and never shown free. */
  end: string;
  /**
   * The nights could not be read: every day from today to `end` can be chosen and nothing is checked here (the checkout checks
   * the same nights again before the payment), as it has always been when the availability does not load.
   */
  unverified?: boolean;
}

/** What can be said of a day: over, not known, taken, or free for a stay to start. */
export type DayState = 'past' | 'unknown' | 'busy' | 'free';

/** Why a day or a range cannot be chosen (the screen turns it into a sentence). */
export type RangeProblem =
  | { kind: 'past' }
  | { kind: 'unknown' }
  | { kind: 'busyArrival'; date: string }
  | { kind: 'busyBetween'; date: string }
  | { kind: 'minNights'; minNights: number; earliestCheckOut: string };

/** The longest stay looked at: the calendar covers 13 months, so nothing above this is a stay it can offer. */
const MAX_NIGHTS = 400;

/** Months the calendar shows at most (the public calendar covers 13). */
const MAX_MONTHS = 13;

export function dayState(index: CalendarIndex, date: string): DayState {
  if (date < index.today) return 'past';
  if (index.unverified) return date < index.end ? 'free' : 'unknown';
  const day = index.days.get(date);
  if (!day) return 'unknown';
  return day.available ? 'free' : 'busy';
}

/** The fewest nights of a stay that starts on `date`: 1 where nothing is said. */
export function minNightsAt(index: CalendarIndex, date: string): number {
  return Math.max(1, index.days.get(date)?.minNights ?? 1);
}

/** Why a stay cannot start on `date`, or null when it can. */
export function arrivalProblem(index: CalendarIndex, date: string): RangeProblem | null {
  const state = dayState(index, date);
  if (state === 'free') return null;
  if (state === 'busy') return { kind: 'busyArrival', date };
  return { kind: state };
}

/**
 * Why the stay from `checkIn` to `checkOut` cannot be had, or null when it can: the arrival must be free, every night in
 * between must be free (the day of the check-out itself may be taken: a guest leaves in the morning), and the stay must have the
 * fewest nights asked for the day it starts. A night the calendar does not know is not free.
 */
export function rangeProblem(index: CalendarIndex, checkIn: string, checkOut: string): RangeProblem | null {
  if (!isStayDate(checkIn) || !isStayDate(checkOut) || checkOut <= checkIn) return { kind: 'unknown' };
  const arrival = arrivalProblem(index, checkIn);
  if (arrival) return arrival;

  const nights = nightsBetween(checkIn, checkOut);
  if (nights > MAX_NIGHTS) return { kind: 'unknown' };
  for (let night = checkIn, count = 0; count < nights; night = addDays(night, 1), count += 1) {
    const state = dayState(index, night);
    if (state === 'busy') return { kind: 'busyBetween', date: night };
    if (state !== 'free') return { kind: 'unknown' };
  }

  const minNights = minNightsAt(index, checkIn);
  if (nights < minNights) return { kind: 'minNights', minNights, earliestCheckOut: addDays(checkIn, minNights) };
  return null;
}

/**
 * What a click on `date` does to the stay: it starts a new one (the day is free for an arrival) when nothing is chosen, when a
 * whole stay is chosen already or when the day is not after the arrival; otherwise it is the check-out, and it is taken when the
 * range holds. When it cannot be done `problem` says why and the stay is left as it was.
 */
export function selectDay(
  index: CalendarIndex,
  value: StayRange,
  date: string,
): { value: StayRange; problem: RangeProblem | null } {
  const startsNew = !value.checkIn || value.checkOut !== '' || date <= value.checkIn;
  if (startsNew) {
    const problem = arrivalProblem(index, date);
    return problem ? { value, problem } : { value: { checkIn: date, checkOut: '' }, problem: null };
  }

  const problem = rangeProblem(index, value.checkIn, date);
  return problem ? { value, problem } : { value: { checkIn: value.checkIn, checkOut: date }, problem: null };
}

/** What the nights of a stay cost together, in cents; null when a night has no price (or the stay is not a stay). */
export function stayTotalCents(index: CalendarIndex, checkIn: string, checkOut: string): number | null {
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1 || nights > MAX_NIGHTS) return null;
  let total = 0;
  for (let night = checkIn, count = 0; count < nights; night = addDays(night, 1), count += 1) {
    const price = index.days.get(night)?.priceCents;
    if (price === null || price === undefined) return null;
    total += price;
  }
  return total;
}

/** `date` moved by `delta` months, on the same day of the month, or on the last day of a shorter month. */
export function addMonths(date: string, delta: number): string {
  if (!isStayDate(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const target = year * 12 + (month - 1) + delta;
  const first = `${String(Math.floor(target / 12)).padStart(4, '0')}-${String((target % 12) + 1).padStart(2, '0')}-01`;
  const lastDay = Number(endOfMonth(first).slice(8, 10));
  return `${first.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/** The first day of each month the calendar shows: from the month of today to the month of the last loaded night. */
export function calendarMonths(index: CalendarIndex): string[] {
  const first = startOfMonth(index.today);
  const last = index.end > index.today ? addDays(index.end, -1) : index.today;
  const months: string[] = [];
  for (let month = first; month && month <= last && months.length < MAX_MONTHS; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

/** A month as a grid of weeks that start on Monday: the blanks before the 1st and the days. */
export function monthGrid(firstOfMonth: string): { leadingBlanks: number; dates: string[] } {
  const leadingBlanks = nightsBetween(startOfWeek(firstOfMonth), firstOfMonth);
  const last = endOfMonth(firstOfMonth);
  const dates: string[] = [];
  for (let day = firstOfMonth; day && day <= last; day = addDays(day, 1)) dates.push(day);
  return { leadingBlanks, dates };
}

/** The keys that move the focus on the grid of days. */
export type CalendarNavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown';

export const CALENDAR_NAV_KEYS: readonly CalendarNavKey[] = [
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Home',
  'End',
  'PageUp',
  'PageDown',
];

/** Where a key takes the focus from `date`: a day, a week, the ends of the week (Monday and Sunday), a month. */
export function moveFocus(date: string, key: CalendarNavKey): string {
  switch (key) {
    case 'ArrowLeft':
      return addDays(date, -1);
    case 'ArrowRight':
      return addDays(date, 1);
    case 'ArrowUp':
      return addDays(date, -7);
    case 'ArrowDown':
      return addDays(date, 7);
    case 'Home':
      return startOfWeek(date);
    case 'End':
      return addDays(startOfWeek(date), 6);
    case 'PageUp':
      return addMonths(date, -1);
    case 'PageDown':
      return addMonths(date, 1);
  }
}

/** The day that takes the tab stop of the grid when nothing says otherwise: the arrival, else the first free day, else today. */
export function defaultFocusDate(index: CalendarIndex, value: StayRange): string {
  if (value.checkIn && dayState(index, value.checkIn) !== 'past' && value.checkIn < index.end) return value.checkIn;
  for (let day = index.today, count = 0; day < index.end && count < MAX_NIGHTS; day = addDays(day, 1), count += 1) {
    if (dayState(index, day) === 'free') return day;
  }
  return index.today;
}

/** The index of what a calendar response says, for the rules above. */
export function buildCalendarIndex(
  days: readonly CalendarDay[],
  today: string,
  end: string,
  unverified = false,
): CalendarIndex {
  return { days: new Map(days.map((day) => [day.date, day])), today, end, unverified };
}
