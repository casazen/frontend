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

const PLAIN_FORMATS = new Map<string, Intl.NumberFormat>();

function plainFormat(locale: string): Intl.NumberFormat {
  let format = PLAIN_FORMATS.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    PLAIN_FORMATS.set(locale, format);
  }
  return format;
}

function decimalOfCents(cents: number): string {
  const digits = String(Math.abs(cents)).padStart(3, '0');
  return `${cents < 0 ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

/**
 * An amount the server sends in cents, written in the currency and the language of the app (`1.234,56 €`, `CHF 1,234.56`). The server
 * gives every amount as an exact count of cents next to the euros; this writes the digits it gives. With no currency (`null`: the figure
 * does not say one) it is the number alone, `1.234,56`, never a symbol that may be false. Null when there is no amount (the caller says
 * "not available") or when the value is not a whole count of cents (never a guess).
 */
export function formatCents(cents: number | null | undefined, currency: string | null, locale: string): string | null {
  if (typeof cents !== 'number' || !Number.isSafeInteger(cents)) return null;
  const amount = Number(decimalOfCents(cents));
  if (currency === null) return plainFormat(locale).format(amount);
  if (!CURRENCY_CODE.test(currency)) return `${plainFormat(locale).format(amount)} ${currency}`.trim();
  return moneyFormat(locale, currency.toUpperCase()).format(amount);
}

export function formatSummedCents(cents: number | null | undefined, locale: string): string | null {
  return formatCents(cents, null, locale);
}

const RATE_FORMATS = new Map<string, Intl.NumberFormat>();

export function formatRate(rate: number | null | undefined, locale: string): string | null {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return null;
  let format = RATE_FORMATS.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 0, maximumFractionDigits: 2 });
    RATE_FORMATS.set(locale, format);
  }
  return format.format(rate);
}

export function channelLabel(source: string | null | undefined, t: Translate): string {
  return getBookingSourceLabel(source, t);
}

export function paymentMethodLabel(method: string, t: Translate): string {
  const key = `reports.collections.methods.${method}`;
  return i18n.exists(key) ? t(key) : method;
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
const MONTH_YEAR: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

export function shortDay(day: string, locale: string): string {
  return formatStayDate(day, locale, SHORT_DATE);
}

export function bucketName(bucket: Pick<CollectionsBucket, 'unit' | 'from'>, locale: string): string {
  return bucket.unit === 'month' ? formatStayDate(bucket.from, locale, MONTH_YEAR) : shortDay(bucket.from, locale);
}

export function isPartialMonth(bucket: Pick<CollectionsBucket, 'unit' | 'from' | 'to'>): boolean {
  return bucket.unit === 'month' && (bucket.from !== startOfMonth(bucket.from) || bucket.to !== endOfMonth(bucket.to));
}

export interface BalanceSection {
  currency: string;
  rows: BalanceRow[];
  total: BalanceTotal | null;
}

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
