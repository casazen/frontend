import { toCents } from '@/features/owner-accounting/owner-accounting-model';
import type { OwnerInvoiceLine, OwnerInvoiceListItem } from '@/types';

/** An invoice that is a draft has no number yet: the server gives it at the issue. */
export const isDraft = (invoice: Pick<OwnerInvoiceListItem, 'status'>): boolean => invoice.status === 'Draft';

/** An invoice that was issued and numbered. */
export const isIssued = (invoice: Pick<OwnerInvoiceListItem, 'status'>): boolean => invoice.status === 'Issued';

/**
 * The live invoice made from a version: the one that is not credited in full (an invoice credited in full frees its owner and month for a new one, and stays in the list as history).
 * `null` when the version has none.
 */
export function liveInvoiceOfVersion(invoices: readonly OwnerInvoiceListItem[], versionId: string): OwnerInvoiceListItem | null {
  return invoices.find((invoice) => invoice.statementVersionId === versionId && !invoice.creditedInFull) ?? null;
}

/** The live invoice the owner has for the month, from whatever version of the statement it was made: a month holds one. */
export function liveInvoiceOfMonth(invoices: readonly OwnerInvoiceListItem[]): OwnerInvoiceListItem | null {
  return invoices.find((invoice) => !invoice.creditedInFull) ?? null;
}

/** The invoices of the version that were credited in full: history, shown as such and never as the invoice of the month. */
export function creditedInvoicesOfVersion(invoices: readonly OwnerInvoiceListItem[], versionId: string): OwnerInvoiceListItem[] {
  return invoices.filter((invoice) => invoice.statementVersionId === versionId && invoice.creditedInFull);
}

/** How an issued invoice is paid. `unknown` is a state of a later server: it is told by its code, never as paid. */
export type InvoiceSettlement =
  | { kind: 'offset' }
  | { kind: 'toPay'; amountDue: number }
  | { kind: 'credited' }
  | { kind: 'unknown'; state: string };

/** How the invoice is paid, once it is issued: offset in the statement, to pay with the amount, or credited. `null` for a draft, which has no payment. */
export function settlementOf(invoice: Pick<OwnerInvoiceListItem, 'creditedInFull' | 'payment'>): InvoiceSettlement | null {
  if (invoice.creditedInFull) return { kind: 'credited' };
  if (invoice.payment === null) return null;
  switch (invoice.payment.state) {
    case 'offset':
      return { kind: 'offset' };
    case 'to_pay':
      return { kind: 'toPay', amountDue: invoice.payment.amountDue };
    case 'credited':
      return { kind: 'credited' };
    default:
      return { kind: 'unknown', state: invoice.payment.state };
  }
}

/** One row of the VAT summary: a rate (and, outside the VAT, the nature code), the taxable amount and the VAT; `tax` is `null` when it cannot be told exactly from what the server sent. */
export interface VatRow {
  rate: number;
  nature: string | null;
  taxable: number;
  tax: number | null;
}

/**
 * The VAT of an invoice by rate, as the server summarizes its stored lines (`FiscalDocumentTotals.SummaryOf`): the taxable amount of a rate is the sum of the nets of its lines, its VAT
 * the sum of the VAT stored on each line; outside the VAT (rate 0) the rows are told apart by their nature code. When a line has no stored VAT the row takes the VAT of the document if
 * it has exactly one taxed rate, and has none (`null`) otherwise: a figure is never worked out here. Sums are made in cents, the highest rate first.
 */
export function vatSummaryOf(lines: readonly OwnerInvoiceLine[], documentVat: number): VatRow[] {
  const groups = new Map<string, { rate: number; nature: string | null; lines: OwnerInvoiceLine[] }>();
  for (const line of lines) {
    const nature = line.vatRatePercent === 0 ? (line.vatNatureCode ?? null) : null;
    const key = `${line.vatRatePercent}|${nature ?? ''}`;
    const group = groups.get(key) ?? { rate: line.vatRatePercent, nature, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  const ordered = [...groups.values()].sort((a, b) => b.rate - a.rate || (a.nature ?? '').localeCompare(b.nature ?? ''));
  const taxedGroups = ordered.filter((group) => group.rate > 0).length;
  return ordered.map((group) => {
    const taxable = group.lines.reduce((sum, line) => sum + toCents(line.totalPrice), 0) / 100;
    if (group.rate === 0) return { rate: group.rate, nature: group.nature, taxable, tax: 0 };
    if (group.lines.every((line) => line.vatAmount !== null)) {
      return { rate: group.rate, nature: group.nature, taxable, tax: group.lines.reduce((sum, line) => sum + toCents(line.vatAmount ?? 0), 0) / 100 };
    }
    return { rate: group.rate, nature: group.nature, taxable, tax: taxedGroups === 1 ? documentVat : null };
  });
}
