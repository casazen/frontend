import { getBookingSourceLabel } from '@/lib/i18n-labels';
import i18n from '@/i18n/config';
import { getHttpStatus } from '@/lib/api-errors';
import { endOfMonth, formatStayDate, startOfMonth } from '@/lib/stay-dates';
import type { BalanceRow, BalancesToCollectReport, BalanceTotal, CollectionsBucket } from '@/types';

/**
 * Pure helpers of the money reports (NF-97, NF-98): how the numbers of the server are written in the language of the app. The figures are
 * the server's, so nothing here adds, subtracts, multiplies, divides or rounds an amount: the cents the server sends are written as they
 * are (the digits are split as text, no division), the rate it sends is formatted as it is, and two currencies are never put together.
 */

type Translate = (key: string) => string;

const CURRENCY_CODE = /^[A-Za-z]{3}$/;

const MONEY_FORMATS = new Map<string, Intl.NumberFormat>();

function moneyFormat(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let format = MONEY_FORMATS.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: 'currency', currency });
    MONEY_FORMATS.set(key, format);
  }
  return format;
}

/** The amount of `cents` as the decimal text of the number (`123456` is `1234.56`), made of the digits alone: no division, no float. */
function decimalOfCents(cents: number): string {
  const digits = String(Math.abs(cents)).padStart(3, '0');
  return `${cents < 0 ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/**
 * An amount the server sends in cents, written in the currency and the language of the app (`1.234,56 €`, `CHF 1,234.56`). The server
 * gives every amount as an exact count of cents next to the euros; this writes the digits it gives. Null when there is no amount (the
 * caller says "not available") or when the value is not a whole count of cents (never a guess).
 */
export function formatCents(cents: number | null | undefined, currency: string, locale: string): string | null {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) return null;
  const amount = Number(decimalOfCents(cents));
  if (!CURRENCY_CODE.test(currency)) return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`.trim();
  return moneyFormat(locale, currency.toUpperCase()).format(amount);
}

const RATE_FORMATS = new Map<string, Intl.NumberFormat>();

/**
 * A rate or a share the server sends as a fraction from 0 to 1 with four decimals, written as a percentage with the two decimals that
 * hold them (`0.1534` is `15,34%`, `0.12` is `12%`). Nothing is rounded. Null when the server has none.
 */
export function formatRate(rate: number | null | undefined, locale: string): string | null {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;
  let format = RATE_FORMATS.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2 });
    RATE_FORMATS.set(locale, format);
  }
  return format.format(rate);
}

/** The name of a channel (the booking source the server sends): the usual name of the portal, or the value as it is when it is a new one. */
export function channelLabel(source: string | null | undefined, t: Translate): string {
  return getBookingSourceLabel(source, t);
}

/** The name of a payment method (`CreditCard`...): its words, or the value as it is when the server has a new one. */
export function paymentMethodLabel(method: string, t: Translate): string {
  const key = `reports.collections.methods.${method}`;
  return i18n.exists(key) ? t(key) : method;
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

/** A day of the server (`yyyy-MM-dd`) as it is read: `9 ott 2026`. Empty when it is not a day. */
export function shortDay(day: string, locale: string): string {
  return formatStayDate(day, locale, SHORT_DATE);
}

/** The name of a bucket of the collections by date: the day (`9 ott 2026`) or the month (`ottobre 2026`). */
export function bucketName(bucket: Pick<CollectionsBucket, 'unit' | 'from'>, locale: string): string {
  return bucket.unit === 'month' ? formatStayDate(bucket.from, locale, MONTH_YEAR) : shortDay(bucket.from, locale);
}

/** A month of the collections that the period cuts at one end: its first or last day is not the first or last of the month. */
export function isPartialMonth(bucket: Pick<CollectionsBucket, 'unit' | 'from' | 'to'>): boolean {
  return bucket.unit === 'month' && (bucket.from !== startOfMonth(bucket.from) || bucket.to !== endOfMonth(bucket.to));
}

/** The balances of one currency: its stays and what the server says is to collect in it. */
export interface BalanceSection {
  currency: string;
  rows: BalanceRow[];
  /** The server's total of this currency; null only if the server sent rows without a total for it (the section then has none). */
  total: BalanceTotal | null;
}

/**
 * The balances cut by currency, in the order of the totals the server sends (by currency code): amounts of two currencies are never put
 * in one table with one total. With a single currency (the usual case) it is one section, and nothing about the currency needs saying.
 */
export function balanceSections(report: Pick<BalancesToCollectReport, 'rows' | 'totals'>): BalanceSection[] {
  const sections: BalanceSection[] = report.totals.map((total) => ({ currency: total.currency, rows: [], total }));
  for (const row of report.rows) {
    let section = sections.find((candidate) => candidate.currency === row.currency);
    if (!section) {
      section = { currency: row.currency, rows: [], total: null };
      sections.push(section);
    }
    section.rows.push(row);
  }
  return sections.filter((section) => section.rows.length > 0 || section.total !== null);
}

/**
 * What a money report read stands for, in the order the page has to look at it: a failure first (a 404 is "not found", whatever is
 * still in the cache: the query keeps the old data on an error, and old figures never stay on screen next to a failure), then the 403
 * ("not for this caller", which the API turns into `null`), then loading, then the data.
 */
export type ReportView<T> =
  | { kind: 'loading' }
  | { kind: 'notFound' }
  | { kind: 'forbidden' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; data: T };

export function reportView<T>(query: { data: T | null | undefined; isError: boolean; error: unknown }): ReportView<T> {
  if (query.isError) return getHttpStatus(query.error) === 404 ? { kind: 'notFound' } : { kind: 'error', error: query.error };
  if (query.data === null) return { kind: 'forbidden' };
  if (query.data === undefined) return { kind: 'loading' };
  return { kind: 'ready', data: query.data };
}
