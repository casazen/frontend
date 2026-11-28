import type { AgencySummary } from '@/types';

const QUOKKA = { name: 'Quokka SA', countryCode: 'CH', taxId: 'CHE-123.456.789' };
const COMO = { name: 'Casa Como Srl', countryCode: 'IT', taxId: 'IT01234567890' };

const SWISS_OWNER = 'ab000000-0000-4000-8000-0000000000c1';
const ITALIAN_OWNER = 'ab000000-0000-4000-8000-0000000000e1';

export function emptySummary(overrides: Partial<AgencySummary> = {}): AgencySummary {
  return {
    period: '2026-08',
    periodKind: 'month',
    from: '2026-08-01',
    to: '2026-08-31',
    generatedOn: '2026-09-24',
    ownerAccountingIncluded: true,
    stays: { occupiedNights: 0, availableNights: 0, occupancyRate: null, revenue: 0, stays: 0, revenueNights: 0, adr: null, revPar: null },
    collections: { collected: 0, payments: 0, toCollect: [] },
    guestDocuments: [],
    portalCosts: [],
    touristTax: { italy: { owed: 0, paid: 0, toRemit: 0, staysWithoutAmount: 0 }, switzerland: [] },
    commissions: [],
    ownerInvoices: { counts: [], rates: [] },
    payouts: [],
    wires: [],
    portalCommissionsBorne: [],
    margin: [],
    owners: [],
    ...overrides,
  };
}

/**
 * The summary of an agency with a Swiss house and an Italian one in the same month: documents, commissions, margin, payouts and wires in francs AND in euros, none of them the sum of
 * the other. The figures are chosen so that no sum of a Swiss and an Italian row (1500, 88, 1588, 320, 385, 450, 505.45, 6580...) is written anywhere else in the page.
 */
export function mixedSummary(overrides: Partial<AgencySummary> = {}): AgencySummary {
  return emptySummary({
    guestDocuments: [
      { issuer: QUOKKA, kind: 'invoice', currency: 'CHF', documents: 3, amounts: { taxable: 1000, vat: 38, total: 1038 } },
      { issuer: QUOKKA, kind: 'creditNote', currency: 'CHF', documents: 1, amounts: { taxable: -100, vat: -3.8, total: -103.8 } },
      { issuer: COMO, kind: 'receipt', currency: 'EUR', documents: 2, amounts: { taxable: 500, vat: 50, total: 550 } },
    ],
    commissions: [
      {
        ownerId: SWISS_OWNER,
        ownerName: 'Marta Rossi',
        currency: 'CHF',
        documents: 1,
        commission: { taxable: 200, vat: 16.2, total: 216.2 },
        recharges: { taxable: 50, vat: 4.05, total: 54.05 },
        advancedExpenses: 30,
        invoicedTotal: 300.25,
      },
      {
        ownerId: ITALIAN_OWNER,
        ownerName: 'Luca Bianchi',
        currency: 'EUR',
        documents: 1,
        commission: { taxable: 120, vat: 26.4, total: 146.4 },
        recharges: { taxable: 40, vat: 8.8, total: 48.8 },
        advancedExpenses: 10,
        invoicedTotal: 205.2,
      },
    ],
    ownerInvoices: {
      counts: [
        { currency: 'CHF', invoices: 1, creditNotes: 0 },
        { currency: 'EUR', invoices: 1, creditNotes: 0 },
      ],
      rates: [
        { currency: 'CHF', ratePercent: 8.1, natureCode: null, amounts: { taxable: 200, vat: 16.2, total: 216.2 } },
        { currency: 'EUR', ratePercent: 22, natureCode: null, amounts: { taxable: 120, vat: 26.4, total: 146.4 } },
      ],
    },
    margin: [
      { currency: 'CHF', commissions: 200, recharges: 50, portalCommissionsBorne: 25, margin: 225 },
      { currency: 'EUR', commissions: 120, recharges: 40, portalCommissionsBorne: 0, margin: 160 },
    ],
    payouts: [
      { currency: 'CHF', payouts: 2, gross: 5000, withholding: 0, net: 5000 },
      { currency: 'EUR', payouts: 1, gross: 2000, withholding: 420, net: 1580 },
    ],
    wires: [
      { currency: 'CHF', status: 'generated', batches: 1, transfers: 2, total: 5000 },
      { currency: 'EUR', status: 'paid', batches: 1, transfers: 1, total: 1580 },
    ],
    portalCommissionsBorne: [{ source: 'bookingCom', currency: 'CHF', amount: 25 }],
    collections: {
      collected: 4321.5,
      payments: 7,
      toCollect: [
        { currency: 'CHF', amount: 300, stays: 2 },
        { currency: 'EUR', amount: 150, stays: 1 },
      ],
    },
    touristTax: {
      italy: { owed: 80, paid: 50, toRemit: 30, staysWithoutAmount: 0 },
      switzerland: [{ canton: 'TI', currency: 'CHF', documents: 3, collected: 36 }],
    },
    stays: { occupiedNights: 41, availableNights: 62, occupancyRate: 0.6613, revenue: 2500.5, stays: 6, revenueNights: 41, adr: 61, revPar: 40.33 },
    portalCosts: [
      { source: 'bookingCom', kind: 'channelCommission', stays: 4, gross: 1700, cost: 255, net: 1445, costRate: 0.15 },
      { source: 'direct', kind: 'paymentFee', stays: 2, gross: 800, cost: null, net: null, costRate: null },
      { source: null, kind: null, stays: 6, gross: 2500, cost: 255, net: 1445, costRate: 0.1 },
    ],
    owners: [
      { ownerId: SWISS_OWNER, ownerName: 'Marta Rossi', anonymized: false, properties: 1, revenue: 1700.5, occupiedNights: 20, availableNights: 31, occupancyRate: 0.6452, stays: 3 },
      { ownerId: null, ownerName: null, anonymized: false, properties: 1, revenue: 800, occupiedNights: 21, availableNights: 31, occupancyRate: 0.6774, stays: 3 },
    ],
    ...overrides,
  });
}

/** What every row of the owner accounting says, so that a test can check that none of it is drawn for a caller who may not read it. */
export const OWNER_ACCOUNTING_TABLES = [
  'accountant-owner-invoice-counts',
  'accountant-owner-invoice-rates',
  'accountant-commissions',
  'accountant-margin',
  'accountant-payouts',
  'accountant-wires',
  'accountant-portal-commissions-borne',
  'accountant-owner-performance',
] as const;
