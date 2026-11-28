import { addDays, endOfMonth, isStayDate, nightsBetween, startOfMonth, startOfWeek } from '@/lib/stay-dates';

export interface CalendarDay {
  date: string;
  available: boolean;
  priceCents: number | null;
  minNights: number;
  maxNights?: number | null;
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  minAdvanceDays?: number | null;
  maxAdvanceDays?: number | null;
}

export interface StayRange {
  checkIn: string;
  checkOut: string;
}

export interface CalendarIndex {
  days: ReadonlyMap<string, CalendarDay>;
  today: string;
  end: string;
  unverified?: boolean;
}

export type DayState = 'past' | 'unknown' | 'busy' | 'free';

export type RangeProblem =
  | { kind: 'past' }
  | { kind: 'unknown' }
  | { kind: 'busyArrival'; date: string }
  | { kind: 'busyBetween'; date: string }
  | { kind: 'arrivalClosed'; date: string }
  | { kind: 'departureClosed'; date: string }
  | { kind: 'minNights'; minNights: number; earliestCheckOut: string }
  | { kind: 'maxNights'; maxNights: number; latestCheckOut: string }
  | { kind: 'advance'; side: 'shorter' | 'longer'; days: number };

const MAX_NIGHTS = 400;

const MAX_MONTHS = 13;

export function dayState(index: CalendarIndex, date: string): DayState {
  if (date < index.today) return 'past';
  if (index.unverified) return date < index.end ? 'free' : 'unknown';
  const day = index.days.get(date);
  if (!day) return 'unknown';
  return day.available ? 'free' : 'busy';
}

export function minNightsAt(index: CalendarIndex, date: string): number {
  return Math.max(1, index.days.get(date)?.minNights ?? 1);
}

export function maxNightsAt(index: CalendarIndex, date: string): number | null {
  const maximum = index.days.get(date)?.maxNights;
  return typeof maximum === 'number' && maximum >= 1 ? maximum : null;
}

function advanceProblem(index: CalendarIndex, date: string): RangeProblem | null {
  const day = index.days.get(date);
  if (!day) return null;
  const ahead = nightsBetween(index.today, date);
  const { minAdvanceDays: shortest, maxAdvanceDays: longest } = day;
  if (typeof shortest === 'number' && ahead < shortest) return { kind: 'advance', side: 'shorter', days: shortest };
  if (typeof longest === 'number' && ahead > longest) return { kind: 'advance', side: 'longer', days: longest };
  return null;
}

export function arrivalProblem(index: CalendarIndex, date: string): RangeProblem | null {
  const state = dayState(index, date);
  if (state === 'busy') return { kind: 'busyArrival', date };
  if (state !== 'free') return { kind: state };
  if (index.days.get(date)?.closedToArrival) return { kind: 'arrivalClosed', date };
  return advanceProblem(index, date);
}

/**
 * Why the stay from `checkIn` to `checkOut` cannot be had, or null when it can: the arrival must be free and open to arrival (and
 * inside its advance window), every night in between must be free (the day of the check-out itself may be taken: a guest leaves in the
 * morning), the day of the check-out must not be closed to departure, and the stay must have at least the nights asked for the day it
 * starts and at most the nights that day allows. A night the calendar does not know is not free.
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

  if (index.days.get(checkOut)?.closedToDeparture) return { kind: 'departureClosed', date: checkOut };

  const minNights = minNightsAt(index, checkIn);
  if (nights < minNights) return { kind: 'minNights', minNights, earliestCheckOut: addDays(checkIn, minNights) };
  const maxNights = maxNightsAt(index, checkIn);
  if (maxNights !== null && nights > maxNights) {
    return { kind: 'maxNights', maxNights, latestCheckOut: addDays(checkIn, maxNights) };
  }
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

export function addMonths(date: string, delta: number): string {
  if (!isStayDate(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const target = year * 12 + (month - 1) + delta;
  const first = `${String(Math.floor(target / 12)).padStart(4, '0')}-${String((target % 12) + 1).padStart(2, '0')}-01`;
  const lastDay = Number(endOfMonth(first).slice(8, 10));
  return `${first.slice(0, 8)}${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

export function calendarMonths(index: CalendarIndex): string[] {
  const first = startOfMonth(index.today);
  const last = index.end > index.today ? addDays(index.end, -1) : index.today;
  const months: string[] = [];
  for (let month = first; month && month <= last && months.length < MAX_MONTHS; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

export function monthGrid(firstOfMonth: string): { leadingBlanks: number; dates: string[] } {
  const leadingBlanks = nightsBetween(startOfWeek(firstOfMonth), firstOfMonth);
  const last = endOfMonth(firstOfMonth);
  const dates: string[] = [];
  for (let day = firstOfMonth; day && day <= last; day = addDays(day, 1)) dates.push(day);
  return { leadingBlanks, dates };
}

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

export function buildCalendarIndex(
  days: readonly CalendarDay[],
  today: string,
  end: string,
  unverified = false,
): CalendarIndex {
  return { days: new Map(days.map((day) => [day.date, day])), today, end, unverified };
}
