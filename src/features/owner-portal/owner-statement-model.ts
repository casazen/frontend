import type {
  OwnerPortalInvoice,
  OwnerPortalInvoiceKind,
  OwnerPortalStatement,
  OwnerPortalStatementLine,
  OwnerPortalStatementSection,
  OwnerPortalStatementSectionName,
  OwnerPortalStatementTotals,
  OwnerPortalTouristTax,
} from '@/types';

export function periodLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function sortedStatements(statements: readonly OwnerPortalStatement[]): OwnerPortalStatement[] {
  return [...statements].sort((a, b) => b.year - a.year || b.month - a.month || b.version - a.version);
}

export function sortedInvoices(invoices: readonly OwnerPortalInvoice[]): OwnerPortalInvoice[] {
  return [...invoices].sort((a, b) => (a.issueDate < b.issueDate ? 1 : a.issueDate > b.issueDate ? -1 : 0));
}

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

const BASE_TOTALS = ['gross', 'channelFees', 'withholding', 'commission', 'charges'] as const;

export function shownTotals(totals: OwnerPortalStatementTotals): Array<(typeof BASE_TOTALS)[number] | 'corrections'> {
  return sumAmounts([totals.corrections]) === 0 ? [...BASE_TOTALS] : [...BASE_TOTALS, 'corrections'];
}

export const BALANCE_KEYS = ['openingBalance', 'payments', 'closingBalance'] as const;

const STATEMENT_SECTIONS: readonly OwnerPortalStatementSectionName[] = ['stays', 'channelFees', 'withholding', 'commission', 'recharges', 'corrections', 'payments'];

export function sectionsWithLines(sections: readonly OwnerPortalStatementSection[]): OwnerPortalStatementSection[] {
  return STATEMENT_SECTIONS.flatMap((name) => sections.filter((section) => section.section === name && section.lines.length > 0));
}

const BORNE_BY_AGENCY_TYPE = 'ChannelFeeBorneByAgency';

type InformationalFacts = Pick<OwnerPortalStatementLine, 'type' | 'informational'>;

/**
 * A line for information only (today the commission of a portal that the agency bears, and the owner is not charged): the page shows it and leaves it out of every sum. The server says it
 * (`informational`), and so does the type that is always one. The totals the page writes (the net, the parts, the balances) are the server's and never hold such a line: the page adds up no
 * line of the ledger by itself.
 */
export function isInformationalLine(line: InformationalFacts): boolean {
  return line.informational === true || line.type === BORNE_BY_AGENCY_TYPE;
}

/**
 * The amount a line is written with. A line for information only is the commission the agency bears, and it is written as the PDF and the CSV of the statement write it, a positive figure
 * (the ledger holds it as a negative, like a commission of the portal): never with the minus of a deduction, because nothing is deducted. Every other line keeps the sign of the ledger.
 */
export function shownLineAmount(line: InformationalFacts & Pick<OwnerPortalStatementLine, 'amount'>): number {
  if (!isInformationalLine(line)) return line.amount;
  return line.amount === 0 ? 0 : -line.amount;
}

export type PortalFeeNote = 'borneByAgency' | 'rechargedByAgency' | 'chargedOnAgencyAccount';

/**
 * The sentence a line carries about the commission of a portal, from its four flags (`channelFeeRechargedByAgency`, `channelFeeBilledToAgencyNotRecharged`, `channelFeeChargedOnAgencyAccount`,
 * `informational`); `null` for the account of the owner (V1: all four are false), where the line says nothing more than it always did.
 *
 * - the line for information only: the agency bears the commission and the owner is not charged (`borneByAgency`);
 * - the agency holds the account and recharges the commission on its invoice (`rechargedByAgency`);
 * - the owner WAS charged the commission on an account of the agency that is not recharged now, a line posted before the rule (`chargedOnAgencyAccount`): never told as the account of the owner.
 *
 * A server older than the rule sent `channelFeeBilledToAgencyNotRecharged` for that last case (the line was in the totals, the owner charged) and no `informational`: it is read as the case it
 * was, never as the commission the agency bears, which only `informational` says.
 */
export function portalFeeNoteOf(
  line: InformationalFacts & Pick<OwnerPortalStatementLine, 'channelFeeRechargedByAgency' | 'channelFeeBilledToAgencyNotRecharged' | 'channelFeeChargedOnAgencyAccount'>,
): PortalFeeNote | null {
  if (isInformationalLine(line)) return 'borneByAgency';
  if (line.channelFeeRechargedByAgency) return 'rechargedByAgency';
  if (line.channelFeeChargedOnAgencyAccount === true || line.channelFeeBilledToAgencyNotRecharged === true) return 'chargedOnAgencyAccount';
  return null;
}

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

const INVOICE_KINDS: readonly OwnerPortalInvoiceKind[] = ['Invoice', 'Receipt', 'CreditNote'];

export function invoiceKindOf(kind: string): OwnerPortalInvoiceKind | 'Other' {
  return INVOICE_KINDS.find((item) => item === kind) ?? 'Other';
}
