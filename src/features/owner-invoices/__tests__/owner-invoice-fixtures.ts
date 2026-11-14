import { OWNER_ID, VERSION_ID, YEAR, MONTH } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import type { OwnerInvoice, OwnerInvoiceLine, OwnerInvoiceListItem } from '@/types';

export const INVOICE_ID = 'ab000000-0000-4000-8000-000000000001';

/** An invoice of the list: a draft of the month of the statement, in francs, 1000 of commission and 81 of VAT. */
export function listItem(overrides: Partial<OwnerInvoiceListItem> = {}): OwnerInvoiceListItem {
  return {
    id: INVOICE_ID,
    ownerId: OWNER_ID,
    ownerName: 'Marta Rossi',
    periodYear: YEAR,
    periodMonth: MONTH,
    statementVersionId: VERSION_ID,
    number: null,
    issueDate: null,
    status: 'Draft',
    kind: 'Invoice',
    taxableBase: 1000,
    vatAmount: 81,
    stampDuty: 0,
    total: 1081,
    currency: 'CHF',
    creditedInFull: false,
    payment: null,
    ...overrides,
  };
}

/** The same invoice once issued: numbered, dated, and covered by the statement. */
export const issuedItem = (overrides: Partial<OwnerInvoiceListItem> = {}): OwnerInvoiceListItem =>
  listItem({ status: 'Issued', number: 'FPM-2025-0001', issueDate: '2025-02-05', payment: { state: 'offset', amountDue: 0 }, ...overrides });

const line = (overrides: Partial<OwnerInvoiceLine>): OwnerInvoiceLine => ({
  lineNumber: 1,
  type: 'Commission',
  description: 'Provvigione di gennaio · Casa Lago',
  quantity: 1,
  unitPrice: 1000,
  totalPrice: 1000,
  vatRatePercent: 8.1,
  vatNatureCode: null,
  vatAmount: 81,
  ...overrides,
});

/**
 * A draft as the server makes it: a commission of 1000 and a recharge of 100 at 8.1% (VAT 81.00 and 8.10), and 50 of expenses advanced for the owner outside the VAT: 1150 taxable,
 * 89.10 of VAT, 1239.10 in all.
 */
export function draft(overrides: Partial<OwnerInvoice> = {}): OwnerInvoice {
  return {
    id: INVOICE_ID,
    ownerId: OWNER_ID,
    ownerName: 'Marta Rossi',
    statementVersionId: VERSION_ID,
    periodYear: YEAR,
    periodMonth: MONTH,
    kind: 'Invoice',
    status: 'Draft',
    series: 'FPM',
    number: null,
    issueDate: null,
    currency: 'CHF',
    ruleVersion: 'CH@2026.1',
    taxableBase: 1150,
    vatAmount: 89.1,
    stampDuty: 0,
    total: 1239.1,
    hasXml: false,
    creditedInFull: false,
    lines: [
      line({ lineNumber: 1 }),
      line({ lineNumber: 2, type: 'Recharge', description: 'Riaddebito pulizie · 2 soggiorni', unitPrice: 100, totalPrice: 100, vatAmount: 8.1 }),
      line({ lineNumber: 3, type: 'AdvancedExpense', description: 'Spesa anticipata · caldaia', unitPrice: 50, totalPrice: 50, vatRatePercent: 0, vatAmount: 0 }),
    ],
    ...overrides,
  };
}
