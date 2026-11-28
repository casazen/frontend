import { toCents } from '@/features/owner-accounting/owner-accounting-model';
import type { OwnerInvoiceLine, OwnerInvoiceListItem } from '@/types';

export const isDraft = (invoice: Pick<OwnerInvoiceListItem, 'status'>): boolean => invoice.status === 'Draft';

export const isIssued = (invoice: Pick<OwnerInvoiceListItem, 'status'>): boolean => invoice.status === 'Issued';

export function liveInvoiceOfVersion(invoices: readonly OwnerInvoiceListItem[], versionId: string): OwnerInvoiceListItem | null {
  return invoices.find((invoice) => invoice.statementVersionId === versionId && !invoice.creditedInFull) ?? null;
}

export function liveInvoiceOfMonth(invoices: readonly OwnerInvoiceListItem[]): OwnerInvoiceListItem | null {
  return invoices.find((invoice) => !invoice.creditedInFull) ?? null;
}

export function creditedInvoicesOfVersion(invoices: readonly OwnerInvoiceListItem[], versionId: string): OwnerInvoiceListItem[] {
  return invoices.filter((invoice) => invoice.statementVersionId === versionId && invoice.creditedInFull);
}

export type InvoiceSettlement =
  | { kind: 'offset' }
  | { kind: 'toPay'; amountDue: number }
  | { kind: 'credited' }
  | { kind: 'unknown'; state: string };

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
