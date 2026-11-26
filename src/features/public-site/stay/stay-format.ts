import type { TFunction } from 'i18next';
import { formatMoney } from '@/lib/money-format';
import { isStayDate } from '@/lib/stay-dates';

/**
 * How the stay is written on the public site (DB-20): dates, the range of a stay, the price of a night and the guests, in the
 * language of the page. Dates are stay dates (`YYYY-MM-DD`), shown as written (never moved by a time zone). The formatters are
 * kept: a calendar writes hundreds of dates at every render and an `Intl.DateTimeFormat` is slow to make. The locale of the
 * language of the page is `siteLocale` of `lib/site-language.ts`; the way an amount is written, and what is written when the data
 * has no currency, is `formatMoney` of `lib/money-format.ts`.
 */

const dateFormats = new Map<string, Intl.DateTimeFormat>();

function writeDate(date: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  if (!isStayDate(date)) return '';
  const key = `${locale}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
    dateFormats.set(key, format);
  }
  const [year, month, day] = date.split('-').map(Number);
  return format.format(new Date(Date.UTC(year, month - 1, day)));
}

const capitalize = (text: string) => (text ? text.charAt(0).toLocaleUpperCase() + text.slice(1) : text);

/** `30 ott` */
export function formatDayMonthShort(date: string, locale: string): string {
  return writeDate(date, locale, { day: 'numeric', month: 'short' });
}

/** `30 ottobre` */
export function formatDayMonth(date: string, locale: string): string {
  return writeDate(date, locale, { day: 'numeric', month: 'long' });
}

/** `Giovedì 30 ottobre`: the name of a day of the calendar, in full. */
export function formatDayLong(date: string, locale: string): string {
  return capitalize(writeDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long' }));
}

/** `Ottobre 2026` */
export function formatMonthYear(date: string, locale: string): string {
  return capitalize(writeDate(date, locale, { month: 'long', year: 'numeric' }));
}

/** `30 ott – 3 nov`: the stay in a field of the search bar. Empty until both days are chosen. */
export function formatStayRange(checkIn: string, checkOut: string, locale: string): string {
  if (!checkIn || !checkOut) return '';
  const from = formatDayMonthShort(checkIn, locale);
  const to = formatDayMonthShort(checkOut, locale);
  return from && to ? `${from} – ${to}` : '';
}

/** The initials of the days of the week, from Monday, for the head of the grid. */
export function weekdayInitials(locale: string): string[] {
  // 5 October 2026 is a Monday.
  return Array.from({ length: 7 }, (_, index) =>
    writeDate(`2026-10-${String(5 + index).padStart(2, '0')}`, locale, { weekday: 'narrow' }).toLocaleUpperCase(locale),
  );
}

/** The name of a day of the week, from Monday (0), for the screen readers. */
export function weekdayName(index: number, locale: string): string {
  return capitalize(writeDate(`2026-10-${String(5 + index).padStart(2, '0')}`, locale, { weekday: 'long' }));
}

/**
 * `165 €` (or `€165`), with the cents only when there are some. The currency is the one of the data (`CHF` for a home in Switzerland): when the data
 * gives none, or gives something that is not a code, nothing is guessed and nothing throws: the amount is written bare and the phrase says the
 * currency is not available (`165 (valuta non disponibile)`).
 */
export function formatPrice(cents: number, currency: string | null | undefined, locale: string, t: TFunction): string {
  const digits = Math.round(cents) % 100 !== 0 ? 2 : 0;
  return formatMoney(cents / 100, currency, locale, t, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** `3 ospiti · con animale`: the guests in a field of the search bar. */
export function guestsSummary(t: TFunction, adults: number, children: number, pets: boolean): string {
  const people = t('stayPickers.guests.summary', { count: adults + children });
  return pets ? t('stayPickers.guests.summaryWithPet', { people }) : people;
}
