import type { OwnerPortalInvoice, OwnerPortalStatement, OwnerPortalStatementDetail, OwnerPortalStatementLine } from '@/types';

/**
 * The statements and the invoices of the property manager as the owner portal reads them (E13/F02/US02/T01), for the tests of the accounting pages. The figures are distinct, so that a
 * page that draws a wrong one is found out, and they add up as the ledger does.
 */

/** A statement in francs: 1800 - 270 - 216 - 79.50 = 1234.50. */
export const CHF_STATEMENT: OwnerPortalStatement = {
  statementId: 'st-chf',
  agencyId: 'ag-1',
  agencyName: 'Agenzia del Lago',
  year: 2026,
  month: 10,
  version: 1,
  currency: 'CHF',
  publishedAt: '2026-11-02T09:00:00Z',
  superseded: false,
  supersededByStatementId: null,
  hasPdf: true,
  totals: { gross: 1800, channelFees: -270, withholding: 0, commission: -216, charges: -79.5, corrections: 0, net: 1234.5, payments: 0, openingBalance: 0, closingBalance: 1234.5 },
};

/** The statement of the month before, in euros: 1300 - 195 - 104 - 13.35 = 987.65. */
export const EUR_STATEMENT: OwnerPortalStatement = {
  ...CHF_STATEMENT,
  statementId: 'st-eur',
  month: 9,
  currency: 'EUR',
  totals: { gross: 1300, channelFees: -195, withholding: 0, commission: -104, charges: -13.35, corrections: 0, net: 987.65, payments: 0, openingBalance: 0, closingBalance: 987.65 },
};

export const CHF_INVOICE: OwnerPortalInvoice = {
  invoiceId: 'inv-chf',
  agencyId: 'ag-1',
  agencyName: 'Agenzia del Lago',
  number: '2026/0042',
  issueDate: '2026-11-05',
  kind: 'Invoice',
  total: 233.25,
  currency: 'CHF',
  periodYear: 2026,
  periodMonth: 10,
  statementId: 'st-chf',
  creditedInFull: false,
};

export const EUR_INVOICE: OwnerPortalInvoice = {
  ...CHF_INVOICE,
  invoiceId: 'inv-eur',
  number: '2026/0031',
  issueDate: '2026-10-05',
  total: 77.7,
  currency: 'EUR',
  periodMonth: 9,
  statementId: 'st-eur',
};

/** One line of a statement: a stay of the property «Casa Lago», told by its days, its channel and its booking code, never by a guest. */
export function statementLine(id: string, overrides: Partial<OwnerPortalStatementLine> = {}): OwnerPortalStatementLine {
  return {
    id,
    type: 'BookingRevenue',
    date: '2026-10-14',
    checkIn: '2026-10-10',
    checkOut: '2026-10-14',
    property: 'Casa Lago',
    channel: 'Airbnb',
    bookingCode: 'BK-1001',
    kind: null,
    description: null,
    sharePercent: 100,
    amount: 1800,
    reversal: false,
    channelFeeRechargedByAgency: false,
    ...overrides,
  };
}

/** The lines of a statement grouped as in its PDF, with the tourist tax of the one stay and the invoice of the manager. */
export function statementDetail(statement: OwnerPortalStatement, overrides: Partial<OwnerPortalStatementDetail> = {}): OwnerPortalStatementDetail {
  return {
    statement,
    ownerName: 'Anna Verdi',
    ownerInvoiceNumber: '2026/0042',
    ownerInvoiceDate: '2026-11-05',
    entriesSha256: 'a'.repeat(64),
    sections: [
      { section: 'stays', total: 1800, lines: [statementLine('l1')] },
      { section: 'channelFees', total: -270, lines: [statementLine('l2', { type: 'ChannelFee', amount: -270 })] },
      { section: 'withholding', total: 0, lines: [] },
      { section: 'commission', total: -216, lines: [statementLine('l3', { type: 'AgencyCommission', amount: -216 })] },
      {
        section: 'recharges',
        total: -79.5,
        lines: [
          statementLine('l4', { type: 'OwnerCharge', checkIn: null, checkOut: null, property: null, channel: null, bookingCode: null, kind: 'cleaning', description: 'Pulizie finali di ottobre', amount: -79.5 }),
        ],
      },
      { section: 'corrections', total: 0, lines: [] },
      { section: 'payments', total: 0, lines: [] },
    ],
    touristTax: [{ property: 'Casa Lago', checkIn: '2026-10-10', checkOut: '2026-10-14', channel: 'Airbnb', bookingCode: 'BK-1001', currency: 'CHF', amount: 8 }],
    ...overrides,
  };
}
