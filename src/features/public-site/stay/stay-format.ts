import type { TFunction } from 'i18next';
import { currencyCodeOf, formatAmount, formatMoney, type MoneyDigits } from '@/lib/money-format';
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

export function formatDayMonthShort(date: string, locale: string): string {
  return writeDate(date, locale, { day: 'numeric', month: 'short' });
}

export function formatDayMonth(date: string, locale: string): string {
  return writeDate(date, locale, { day: 'numeric', month: 'long' });
}

export function formatDayLong(date: string, locale: string): string {
  return capitalize(writeDate(date, locale, { weekday: 'long', day: 'numeric', month: 'long' }));
}

export function formatMonthYear(date: string, locale: string): string {
  return capitalize(writeDate(date, locale, { month: 'long', year: 'numeric' }));
}

export function formatStayRange(checkIn: string, checkOut: string, locale: string): string {
  if (!checkIn || !checkOut) return '';
  const from = formatDayMonthShort(checkIn, locale);
  const to = formatDayMonthShort(checkOut, locale);
  return from && to ? `${from} – ${to}` : '';
}

export function weekdayInitials(locale: string): string[] {
  return Array.from({ length: 7 }, (_, index) =>
    writeDate(`2026-10-${String(5 + index).padStart(2, '0')}`, locale, { weekday: 'narrow' }).toLocaleUpperCase(locale),
  );
}

export function weekdayName(index: number, locale: string): string {
  return capitalize(writeDate(`2026-10-${String(5 + index).padStart(2, '0')}`, locale, { weekday: 'long' }));
}

export function formatPrice(cents: number, currency: string | null | undefined, locale: string, t: TFunction): string {
  return formatMoney(cents / 100, currency, locale, t, digitsOf(cents));
}

function digitsOf(cents: number): MoneyDigits {
  const digits = Math.round(cents) % 100 !== 0 ? 2 : 0;
  return { minimumFractionDigits: digits, maximumFractionDigits: digits };
}

export function formatPriceAmount(cents: number, locale: string): string {
  return formatAmount(cents / 100, locale, digitsOf(cents));
}

export function formatPriceShort(cents: number, currency: string | null | undefined, locale: string, t: TFunction): string {
  return currencyCodeOf(currency) ? formatPrice(cents, currency, locale, t) : formatPriceAmount(cents, locale);
}

export function guestsSummary(t: TFunction, adults: number, children: number, pets: boolean): string {
  const people = t('stayPickers.guests.summary', { count: adults + children });
  return pets ? t('stayPickers.guests.summaryWithPet', { people }) : people;
}
