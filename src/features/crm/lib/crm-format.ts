import { formatRomeDateTime, formatStayDate, nightsBetween, parseStayDate, todayInRome } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';

const DAYS_IN_WEEK = 7;
const DAYS_IN_MONTH = 30;
const DAYS_IN_YEAR = 365;

/** The locale the money and the numbers of the CRM screens are written in, from the language of the app. */
function localeOf(language: string): string {
  return language.startsWith('en') ? 'en-GB' : 'it-IT';
}

export function formatMoney(amount: number, language: string): string {
  return formatCurrency(amount, 'EUR', localeOf(language));
}

export function formatDecimal(value: number, language: string): string {
  return new Intl.NumberFormat(localeOf(language), { maximumFractionDigits: 1 }).format(value);
}

export function formatDay(value: string | null | undefined, language: string): string | null {
  const day = parseStayDate(value);
  return day ? formatStayDate(day, language, { day: 'numeric', month: 'short', year: 'numeric' }) : null;
}

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
