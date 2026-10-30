import type { TFunction } from 'i18next';
import { isStayDate } from '@/lib/stay-dates';

/**
 * How the stay is written on the public site (DB-20): dates, the range of a stay, the price of a night and the guests, in the
 * language of the page. Dates are stay dates (`YYYY-MM-DD`), shown as written (never moved by a time zone). The formatters are
 * kept: a calendar writes hundreds of dates at every render and an `Intl.DateTimeFormat` is slow to make.
 */

/** The locale of the language of the page: Italian writes `145 €`, English `€145`. */
export function siteLocale(language: string | undefined): string {
  return language?.toLowerCase().startsWith('en') ? 'en-GB' : 'it-IT';
}

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

const priceFormats = new Map<string, Intl.NumberFormat>();

/** `165 €` (or `€165`), with the cents only when there are some. */
export function formatPrice(cents: number, currency: string, locale: string): string {
  const withCents = Math.round(cents) % 100 !== 0;
  const key = `${locale}|${currency}|${withCents ? 2 : 0}`;
  let format = priceFormats.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: withCents ? 2 : 0,
      maximumFractionDigits: withCents ? 2 : 0,
    });
    priceFormats.set(key, format);
  }
  return format.format(cents / 100);
}

/** `3 ospiti · con animale`: the guests in a field of the search bar. */
export function guestsSummary(t: TFunction, adults: number, children: number, pets: boolean): string {
  const people = t('stayPickers.guests.summary', { count: adults + children });
  return pets ? t('stayPickers.guests.summaryWithPet', { people }) : people;
}
