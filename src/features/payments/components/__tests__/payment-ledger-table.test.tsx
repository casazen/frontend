import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Wallet } from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PaymentLedgerLine } from '@/types';
import { PaymentLedgerTable } from '../payment-ledger-table';

const BOOKING = 'b0c1d2e3-0000-4000-8000-000000000002';

const line = (overrides: Partial<PaymentLedgerLine> = {}): PaymentLedgerLine => ({
  kind: 'Card',
  bookingId: BOOKING,
  bookingCode: 'ABCDE-FGHJK',
  paymentId: 'p-1',
  date: '2026-11-05',
  gross: 100,
  providerFee: 3.2,
  net: 96.8,
  providerCurrency: 'EUR',
  creditDate: '2026-11-08',
  currency: 'EUR',
  state: 'Paid',
  collectedBy: 'Platform',
  document: { id: 'd-1', number: '2026/12', kind: 'Invoice', status: 'Issued', paymentState: 'ToCollect' },
  ...overrides,
});

function renderTable(lines: PaymentLedgerLine[], props: Partial<React.ComponentProps<typeof PaymentLedgerTable>> = {}) {
  return render(
    <MemoryRouter>
      <PaymentLedgerTable lines={lines} label="Incassi della prenotazione" {...props} />
    </MemoryRouter>,
  );
}

/** The rows of the table (the same rows are also drawn as cards for a phone: the table is the one with roles). */
const rowsOf = () => within(screen.getByRole('table', { name: 'Incassi della prenotazione' })).getAllByTestId('payment-ledger-row');
const cell = (row: HTMLElement, id: string) => within(row).getByTestId(`payment-ledger-${id}`);

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('PaymentLedgerTable, the amounts (money rules)', () => {
  it('PaymentLedgerTable_ACardLine_ShowsGrossCommissionNetAndCreditDateAsTheServerSentThem', () => {
    renderTable([line()]);

    const [row] = rowsOf();
    expect(cell(row, 'gross')).toHaveTextContent(/^100,00\s€$/);
    // The commission is a deduction: it is written with a minus; the net is the figure of the server.
    expect(cell(row, 'fee')).toHaveTextContent(/^-3,20\s€$/);
    expect(cell(row, 'net')).toHaveTextContent(/^96,80\s€$/);
    expect(cell(row, 'credit')).toHaveTextContent('8 nov 2026');
    expect(cell(row, 'source')).toHaveTextContent('Carta');
    expect(cell(row, 'date')).toHaveTextContent('5 nov 2026');
  });

  it('PaymentLedgerTable_LinesInTwoCurrencies_AreEachInTheirOwnCurrencyAndNothingIsAddedUp', () => {
    renderTable([line({ gross: 100, currency: 'EUR', providerCurrency: 'EUR' }), line({ paymentId: 'p-2', gross: 200, currency: 'CHF', providerCurrency: null, providerFee: 6, net: 194 })]);

    const [euro, francs] = rowsOf();
    expect(cell(euro, 'gross')).toHaveTextContent(/€/);
    expect(cell(euro, 'gross')).not.toHaveTextContent(/CHF/);
    expect(cell(francs, 'gross')).toHaveTextContent(/^200,00\sCHF$/);
    // The fee and the net of a line without a currency of the provider are in the currency of the line.
    expect(cell(francs, 'fee')).toHaveTextContent(/^-6,00\sCHF$/);
    expect(cell(francs, 'net')).toHaveTextContent(/^194,00\sCHF$/);
    expect(francs).not.toHaveTextContent('€');
    // No row has a total, and no figure of the table is the sum of two lines.
    expect(screen.queryByText(/300/)).toBeNull();
    expect(screen.getByRole('table').querySelector('tfoot')).toBeNull();
  });

  it('PaymentLedgerTable_TheProviderBalanceInAnotherCurrency_IsShownBesideTheGrossAndNeverConverted', () => {
    renderTable([line({ gross: 100, currency: 'CHF', providerFee: 1.2, net: 94.8, providerCurrency: 'EUR' })]);

    const [row] = rowsOf();
    expect(cell(row, 'gross')).toHaveTextContent(/^100,00\sCHF$/);
    expect(cell(row, 'fee')).toHaveTextContent(/^-1,20\s€$/);
    expect(cell(row, 'net')).toHaveTextContent(/^94,80\s€$/);
  });

  it('PaymentLedgerTable_FiguresTheServerDidNotGive_AreADashAndNeverAZero', () => {
    renderTable([line({ providerFee: null, net: undefined, creditDate: null, providerCurrency: null })]);

    const [row] = rowsOf();
    for (const id of ['fee', 'net', 'credit']) {
      expect(cell(row, id)).toHaveAttribute('data-missing', 'true');
      expect(cell(row, id)).toHaveTextContent('Non disponibile');
      expect(cell(row, id)).not.toHaveTextContent('0');
    }
  });

  it('PaymentLedgerTable_AFeeOfZero_IsARealZeroWithoutAMinus', () => {
    renderTable([line({ providerFee: 0, net: 100 })]);

    const [row] = rowsOf();
    expect(cell(row, 'fee')).toHaveTextContent(/^0,00\s€$/);
    expect(cell(row, 'fee')).not.toHaveAttribute('data-missing');
  });

  it('PaymentLedgerTable_English_WritesTheAmountsAndTheWordsInEnglish', async () => {
    await i18n.changeLanguage('en');
    renderTable([line()], { label: 'Incassi della prenotazione' });

    const [row] = rowsOf();
    expect(cell(row, 'gross')).toHaveTextContent('€100.00');
    expect(cell(row, 'fee')).toHaveTextContent('-€3.20');
    expect(cell(row, 'source')).toHaveTextContent('Card');
    expect(within(row).getByTestId('payment-ledger-state')).toHaveTextContent('Collected');
    expect(within(row).getByTestId('payment-ledger-document-state')).toHaveTextContent('Issued · To collect');
  });
});

