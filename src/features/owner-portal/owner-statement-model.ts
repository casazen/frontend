import type {
  OwnerPortalInvoice,
  OwnerPortalInvoiceKind,
  OwnerPortalStatement,
  OwnerPortalStatementSection,
  OwnerPortalStatementSectionName,
  OwnerPortalStatementTotals,
  OwnerPortalTouristTax,
} from '@/types';

// ---------------------------------------------------------------- the period and the order

/** «Novembre 2026» in the language of the person: never a month name written in one language into a page of another. */
export function periodLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

/** The statements as the page lists them: the latest period and the latest version first. */
export function sortedStatements(statements: readonly OwnerPortalStatement[]): OwnerPortalStatement[] {
  return [...statements].sort((a, b) => b.year - a.year || b.month - a.month || b.version - a.version);
}

/** The invoices of the manager, the latest day first (the order of the server is kept for the same day). */
export function sortedInvoices(invoices: readonly OwnerPortalInvoice[]): OwnerPortalInvoice[] {
  return [...invoices].sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0));
}

// ---------------------------------------------------------------- money: the currency is the one of the data, never one of the code

/**
 * The code of a currency as the answer gives it (`CHF`, `EUR`), or `null` when the answer gives none that can be written: an amount without a currency is shown without a
 * symbol (and the page says so), it is never given a euro or a franc.
 */
export function currencyCode(value: string | null | undefined): string | null {
  const code = (value ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

const MONEY_FORMATS = new Map<string, Intl.NumberFormat>();

function moneyFormat(locale: string, code: string | null): Intl.NumberFormat {
  const key = `${locale}|${code ?? ''}`;
  let format = MONEY_FORMATS.get(key);
  if (!format) {
    format = code
      ? new Intl.NumberFormat(locale, { style: 'currency', currency: code })
      : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    MONEY_FORMATS.set(key, format);
  }
  return format;
}

/** What stands in the place of an amount that is not a number: never a zero. */
const NO_AMOUNT = '—';

/**
 * An amount in the currency of the data, with the sign the ledger wrote (a charge is negative). The symbol and the order of the number and of the symbol are the ones the
 * language of the person gives to that currency (`1234,50 CHF`, `1234,50 €`); without a currency (`currencyCode` is `null`) it is the plain figure. An amount that rounds to
 * nothing is written as a plain zero, never as «-0,00».
 */
export function formatMoney(amount: number, currency: string | null | undefined, locale: string): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return NO_AMOUNT;
  const format = moneyFormat(locale, currencyCode(currency));
  const digits = format.resolvedOptions().maximumFractionDigits ?? 2;
  return format.format(Math.round(Math.abs(amount) * 10 ** digits) === 0 ? 0 : amount);
}

/** A sum of amounts worked out in cents, so that a few of them never add up to «0,30000000000000004». */
function sumAmounts(amounts: readonly number[]): number {
  return amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0) / 100;
}

// ---------------------------------------------------------------- the totals

/** The totals the card of a statement always draws under the net, in the order they make it up. */
const BASE_TOTALS = ['gross', 'channelFees', 'withholding', 'commission', 'charges'] as const;

/** The totals the page draws under the net: the five of the brief always, and the corrections only when there is one (without it the net would not add up). */
export function shownTotals(totals: OwnerPortalStatementTotals): Array<(typeof BASE_TOTALS)[number] | 'corrections'> {
  return sumAmounts([totals.corrections]) === 0 ? [...BASE_TOTALS] : [...BASE_TOTALS, 'corrections'];
}

/** What stands before and after the period: the balance the months before left, what was paid between the agency and the owner, and what the agency owes at the end. */
export const BALANCE_KEYS = ['openingBalance', 'payments', 'closingBalance'] as const;

// ---------------------------------------------------------------- the lines of a statement

/** The parts of a statement in the order of its PDF. */
const STATEMENT_SECTIONS: readonly OwnerPortalStatementSectionName[] = ['stays', 'channelFees', 'withholding', 'commission', 'recharges', 'corrections', 'payments'];

/** The parts that have lines, in the order of the PDF: an empty part says nothing and is not drawn; a part this page has no words for is not drawn either. */
export function sectionsWithLines(sections: readonly OwnerPortalStatementSection[]): OwnerPortalStatementSection[] {
  return STATEMENT_SECTIONS.flatMap((name) => sections.filter((section) => section.section === name && section.lines.length > 0));
}

// ---------------------------------------------------------------- the tourist tax

/** The tourist tax of the stays summed for each currency (in cents), in the order the currencies first appear: a sum never mixes francs and euros. */
export function touristTaxTotals(rows: readonly OwnerPortalTouristTax[]): Array<{ currency: string | null; total: number }> {
  const groups = new Map<string, { currency: string | null; amounts: number[] }>();
  for (const row of rows) {
    const code = currencyCode(row.currency);
    const group = groups.get(code ?? '') ?? { currency: code, amounts: [] };
    group.amounts.push(row.amount);
    groups.set(code ?? '', group);
  }
  return Array.from(groups.values(), (group) => ({ currency: group.currency, total: sumAmounts(group.amounts) }));
}

// ---------------------------------------------------------------- the invoices of the manager

const INVOICE_KINDS: readonly OwnerPortalInvoiceKind[] = ['Invoice', 'Receipt', 'CreditNote'];

/** The kind of an invoice the page has a word for, or `Other` (a kind a later backend adds is called «document», never shown as the raw name). */
export function invoiceKindOf(kind: string): OwnerPortalInvoiceKind | 'Other' {
  return INVOICE_KINDS.find((item) => item === kind) ?? 'Other';
}
