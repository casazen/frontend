import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import i18n from '@/i18n/config';
import type { TouristTaxComuneSummary, TouristTaxRemittance, TouristTaxSummary } from '@/types';
import { ComuneSummaryTable } from '../comune-summary-table';

const REMITTANCE: TouristTaxRemittance = {
  id: 'r-1',
  comune: 'Milano',
  periodFrom: '2026-07-01',
  periodTo: '2026-09-30',
  amount: 18,
  amountCents: 1800,
  paidOn: '2026-10-05',
  reference: 'RAV 0042',
  notes: null,
  hasReceipt: true,
};

const WITHOUT_RECEIPT: TouristTaxRemittance = { ...REMITTANCE, id: 'r-2', amount: 5, amountCents: 500, reference: null, hasReceipt: false };

/** Milano: 30 EUR recorded on three stays, one more stay with no tax recorded, 18 EUR paid. */
const MILANO: TouristTaxComuneSummary = {
  comune: 'Milano',
  stays: 4,
  nights: 9,
  guests: 8,
  owed: 30,
  owedCents: 3000,
  staysWithoutAmount: 1,
  paid: 23,
  paidCents: 2300,
  balance: 7,
  balanceCents: 700,
  status: 'ToPay',
  remittances: [REMITTANCE, WITHOUT_RECEIPT],
};

/** Como: nothing recorded on its only stay and nothing paid. */
const COMO: TouristTaxComuneSummary = {
  comune: 'Como',
  stays: 1,
  nights: 2,
  guests: 2,
  owed: 0,
  owedCents: 0,
  staysWithoutAmount: 1,
  paid: 0,
  paidCents: 0,
  balance: 0,
  balanceCents: 0,
  status: 'NothingOwed',
  remittances: [],
};

/** Lecco: owed and paid are the same, every stay has its tax. */
const LECCO: TouristTaxComuneSummary = {
  comune: 'Lecco',
  stays: 2,
  nights: 4,
  guests: 4,
  owed: 12,
  owedCents: 1200,
  staysWithoutAmount: 0,
  paid: 12,
  paidCents: 1200,
  balance: 0,
  balanceCents: 0,
  status: 'Paid',
  remittances: [],
};

const SUMMARY: TouristTaxSummary = {
  title: 'Tassa di soggiorno per comune',
  basis: 'recorded',
  currency: 'EUR',
  paymentsHidden: false,
  period: { from: '2026-07-01', to: '2026-09-30' },
  comuni: [MILANO, COMO, LECCO],
  total: {
    stays: 7,
    nights: 15,
    guests: 14,
    owed: 42,
    owedCents: 4200,
    staysWithoutAmount: 2,
    paid: 35,
    paidCents: 3500,
    balance: 7,
    balanceCents: 700,
  },
};

/** What a caller who reaches only some of the properties gets: the owed side, and nothing about the payments. */
const HIDDEN: TouristTaxSummary = {
  ...SUMMARY,
  paymentsHidden: true,
  comuni: [MILANO, COMO, LECCO].map((row) => ({
    ...row,
    paid: null,
    paidCents: null,
    balance: null,
    balanceCents: null,
    status: null,
    remittances: null,
  })),
  total: { ...SUMMARY.total, paid: null, paidCents: null, balance: null, balanceCents: null },
};

function renderTable(summary: TouristTaxSummary, canWrite: boolean) {
  const handlers = { onRecord: vi.fn(), onDownloadReceipt: vi.fn(), onDeleteRemittance: vi.fn() };
  render(<ComuneSummaryTable summary={summary} canWrite={canWrite} downloadingId={null} {...handlers} />);
  return handlers;
}

const rowOf = (comune: string) => screen.getAllByTestId('tourist-tax-row').find((row) => within(row).queryByText(comune) !== null)!;

