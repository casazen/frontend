import { formatRomeDateTime, formatStayDate, parseStayDate } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';

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

/** The day of an instant (the moment a consent was recorded, a review was published), on the Europe/Rome calendar. `null` when it is not a date. */
export function formatInstantDay(value: string | null | undefined, language: string): string | null {
  if (!value) return null;
  const text = formatRomeDateTime(value, language, { day: 'numeric', month: 'short', year: 'numeric' });
  return text || null;
}
