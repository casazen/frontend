import { createElement } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import type { SupplierServiceRequestDetail } from '@/types/service-request';
import { SupplierRequestDetailPage } from '../supplier-request-detail-page';
import { emptyQuoteForm, payloadOf, problemsOf, totalCentsOf, type QuoteForm } from '../requests/quote-form';
import { actionsOf } from '../requests/request-model';

const supplierApi = vi.hoisted(() => ({ fetchSupplierInboxItem: vi.fn(), fetchSupplierProfile: vi.fn() }));
const requestsApi = vi.hoisted(() => ({
  takeServiceRequest: vi.fn(),
  sendServiceRequestQuote: vi.fn(),
  withdrawServiceRequestQuote: vi.fn(),
  requestServiceRequestPayment: vi.fn(),
  recordOfflineServiceRequestPayment: vi.fn(),
}));

vi.mock('@/services/supplier-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/supplier-api')>()),
  ...supplierApi,
}));
vi.mock('@/api/service-requests.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/service-requests.api')>()),
  ...requestsApi,
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

/** A new request with no price (a service on quote): the supplier answers it with a quote. */
const NEW_REQUEST: SupplierServiceRequestDetail = {
  id: ID,
  rentalContext: 'ShortRent',
  status: 'Richiesto',
  phase: 'to_answer',
  category: 'cleaning',
  urgency: 'Normal',
  notes: null,
  createdAt: '2026-10-01T08:00:00Z',
  updatedAt: '2026-10-01T08:00:00Z',
  propertyId: null,
  propertyName: null,
  city: 'Roma',
  postalCode: '00184',
  address: null,
  scheduledFor: '2026-10-12',
  scheduledStart: '2026-10-12T08:00:00Z',
  scheduledEnd: '2026-10-12T10:00:00Z',
  stay: null,
  contactDisclosed: false,
  hostContact: null,
  source: 'casazen',
  clientName: 'Zen Stays',
  price: {},
  history: [{ status: 'Richiesto', at: '2026-10-01T08:00:00Z', actor: 'Host', actorName: null, reason: null }],
};

/** The same request after the supplier sent the quote: it waits for the customer, who has until nobody says (a host). */
const QUOTE_PENDING: SupplierServiceRequestDetail = {
  ...NEW_REQUEST,
  phase: 'quote_pending',
  quote: {
    sentAt: '2026-10-02T10:00:00.000Z',
    lines: [
      { label: 'Manodopera', amountCents: 8050 },
      { label: 'Materiali', amountCents: 2000 },
    ],
    totalCents: 10050,
    note: 'Materiali inclusi',
    scheduledStart: null,
    scheduledEnd: null,
    answerBy: null,
  },
  history: [
    ...NEW_REQUEST.history,
    { status: 'Richiesto', at: '2026-10-02T10:00:00Z', actor: 'Supplier', actorName: 'Mario Rossi', reason: null, event: 'quote_sent' },
  ],
};

/** A completed job paid inside CasaZen, with the figures the server gave (the commission is NOT 10 % of the gross: nothing is worked out here). */
const COMPLETED_ONLINE: SupplierServiceRequestDetail = {
  ...NEW_REQUEST,
  status: 'Completato',
  phase: 'completed',
  paymentMode: 'Online',
  contactDisclosed: true,
  price: {
    amountCents: 10050,
    quotedAmountCents: 10050,
    finalAmountCents: 10050,
    basis: 'final',
    lines: [
      { kind: 'quote', label: 'Manodopera', amountCents: 8050 },
      { kind: 'quote', label: 'Materiali', amountCents: 2000 },
    ],
  },
  payment: {
    status: 'Requested',
    amountCents: 10050,
    commissionPercent: 10,
    commissionCents: 1234,
    netCents: 8816,
    sentCount: 2,
    lastSentAt: '2026-10-10T09:00:00Z',
    canRequest: true,
    canRecordOffline: true,
  },
};

function renderPage({ onlinePayments = false }: { onlinePayments?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, supplierOnlinePayments: onlinePayments }, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[`/app/supplier/inbox/${ID}`]}>
            <Routes>
              <Route path="/app/supplier/inbox/:id" element={<SupplierRequestDetailPage />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
}

function filled(rows: [string, string][], patch: Partial<QuoteForm> = {}): QuoteForm {
  const form = emptyQuoteForm();
  return { ...form, ...patch, rows: rows.map(([label, amount], index) => ({ key: `row-${index}`, label, amount })) };
}