describe('ComuneSummaryTable (NF-100)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
  });

  it('Table_Comuni_ShowTheFiguresOfTheServerAndTheStateInWords', () => {
    renderTable(SUMMARY, true);

    const milano = rowOf('Milano');
    // Every figure is the one the server sent, in whole cents: 30 owed, 23 paid, 7 left.
    expect(within(milano).getByText(/30,00\s*€/)).toBeInTheDocument();
    expect(within(milano).getByText(/23,00\s*€/)).toBeInTheDocument();
    expect(within(milano).getByText(/7,00\s*€/)).toBeInTheDocument();
    expect(within(milano).getByTestId('tourist-tax-status')).toHaveTextContent(/^Da versare$/);
    expect(within(rowOf('Como')).getByTestId('tourist-tax-status')).toHaveTextContent(/^Nessun importo registrato$/);
    expect(within(rowOf('Lecco')).getByTestId('tourist-tax-status')).toHaveTextContent(/^Versata$/);

    const total = screen.getByTestId('tourist-tax-total');
    expect(within(total).getByText(/42,00\s*€/)).toBeInTheDocument();
    expect(within(total).getByText(/35,00\s*€/)).toBeInTheDocument();
  });

  it('Table_StaysWithoutAnAmount_AreNeverShownAsZeroTax', () => {
    renderTable(SUMMARY, true);

    // Next to the owed amount and next to the state of every comune that counts such stays, and in the total.
    expect(within(rowOf('Milano')).getAllByTestId('tourist-tax-incomplete')).toHaveLength(2);
    expect(within(rowOf('Como')).getAllByTestId('tourist-tax-incomplete')).toHaveLength(2);
    expect(within(rowOf('Lecco')).queryByTestId('tourist-tax-incomplete')).toBeNull();
    expect(within(screen.getByTestId('tourist-tax-total')).getAllByTestId('tourist-tax-incomplete')).toHaveLength(1);
    expect(screen.getAllByText('Importo incompleto').length).toBeGreaterThan(0);
  });

  it('Table_ColumnsAndRows_HaveHeadersForScreenReaders', () => {
    renderTable(SUMMARY, true);

    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Comune',
      'Soggiorni',
      'Dovuta',
      'Versata',
      'Saldo',
      'Stato',
      'Azioni',
    ]);
    expect(screen.getAllByRole('rowheader').map((header) => header.textContent)).toEqual(['Milano', 'Como', 'Lecco', 'Totale']);
  });

  it('Table_WhoMayWritePayments_GetsTheButtonOfEachComuneAndOfEachPayment', () => {
    const handlers = renderTable(SUMMARY, true);

    fireEvent.click(screen.getByRole('button', { name: 'Registra versamento: Como' }));
    expect(handlers.onRecord).toHaveBeenCalledWith(COMO);
    expect(screen.getAllByTestId('tourist-tax-record')).toHaveLength(3);

    fireEvent.click(screen.getAllByTestId('tourist-tax-delete')[0]);
    expect(handlers.onDeleteRemittance).toHaveBeenCalledWith(REMITTANCE);
    expect(screen.getAllByTestId('tourist-tax-delete')).toHaveLength(2);
  });

  it('Table_WhoMayOnlyRead_SeesThePaymentsAndTheReceiptsButCannotRecordOrDelete', () => {
    const handlers = renderTable(SUMMARY, false);

    expect(screen.queryByTestId('tourist-tax-record')).toBeNull();
    expect(screen.queryByTestId('tourist-tax-delete')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Azioni' })).toBeNull();

    // The payments are listed, the one with a receipt offers it and the other says it has none.
    expect(screen.getAllByTestId('tourist-tax-remittance')).toHaveLength(2);
    expect(screen.getByTestId('tourist-tax-no-receipt')).toHaveTextContent('Nessuna ricevuta');
    fireEvent.click(screen.getByTestId('tourist-tax-receipt'));
    expect(handlers.onDownloadReceipt).toHaveBeenCalledWith(REMITTANCE);
  });

  it('Table_CallerWhoReachesSomePropertiesOnly_SeesWhatIsOwedAndNoPaymentAtAll', () => {
    renderTable(HIDDEN, true);

    // Owed side alone: no paid, balance or state, no payments, and no way to record or delete one, whatever the permission says.
    expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Comune', 'Soggiorni', 'Dovuta']);
    expect(screen.queryByTestId('tourist-tax-status')).toBeNull();
    expect(screen.queryByTestId('tourist-tax-remittances')).toBeNull();
    expect(screen.queryByTestId('tourist-tax-record')).toBeNull();
    expect(screen.queryByTestId('tourist-tax-delete')).toBeNull();
    expect(screen.queryByTestId('tourist-tax-receipt')).toBeNull();
    expect(within(rowOf('Milano')).getByText(/30,00\s*€/)).toBeInTheDocument();
    // A stay with no amount is still said apart.
    expect(within(rowOf('Milano')).getAllByTestId('tourist-tax-incomplete')).toHaveLength(1);
  });
});