describe('PaymentLedgerTable, the state of each line (money rule: nothing that is not completed is shown as collected)', () => {
  const stateOf = (row: HTMLElement) => within(row).getByTestId('payment-ledger-state');

  it('PaymentLedgerTable_EveryState_IsSaidInWordsAndOnlyAPaidLineIsCollected', () => {
    renderTable([
      line({ paymentId: 'a', state: 'Paid' }),
      line({ paymentId: 'b', state: 'ToCollect', providerFee: null, net: null, creditDate: null }),
      line({ paymentId: 'c', state: 'Refunded' }),
      line({ paymentId: 'd', state: 'PartiallyRefunded' }),
      line({ paymentId: 'e', state: 'Failed' }),
      line({ paymentId: 'f', state: 'Canceled' }),
    ]);

    const states = rowsOf().map((row) => [stateOf(row).getAttribute('data-state'), stateOf(row).textContent]);
    expect(states).toEqual([
      ['Paid', 'Incassato'],
      ['ToCollect', 'Da incassare'],
      ['Refunded', 'Rimborsato'],
      ['PartiallyRefunded', 'Rimborsato in parte'],
      ['Failed', 'Non riuscito'],
      ['Canceled', 'Annullato'],
    ]);
    // Each state has an icon besides its word: it is never told by color alone.
    for (const row of rowsOf()) expect(stateOf(row).querySelector('svg')).not.toBeNull();
  });

  it('PaymentLedgerTable_AStateTheClientDoesNotKnow_IsShownAsItCameAndNeverAsCollected', () => {
    renderTable([line({ state: 'AwaitingBank' as never })]);

    const [row] = rowsOf();
    expect(stateOf(row)).toHaveTextContent('AwaitingBank');
    expect(stateOf(row)).not.toHaveTextContent('Incassato');
  });

  it('PaymentLedgerTable_AChannelLine_SaysCollectedByTheChannelOnlyWhenItIsCollected', () => {
    renderTable([
      line({ kind: 'Ota', paymentId: null, collectedBy: 'Channel', state: 'Paid', providerFee: 15, net: 85, providerCurrency: null }),
      line({ kind: 'Ota', paymentId: null, collectedBy: 'Channel', state: 'ToCollect', providerFee: null, net: null, creditDate: null }),
      line({ kind: 'Ota', paymentId: null, collectedBy: 'Host', state: 'ToCollect', providerFee: null, net: null, creditDate: null }),
    ]);

    const [paid, toCollect, host] = rowsOf();
    expect(cell(paid, 'source')).toHaveTextContent('Incassato dal canale');
    expect(stateOf(paid)).toHaveTextContent('Incassato');
    // A line still to collect never says collected, not in its source either.
    expect(cell(toCollect, 'source')).toHaveTextContent('Dal canale');
    expect(cell(toCollect, 'source')).not.toHaveTextContent('Incassato');
    expect(stateOf(toCollect)).toHaveTextContent('Da incassare');
    expect(cell(host, 'source')).toHaveTextContent('Dal canale, incassi tu');
  });

  it('PaymentLedgerTable_CardCashAndBankTransfer_HaveTheirWordsAndAKindTheClientDoesNotKnowIsShownAsItCame', () => {
    renderTable([
      line({ paymentId: 'a', kind: 'Cash', collectedBy: 'Host' }),
      line({ paymentId: 'b', kind: 'BankTransfer', collectedBy: 'Host' }),
      line({ paymentId: 'c', kind: 'Other', collectedBy: 'Host' }),
      line({ paymentId: 'd', kind: 'Voucher' as never }),
    ]);

    expect(rowsOf().map((row) => cell(row, 'source').textContent)).toEqual(['Contanti', 'Bonifico', 'Altro metodo', 'Voucher']);
  });
});