describe('the quote of the supplier (SP-04b, SP-08d): what is sent', () => {
  it('QuoteForm_EurosTypedByThePerson_GoAsExactCentsAndTheTotalIsTheirSum', () => {
    const form = filled([
      ['  Manodopera ', '80,50'],
      ['Materiali', '1.200'],
      ['Trasporto', '0,05'],
    ]);
    form.note = '  Materiali inclusi ';

    expect(totalCentsOf(form.rows)).toBe(8050 + 120000 + 5);
    expect(payloadOf(form, 120)).toEqual({
      lines: [
        { label: 'Manodopera', amountCents: 8050 },
        { label: 'Materiali', amountCents: 120000 },
        { label: 'Trasporto', amountCents: 5 },
      ],
      note: 'Materiali inclusi',
    });
  });

  it('QuoteForm_AnotherTime_GoesAsUtcFromTheRomeClockWithTheDurationOfTheRequest', () => {
    // 9:30 in Rome on 14 October 2026 is summer time (UTC+2).
    const form = filled([['Manodopera', '80']], { otherTime: true, day: '2026-10-14', time: '09:30' });

    expect(payloadOf(form, 120)).toMatchObject({ scheduledStartUtc: '2026-10-14T07:30:00.000Z', scheduledEndUtc: '2026-10-14T09:30:00.000Z' });
    expect(payloadOf(form, null)).toMatchObject({ scheduledStartUtc: '2026-10-14T07:30:00.000Z' });
    expect(payloadOf(form, null)).not.toHaveProperty('scheduledEndUtc');
    expect(payloadOf({ ...form, otherTime: false }, 120)).not.toHaveProperty('scheduledStartUtc');
  });

  it('QuoteForm_WhatTheServerWouldRefuse_IsStoppedBeforeSending', () => {
    expect(problemsOf(filled([['Manodopera', '80,50']])).valid).toBe(true);
    // A line with no description, no amount, a word, zero or more than 100,000 euros.
    for (const [label, amount] of [['', '10'], ['Voce', ''], ['Voce', 'abc'], ['Voce', '0'], ['Voce', '100.000,01']] as [string, string][]) {
      expect(problemsOf(filled([[label, amount]])).valid, `${label}|${amount}`).toBe(false);
    }
    // Lines that are fine one by one but add up to more than the API takes.
    const tooMuch = problemsOf(filled([['A', '60000'], ['B', '60000']]));
    expect(tooMuch.total).toBe('totalRange');
    expect(tooMuch.valid).toBe(false);
    // 21 lines, and none.
    expect(problemsOf(filled(Array.from({ length: 21 }, (_, index) => [`Voce ${index}`, '1'] as [string, string]))).valid).toBe(false);
    expect(problemsOf({ ...emptyQuoteForm(), rows: [] }).valid).toBe(false);
    expect(problemsOf(filled(Array.from({ length: 20 }, (_, index) => [`Voce ${index}`, '1'] as [string, string]))).valid).toBe(true);
    // Another time needs a day and an hour, and the hour must exist (it is skipped when summer time starts: 28 March 2027, 02:30).
    expect(problemsOf(filled([['A', '1']], { otherTime: true, day: '2026-10-14', time: '' })).time).toBe('timeRequired');
    expect(problemsOf(filled([['A', '1']], { otherTime: true, day: '2027-03-28', time: '02:30' })).time).toBe('timeInvalid');
  });

  it('RequestPlan_EachPhase_OffersTheRightThingsAndPaymentActionsFollowTheServerAndTheFlag', () => {
    const unpriced = { phase: 'to_answer', status: 'Richiesto' as const, price: {} };
    expect(actionsOf(unpriced)).toEqual({ primary: 'quote', secondary: 'take', more: ['reject'] });
    expect(actionsOf({ ...unpriced, price: { amountCents: 5000 } })).toEqual({ primary: 'take', secondary: 'reject', more: ['quote'] });
    expect(actionsOf({ phase: 'quote_pending', status: 'Richiesto' })).toEqual({ more: ['editQuote', 'withdrawQuote'] });

    const completed = { phase: 'completed', status: 'Completato' as const, payment: { canRequest: true, canRecordOffline: true } };
    expect(actionsOf(completed, { onlinePayments: true }).more).toEqual(['remindPayment', 'recordPayment']);
    // The reminder is the server's word AND the flag; the payment received outside CasaZen is the server's word only.
    expect(actionsOf(completed, { onlinePayments: false }).more).toEqual(['recordPayment']);
    expect(actionsOf({ ...completed, payment: { canRequest: false, canRecordOffline: true } }, { onlinePayments: true }).more).toEqual(['recordPayment']);
    expect(actionsOf({ ...completed, payment: { canRequest: false, canRecordOffline: false } }, { onlinePayments: true }).more).toEqual([]);
  });
});

