import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { getBookingLedger } from '@/api/payment-ledger.api';
import { paymentsApi } from '@/api/payments.api';
import { getManifestEntry, type RouteManifestEntry } from '@/config/route-manifest';
import i18n from '@/i18n/config';
import { PAYMENTS_KEY, useCreatePayment } from '@/queries/use-payments';
import type { PaymentLedgerBooking, PaymentLedgerLine } from '@/types';
import { BookingLedgerSection } from '../booking-ledger-section';

vi.mock('@/api/payment-ledger.api', () => ({ getBookingLedger: vi.fn(), listLedger: vi.fn() }));
vi.mock('@/api/payments.api', () => ({ paymentsApi: { create: vi.fn(), getAll: vi.fn() } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

// The page of the fiscal documents is another task's: what the section is told about it is controlled here, so no assertion depends on whether it has landed.
vi.mock('@/config/route-manifest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/route-manifest')>()),
  getManifestEntry: vi.fn(),
}));

const permissions = { read: true, propertyRead: true };
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (_context: string, permission: string) =>
      permission === 'payment.read' ? permissions.read : permission === 'property.read' ? permissions.propertyRead : true,
  }),
}));

const BOOKING_ID = 'b0c1d2e3-0000-4000-8000-000000000002';

const line = (overrides: Partial<PaymentLedgerLine> = {}): PaymentLedgerLine => ({
  kind: 'Card',
  bookingId: BOOKING_ID,
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
  document: { id: 'd-1', number: '2026/12', kind: 'Invoice', status: 'Issued', paymentState: 'Paid' },
  ...overrides,
});

const ledger = (lines: PaymentLedgerLine[], overrides: Partial<PaymentLedgerBooking> = {}): PaymentLedgerBooking => ({
  bookingId: BOOKING_ID,
  bookingCode: 'ABCDE-FGHJK',
  channel: 'Direct',
  currency: 'EUR',
  lines,
  degraded: false,
  ...overrides,
});

const statusError = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, { status, statusText: '', data: {}, headers: {}, config: {} as never });

let client: QueryClient;

