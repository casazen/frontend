import { formatRomeDateTime, formatStayDate, nightsBetween, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const DAYS_IN_YEAR = 365;

/** The locale the money and the numbers of the CRM screens are written in, from the language of the app. */
function localeOf(language: string): string {
  return language.startsWith('en') ? 'en-GB' : 'it-IT';
}

/** An amount in euro, the only currency of the CRM figures (a stay is paid in euro). */
export function formatMoney(amount: number, language: string): string {
  return formatCurrency(amount, 'EUR', localeOf(language));
}

/** A number with at most one decimal (the guests of a stay on average). */
export function formatDecimal(value: number, language: string): string {
  return new Intl.NumberFormat(localeOf(language), { maximumFractionDigits: 1 }).format(value);
}

/**
 * A day the API sends as a date (a stay date, or the UTC midnight of the day: the arrival of a booking) as the person reads it, with
 * no shift for the time zone. `null` when there is none (a profile that has no stay).
 */
export function formatDay(value: string | null | undefined, language: string): string | null {
  const day = parseStayDate(value);
  return day ? formatStayDate(day, language, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

/**
 * How long ago a stay day was, in the words of the language ("ieri", "3 giorni fa", "2 mesi fa"), counted in calendar days of Rome as the
 * stay dates are. A day more than a week away is counted in weeks, then months, then years. `null` when there is none.
 */
export function formatRelativeDay(value: string | null | undefined, language: string, now: Date = new Date()): string | null {
  const day = parseStayDate(value);
  if (!day) return null;
  const today = todayInRome(now);
  const days = nightsBetween(today, day) - nightsBetween(day, today);
  const distance = Math.abs(days);
  const format = new Intl.RelativeTimeFormat(localeOf(language), { numeric: 'auto' });
  if (distance < DAYS_IN_WEEK) return format.format(days, 'day');
  if (distance < DAYS_IN_MONTH) return format.format(Math.trunc(days / DAYS_IN_WEEK), 'week');
  if (distance < DAYS_IN_YEAR) return format.format(Math.trunc(days / DAYS_IN_MONTH), 'month');
  return format.format(Math.trunc(days / DAYS_IN_YEAR), 'year');
}

/** The day of an instant (the moment a consent was recorded, a review was published), on the Europe/Rome calendar. `null` when it is not a date. */
export function formatInstantDay(value: string | null | undefined, language: string): string | null {
  if (!value) return null;
  const text = formatRomeDateTime(value, language, { day: 'numeric', month: 'short', year: 'numeric' });
  return text || null;
}
