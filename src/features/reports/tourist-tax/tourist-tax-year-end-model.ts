import type { YearEndAccountCut } from '@/api/tourist-tax-summary.api';
import type { ReportFileFormat } from '@/api/report-files';
import { formatMoney } from '@/features/fiscal/fiscal-format';
import { todayInRome } from '@/lib/stay-dates';

/**
 * Pure helpers of the page of the tourist tax at year end (E18/F01/US02/T03, NF-117): which years it offers, what a file is called when the page cannot read the name the server gives it, and how a figure of the year is
 * written. The files are the server's: nothing here reads one, adds up a figure or decides a reason of an exemption.
 */

/** The years the page offers: the current one and the three before it. */
const YEARS_OFFERED = 4;

/** The years of the page, newest first: the current year in Europe/Rome and the three before it (the server takes the years 2000 to 2100). */
export function yearEndYears(today: string = todayInRome()): number[] {
  const current = Number(today.slice(0, 4));
  return Array.from({ length: YEARS_OFFERED }, (_, index) => current - index);
}

/** The cuts of the account of the agent, in the order the page offers them. */
export const YEAR_END_ACCOUNT_CUTS: readonly YearEndAccountCut[] = ['month', 'quarter'];

/**
 * The files of the tourist tax at year end that the agency hands over: the declaration to the comuni, the account of the agent and the yearly count of the nights in Ticino. Each request names the file and its year,
 * never a figure or a guest.
 */
export type YearEndFileRequest =
  | { kind: 'declaration'; year: number; format: ReportFileFormat }
  | { kind: 'agentAccount'; year: number; by: YearEndAccountCut; format: ReportFileFormat }
  | { kind: 'ticino'; year: number; format: ReportFileFormat };

/** The row of the page a request belongs to: where its failure is told. */
export type YearEndRow = YearEndFileRequest['kind'];

/**
 * The name a file is saved under when the page cannot read the one the server gives it (`Content-Disposition`, which a browser shows to a page only when the API exposes it): the one the server would give, so the file has the
 * same name whether the header is readable or not.
 */
export function yearEndFallbackName(request: YearEndFileRequest): string {
  switch (request.kind) {
    case 'declaration':
      return `casazen-imposta-soggiorno-dichiarazione-${request.year}.${request.format}`;
    case 'agentAccount':
      return `casazen-imposta-soggiorno-conto-agente-${request.year}-${request.by === 'quarter' ? 'trimestrale' : 'mensile'}.${request.format}`;
    case 'ticino':
      return `casazen-imposta-soggiorno-ticino-${request.year}.${request.format}`;
  }
}

const CURRENCY_CODE = /^[A-Z]{3}$/;

/** True when the answer names a currency: three letters, as the server writes it (`EUR`). An empty or odd code is no currency. */
export function hasYearEndCurrency(currency: string | null | undefined): currency is string {
  return typeof currency === 'string' && CURRENCY_CODE.test(currency.trim().toUpperCase());
}

/**
 * A figure of the year from the cents the server sends, in the currency the answer itself names, never in an assumed one. An answer that names none is written as the figure alone, two decimals and no symbol, and the page
 * says so in words (`hasYearEndCurrency`).
 */
export function yearEndMoney(cents: number, currency: string | null | undefined, locale: string): string {
  const amount = cents / 100;
  return hasYearEndCurrency(currency)
    ? formatMoney(amount, locale, currency.trim().toUpperCase())
    : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}