describe('PaymentLedgerTable, the document of the booking', () => {
  it('PaymentLedgerTable_ADocument_IsToldWithItsNumberItsStatusAndItsCollectionState', () => {
    renderTable([line()]);

    const [row] = rowsOf();
    const document = within(row).getByTestId('payment-ledger-document');
    expect(document).toHaveTextContent('Fattura n. 2026/12');
    expect(within(row).getByTestId('payment-ledger-document-state')).toHaveTextContent('Emessa · Da incassare');
    // The page of the documents is not offered here: the document is told in words and is no link.
    expect(within(document).queryByRole('link')).toBeNull();
  });

  it('PaymentLedgerTable_APageOfTheDocuments_MakesTheDocumentALink', () => {
    renderTable([line()], { documentHref: '/app/short-rent/fiscal/documents' });

    const link = within(rowsOf()[0]).getByTestId('payment-ledger-document-link');
    expect(link).toHaveAttribute('href', '/app/short-rent/fiscal/documents');
    expect(link).toHaveTextContent('Fattura n. 2026/12');
  });

  it('PaymentLedgerTable_ADraftWithNoNumberAndACodeTheClientDoesNotKnow_AreToldAsTheyAre', () => {
    renderTable([
      line({ paymentId: 'a', document: { id: 'd-2', number: null, kind: 'Receipt', status: 'Draft', paymentState: 'Unknown' } }),
      line({ paymentId: 'b', document: { id: 'd-3', kind: 'Hologram', status: 'Sealed', paymentState: 'Paid' } }),
    ]);

    const [draft, odd] = rowsOf();
    expect(within(draft).getByTestId('payment-ledger-document')).toHaveTextContent('Ricevuta');
    expect(within(draft).getByTestId('payment-ledger-document')).not.toHaveTextContent('n.');
    expect(within(draft).getByTestId('payment-ledger-document-state')).toHaveTextContent('Bozza · Incasso non noto');
    expect(within(odd).getByTestId('payment-ledger-document')).toHaveTextContent('Hologram');
    expect(within(odd).getByTestId('payment-ledger-document-state')).toHaveTextContent('Sealed · Incassata');
  });

  it('PaymentLedgerTable_NoDocument_SaysSoAndIsNotALinkOrABlankCell', () => {
    renderTable([line({ document: null })]);

    const none = within(rowsOf()[0]).getByTestId('payment-ledger-document-none');
    expect(none).toHaveTextContent('Nessun documento');
  });
});

describe('PaymentLedgerTable, the booking and the states of the list', () => {
  it('PaymentLedgerTable_ForAPeriod_EveryLineLinksItsBooking', () => {
    renderTable([line()], { showBooking: true });

    const link = within(rowsOf()[0]).getByTestId('payment-ledger-booking');
    expect(link).toHaveTextContent('ABCDE-FGHJK');
    expect(link).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING}`);
  });

  it('PaymentLedgerTable_ForOneBooking_HasNoColumnOfBookings', () => {
    renderTable([line()]);

    expect(within(rowsOf()[0]).queryByTestId('payment-ledger-booking')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Prenotazione' })).toBeNull();
  });

  it('PaymentLedgerTable_AFailedRead_SaysSoWithARetryAndShowsNoRowAndNothingInOrder', () => {
    const retry = vi.fn();
    renderTable([], { isError: true, errorTitle: 'Non riusciamo a leggere gli incassi in questo momento.', onRetry: retry });

    expect(screen.getByRole('alert')).toHaveTextContent('Non riusciamo a leggere gli incassi in questo momento.');
    expect(screen.queryByText('Nessun incasso registrato')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('PaymentLedgerTable_NoLines_SaysThereIsNothingToShowAndNeverThatEverythingIsCollected', () => {
    renderTable([], { empty: { icon: Wallet, title: 'Nessun incasso registrato', description: 'Qui compaiono gli incassi.' } });

    expect(screen.getByText('Nessun incasso registrato')).toBeInTheDocument();
    expect(screen.queryByText(/Incassato/)).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('PaymentLedgerTable_WhileItIsRead_ShowsAPlaceholderNotAnEmptyLedger', () => {
    renderTable([], { isLoading: true });

    expect(screen.getAllByRole('status').length).toBeGreaterThan(0);
    expect(screen.queryByText('Nessun incasso registrato')).toBeNull();
  });

  it('PaymentLedgerTable_RowsBeingReadAgain_StayAndSayTheyAreBusy', () => {
    renderTable([line()], { isRefreshing: true });

    expect(screen.getByTestId('payment-ledger-table')).toHaveAttribute('aria-busy', 'true');
    expect(rowsOf()).toHaveLength(1);
  });

  it('PaymentLedgerTable_OnAPhone_EveryLineIsACardWithTheSameFigures', () => {
    renderTable([line()]);

    const card = screen.getByTestId('payment-ledger-card');
    expect(within(card).getByTestId('payment-ledger-gross')).toHaveTextContent(/^100,00\s€$/);
    expect(within(card).getByTestId('payment-ledger-fee')).toHaveTextContent(/^-3,20\s€$/);
    expect(within(card).getByTestId('payment-ledger-net')).toHaveTextContent(/^96,80\s€$/);
    expect(within(card).getByTestId('payment-ledger-state')).toHaveTextContent('Incassato');
  });
});