function renderSection() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <BookingLedgerSection bookingId={BOOKING_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const rows = () => within(screen.getByRole('table')).getAllByTestId('payment-ledger-row');

beforeEach(async () => {
  vi.clearAllMocks();
  permissions.read = true;
  permissions.propertyRead = true;
  vi.mocked(getManifestEntry).mockReturnValue(undefined);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('BookingLedgerSection, who may read it (permission rule)', () => {
  it('BookingLedgerSection_WithoutPaymentRead_AsksNothingAndDrawsNothing', async () => {
    permissions.read = false;
    const { container } = renderSection();

    // A read they may not make would be a 403 (and the client would move them away): it is never made, and nothing is said about it.
    expect(container).toBeEmptyDOMElement();
    expect(getBookingLedger).not.toHaveBeenCalled();
    await act(async () => {});
    expect(getBookingLedger).not.toHaveBeenCalled();
  });

  it('BookingLedgerSection_WithPaymentRead_AsksForTheLedgerOfTheBookingAndDrawsItsLines', async () => {
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([line(), line({ paymentId: 'p-2', state: 'ToCollect', providerFee: null, net: null, creditDate: null })]));
    renderSection();

    expect(await screen.findByRole('heading', { name: 'Incassi' })).toBeInTheDocument();
    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(getBookingLedger).toHaveBeenCalledWith(BOOKING_ID);
    expect(within(rows()[0]).getByTestId('payment-ledger-state')).toHaveTextContent('Incassato');
    expect(within(rows()[1]).getByTestId('payment-ledger-state')).toHaveTextContent('Da incassare');
  });
});

describe('BookingLedgerSection, what a failed read says (a read that failed is never "all in order")', () => {
  it('BookingLedgerSection_A500_SaysItCouldNotReadWithARetryAndNeverAnEmptyLedger', async () => {
    vi.mocked(getBookingLedger).mockRejectedValueOnce(statusError(500)).mockResolvedValueOnce(ledger([line()]));
    renderSection();

    expect(await screen.findByRole('alert')).toHaveTextContent('Non riusciamo a leggere gli incassi in questo momento.');
    expect(screen.queryByText('Nessun incasso registrato')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(getBookingLedger).toHaveBeenCalledTimes(2);
  });

  it('BookingLedgerSection_A404_IsNotFoundEvenWhenTheQueryStillHoldsTheOldLines', async () => {
    vi.mocked(getBookingLedger).mockResolvedValueOnce(ledger([line()])).mockRejectedValueOnce(statusError(404));
    renderSection();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // The next read (a payment was recorded somewhere, the booking went out of the reach of the caller) is a 404: the cached lines are not the ledger of a booking that is not found.
    await act(async () => {
      await client.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
    });

    expect(await screen.findByTestId('payment-ledger-not-found')).toHaveTextContent('Non troviamo gli incassi di questa prenotazione.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Incassato')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('BookingLedgerSection_A403_SaysTheCallerMayNotSeeItAndShowsNoAmount', async () => {
    vi.mocked(getBookingLedger).mockRejectedValueOnce(statusError(403));
    renderSection();

    expect(await screen.findByTestId('payment-ledger-forbidden')).toHaveTextContent('Non hai il permesso di vedere gli incassi di questa prenotazione.');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('BookingLedgerSection_AReadAgainThatFails_DoesNotKeepShowingTheOldLinesAsCurrent', async () => {
    vi.mocked(getBookingLedger).mockResolvedValueOnce(ledger([line()])).mockRejectedValueOnce(statusError(500));
    renderSection();
    await waitFor(() => expect(rows()).toHaveLength(1));

    await act(async () => {
      await client.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('Non riusciamo a leggere gli incassi in questo momento.');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('BookingLedgerSection_ABodyThatIsNotALedger_IsAFailedReadAndNotAnEmptyOne', async () => {
    const { UnexpectedApiResponseError } = await import('@/lib/api-errors');
    vi.mocked(getBookingLedger).mockRejectedValueOnce(new UnexpectedApiResponseError('/payment-ledger/bookings/x'));
    renderSection();

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Nessun incasso registrato')).toBeNull();
  });
});

describe('BookingLedgerSection, the notice of a channel that could not be read (UX-09)', () => {
  it('BookingLedgerSection_Degraded_ShowsACalmNoticeAndTheStoredLinesNotAnError', async () => {
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([line({ kind: 'Ota', paymentId: null, collectedBy: 'Channel' })], { degraded: true, channel: 'Airbnb' }));
    renderSection();

    const notice = await screen.findByTestId('payment-ledger-degraded');
    expect(notice).toHaveTextContent('I dettagli del canale non sono disponibili in questo momento');
    // A notice, not an alert: it is not announced at once and it is not an error, and the stored lines are still there.
    expect(notice).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(rows()).toHaveLength(1);
  });

  it('BookingLedgerSection_NotDegraded_HasNoNotice_AsWhenTheChannelConnectorIsOff', async () => {
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([line({ kind: 'Ota', paymentId: null, collectedBy: 'Channel' })]));
    renderSection();

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByTestId('payment-ledger-degraded')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('BookingLedgerSection, no lines and the lines of a booking', () => {
  it('BookingLedgerSection_NoLines_SaysNothingIsRecordedAndNeverThatEverythingIsCollected', async () => {
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([]));
    renderSection();

    expect(await screen.findByText('Nessun incasso registrato')).toBeInTheDocument();
    expect(screen.queryByText(/Da incassare/)).toBeNull();
    expect(screen.queryByText(/^Incassato/)).toBeNull();
  });

  it('BookingLedgerSection_LinesInTwoCurrencies_AreNotAddedUpAndHaveNoTotal', async () => {
    vi.mocked(getBookingLedger).mockResolvedValue(
      ledger([line({ currency: 'EUR', gross: 100 }), line({ paymentId: 'p-2', currency: 'CHF', gross: 50, providerCurrency: null, providerFee: null, net: null })]),
    );
    renderSection();

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(screen.queryByText(/150/)).toBeNull();
    expect(screen.queryByText(/totale/i)).toBeNull();
  });

  it('BookingLedgerSection_RecordedPayment_ReadsTheLedgerAgainWhenThePaymentsAreMarkedStale', async () => {
    vi.mocked(getBookingLedger).mockResolvedValueOnce(ledger([line()])).mockResolvedValueOnce(ledger([line(), line({ paymentId: 'p-2', kind: 'Cash', collectedBy: 'Host', providerFee: null, net: null, creditDate: null, document: null })]));
    renderSection();
    await waitFor(() => expect(rows()).toHaveLength(1));

    // What `useCreatePayment` does when "Registra incasso" succeeds, and what a refund and the changes of a booking do too.
    await act(async () => {
      await client.invalidateQueries({ queryKey: [PAYMENTS_KEY] });
    });

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(getBookingLedger).toHaveBeenCalledTimes(2);
    expect(within(rows()[1]).getByTestId('payment-ledger-source')).toHaveTextContent('Contanti');
  });

  it('BookingLedgerSection_RegistraIncassoSucceeds_TheLedgerIsReadAgainAndShowsTheNewLine', async () => {
    // The mutation behind the button is the real one (`useCreatePayment`): what it marks stale on success is what refreshes the ledger.
    function RecordPaymentButton() {
      const create = useCreatePayment();
      return (
        <button type="button" onClick={() => create.mutate({ bookingId: BOOKING_ID, amount: 50, method: 'CashOnArrival', idempotencyKey: 'k-1' } as never)}>
          record
        </button>
      );
    }
    vi.mocked(paymentsApi.create).mockResolvedValue({ id: 'p-2' } as never);
    vi.mocked(getBookingLedger)
      .mockResolvedValueOnce(ledger([line()]))
      .mockResolvedValueOnce(ledger([line(), line({ paymentId: 'p-2', kind: 'Cash', collectedBy: 'Host', providerFee: null, net: null, creditDate: null, document: null })]));
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <BookingLedgerSection bookingId={BOOKING_ID} />
          <RecordPaymentButton />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(rows()).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'record' }));

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(paymentsApi.create).toHaveBeenCalledTimes(1);
    expect(getBookingLedger).toHaveBeenCalledTimes(2);
  });

  it('BookingLedgerSection_TheLedgerIsNotKeptOnceTheSectionIsGone', async () => {
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([line()]));
    const view = renderSection();
    await waitFor(() => expect(rows()).toHaveLength(1));

    view.unmount();

    // The amounts of a booking do not stay in the browser's memory after the booking is left (and are asked again when it is opened).
    await waitFor(() => expect(client.getQueryCache().getAll()).toHaveLength(0));
  });
});

describe('BookingLedgerSection, the link to the document', () => {
  const entry = { path: '/app/short-rent/fiscal/documents', context: 'short-rent', requiredPermissions: [] } as unknown as RouteManifestEntry;

  it('BookingLedgerSection_ThePageOfTheDocumentsExists_LinksTheDocument', async () => {
    vi.mocked(getManifestEntry).mockReturnValue(entry);
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([line()]));
    renderSection();

    // The same line is drawn twice (the table and the card of a phone): both link the document.
    const links = await screen.findAllByTestId('payment-ledger-document-link');
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute('href', '/app/short-rent/fiscal/documents');
  });

  it('BookingLedgerSection_TheCallerLacksWhatThePageOfTheDocumentsAsks_TheDocumentIsToldInWordsWithNoLink', async () => {
    vi.mocked(getManifestEntry).mockReturnValue({ ...entry, requiredPermissions: ['property.read', 'payment.read'] } as RouteManifestEntry);
    permissions.propertyRead = false;
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([line()]));
    renderSection();

    await waitFor(() => expect(rows()).toHaveLength(1));
    // They would be turned away from that page: the link is not drawn, the document is still told.
    expect(screen.queryByTestId('payment-ledger-document-link')).toBeNull();
    expect(within(rows()[0]).getByTestId('payment-ledger-document')).toHaveTextContent('Fattura n. 2026/12');
  });

  it('BookingLedgerSection_ThereIsNoPageOfTheDocuments_TheDocumentIsToldInWordsWithNoDeadLink', async () => {
    vi.mocked(getBookingLedger).mockResolvedValue(ledger([line()]));
    renderSection();

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(screen.queryByTestId('payment-ledger-document-link')).toBeNull();
    expect(within(rows()[0]).getByTestId('payment-ledger-document')).toHaveTextContent('Fattura n. 2026/12');
    expect(within(rows()[0]).getByTestId('payment-ledger-document-state')).toHaveTextContent('Emessa · Incassata');
  });
});