describe('SupplierRequestDetailPage: quote and payment (SP-04b, SP-08d)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(NEW_REQUEST);
    supplierApi.fetchSupplierProfile.mockResolvedValue({ status: 'Active' });
    requestsApi.sendServiceRequestQuote.mockResolvedValue({});
    requestsApi.withdrawServiceRequestQuote.mockResolvedValue({});
    requestsApi.requestServiceRequestPayment.mockResolvedValue(undefined);
    requestsApi.recordOfflineServiceRequestPayment.mockResolvedValue(undefined);
    await i18n.changeLanguage('it');
  });

  it('SupplierRequestDetailPage_NewRequestWithoutPrice_SendsTheQuoteInCentsAndWaitsForTheCustomer', async () => {
    supplierApi.fetchSupplierInboxItem.mockResolvedValueOnce(NEW_REQUEST).mockResolvedValue(QUOTE_PENDING);
    renderPage();

    // The quote comes first, and accepting without one stays one tap away.
    fireEvent.click(await screen.findByTestId('supplier-request-quote'));
    expect(screen.getByTestId('supplier-request-take')).toHaveTextContent('Accetta senza preventivo');
    const sheet = await screen.findByTestId('quote-sheet');

    // Nothing is sent while the sheet is incomplete.
    fireEvent.click(within(sheet).getByTestId('quote-submit'));
    expect(await within(sheet).findByText('Scrivi che cosa comprende la voce.')).toBeInTheDocument();
    expect(requestsApi.sendServiceRequestQuote).not.toHaveBeenCalled();

    fireEvent.change(within(sheet).getByTestId('quote-line-label'), { target: { value: 'Manodopera' } });
    fireEvent.change(within(sheet).getByTestId('quote-line-amount'), { target: { value: '80,50' } });
    fireEvent.click(within(sheet).getByTestId('quote-line-add'));
    const [, secondLabel] = within(sheet).getAllByTestId('quote-line-label');
    const [, secondAmount] = within(sheet).getAllByTestId('quote-line-amount');
    fireEvent.change(secondLabel, { target: { value: 'Materiali' } });
    fireEvent.change(secondAmount, { target: { value: '20' } });
    fireEvent.change(within(sheet).getByTestId('quote-note'), { target: { value: 'Materiali inclusi' } });
    expect(within(sheet).getByTestId('quote-total')).toHaveTextContent('100,50 €');
    // The time stays the one of the request, and the sheet says it is not held for the customer.
    expect(within(sheet).getByTestId('quote-same-time')).toHaveTextContent('Resta l’orario della richiesta');

    fireEvent.click(within(sheet).getByTestId('quote-submit'));

    await waitFor(() =>
      expect(requestsApi.sendServiceRequestQuote).toHaveBeenCalledWith(ID, {
        lines: [
          { label: 'Manodopera', amountCents: 8050 },
          { label: 'Materiali', amountCents: 2000 },
        ],
        note: 'Materiali inclusi',
      }),
    );
    // The request is read again: it waits for the customer, with the quote in front of the supplier and nothing to accept any more.
    await waitFor(() => expect(screen.getByTestId('supplier-request-now')).toHaveTextContent('Aspetta la risposta del cliente'));
    expect(screen.queryByTestId('quote-sheet')).not.toBeInTheDocument();
    expect(screen.getByTestId('supplier-request-quote-total')).toHaveTextContent('100,50 €');
    expect(screen.queryByTestId('supplier-request-take')).not.toBeInTheDocument();
  });

  it('SupplierRequestDetailPage_QuoteWaiting_CanBeChangedFromWhatWasSentOrTakenBack', async () => {
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(QUOTE_PENDING);
    renderPage();

    const now = await screen.findByTestId('supplier-request-now');
    expect(now).toHaveTextContent('Aspetta la risposta del cliente');
    expect(screen.getByTestId('supplier-request-quote-deadline')).toHaveTextContent('non c’è un termine');
    expect(screen.getByTestId('supplier-request-history')).toHaveTextContent('Hai inviato un preventivo');
    expect(screen.getByTestId('supplier-request-price')).toHaveTextContent('100,50 €');

    // Changing it opens the sheet with the quote that was sent; the new one replaces it.
    fireEvent.click(screen.getByTestId('supplier-request-edit-quote'));
    const sheet = await screen.findByTestId('quote-sheet');
    expect(within(sheet).getAllByTestId('quote-line-label').map((input) => (input as HTMLInputElement).value)).toEqual(['Manodopera', 'Materiali']);
    expect(within(sheet).getAllByTestId('quote-line-amount').map((input) => (input as HTMLInputElement).value)).toEqual(['80,50', '20']);
    fireEvent.change(within(sheet).getAllByTestId('quote-line-amount')[1], { target: { value: '25' } });
    fireEvent.click(within(sheet).getByTestId('quote-submit'));
    await waitFor(() =>
      expect(requestsApi.sendServiceRequestQuote).toHaveBeenCalledWith(ID, {
        lines: [
          { label: 'Manodopera', amountCents: 8050 },
          { label: 'Materiali', amountCents: 2500 },
        ],
        note: 'Materiali inclusi',
      }),
    );
    await waitFor(() => expect(screen.queryByTestId('quote-sheet')).not.toBeInTheDocument());

    // Taking it back asks first, and says that nobody is told.
    fireEvent.click(screen.getByTestId('supplier-request-withdraw-quote'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Il cliente non riceve nessun messaggio');
    expect(requestsApi.withdrawServiceRequestQuote).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ritira il preventivo' }));
    await waitFor(() => expect(requestsApi.withdrawServiceRequestQuote).toHaveBeenCalledWith(ID));
  });

  it('SupplierRequestDetailPage_PaymentReceivedOutsideCasaZen_NeedsAReasonOnlyForAJobPaidInCasaZen', async () => {
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(COMPLETED_ONLINE);
    const { unmount } = renderPage();

    fireEvent.click(await screen.findByTestId('supplier-request-record-payment'));
    let dialog = await screen.findByRole('dialog');
    // What follows is written before it is done, and the reason is required for a request paid inside CasaZen.
    expect(dialog).toHaveTextContent('nessuna commissione');
    expect(dialog).toHaveTextContent('Non si può annullare');
    const confirm = within(dialog).getByRole('button', { name: 'Registra l’incasso' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('record-payment-reason'), { target: { value: '   ' } });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('record-payment-reason'), { target: { value: '  Bonifico del cliente  ' } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(requestsApi.recordOfflineServiceRequestPayment).toHaveBeenCalledWith(ID, 'Bonifico del cliente'));
    unmount();

    // A request that is paid outside CasaZen anyway needs no reason.
    requestsApi.recordOfflineServiceRequestPayment.mockClear();
    supplierApi.fetchSupplierInboxItem.mockResolvedValue({ ...COMPLETED_ONLINE, paymentMode: 'Manual' });
    renderPage();
    fireEvent.click(await screen.findByTestId('supplier-request-record-payment'));
    dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registra l’incasso' }));
    await waitFor(() => expect(requestsApi.recordOfflineServiceRequestPayment).toHaveBeenCalledWith(ID, undefined));
  });

  it('SupplierRequestDetailPage_ReminderForThePayment_ExistsOnlyWithTheFlagAndTheServersWord', async () => {
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(COMPLETED_ONLINE);
    const { unmount } = renderPage({ onlinePayments: false });

    // Online payments off: the supplier can still say it was paid outside CasaZen, and nothing else.
    await screen.findByTestId('supplier-request-record-payment');
    expect(screen.queryByTestId('supplier-request-remind-payment')).not.toBeInTheDocument();
    unmount();

    renderPage({ onlinePayments: true });
    expect(await screen.findByTestId('supplier-request-now')).toHaveTextContent('Puoi inviarne una al giorno');
    fireEvent.click(await screen.findByTestId('supplier-request-remind-payment'));
    await waitFor(() => expect(requestsApi.requestServiceRequestPayment).toHaveBeenCalledWith(ID));
  });

  it('SupplierRequestDetailPage_PaymentPanel_ShowsTheFiguresOfTheServerAsTheyCome', async () => {
    supplierApi.fetchSupplierInboxItem.mockResolvedValue(COMPLETED_ONLINE);
    renderPage();

    await screen.findByTestId('supplier-request-detail');
    // 12.34 is not 10 % of 100.50: the commission and the net are the server's, never worked out in the page.
    expect(screen.getByTestId('supplier-request-payment-amount')).toHaveTextContent('100,50 €');
    expect(screen.getByTestId('supplier-request-payment-commission')).toHaveTextContent('12,34 € (10 %)');
    expect(screen.getByTestId('supplier-request-payment-net')).toHaveTextContent('88,16 €');
    expect(screen.getByTestId('supplier-request-payment-state')).toHaveTextContent('Richiesto al cliente');
    expect(screen.getByTestId('supplier-request-payment-how')).toHaveTextContent('Online, con CasaZen');
    expect(screen.getByTestId('supplier-request-payment-reminders')).toHaveTextContent('2 inviati · l’ultimo il 10 ottobre');
    expect(screen.getByTestId('supplier-request-price-lines')).toHaveTextContent('Manodopera');
    expect(screen.getByTestId('supplier-request-price-lines')).toHaveTextContent('80,50 €');
  });
});
