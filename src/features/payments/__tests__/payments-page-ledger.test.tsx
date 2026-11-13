import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { listLedger } from '@/api/payment-ledger.api';
import { paymentsApi } from '@/api/payments.api';
import type { PaymentLedgerLine, PaymentLedgerPage } from '@/types';
import { PaymentLedgerPeriod } from '../components/payment-ledger-period';
import { PaymentsPage } from '../payments-page';

vi.mock('@/api/payments.api', () => ({ paymentsApi: { getAll: vi.fn() } }));
vi.mock('@/api/payment-ledger.api', () => ({ getBookingLedger: vi.fn(), listLedger: vi.fn() }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'auth0|tester', context: 'short-rent' }) }));
const permissions = { read: true };
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => (permission === 'payment.read' ? permissions.read : true) }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/features/bookings/components/bookings-section-tabs', () => ({ BookingsSectionTabs: () => null }));

/** Today in these tests (Europe/Rome): 13 November 2026. */
const NOW = new Date('2026-11-13T10:00:00Z');

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
  document: { id: 'd-1', number: '2026/12', kind: 'Invoice', status: 'Issued', paymentState: 'Paid' },
  ...overrides,
});

const answer = (items: PaymentLedgerLine[], totalCount = items.length, page = 1): PaymentLedgerPage => ({ items, totalCount, page, pageSize: 20 });

const statusError = (status: number) =>
  new AxiosError('failed', 'ERR_BAD_RESPONSE', undefined, undefined, { status, statusText: '', data: {}, headers: {}, config: {} as never });

function Where() {
  return createElement('output', { 'data-testid': 'search' }, useLocation().search);
}

function renderPage() {
  vi.mocked(paymentsApi.getAll).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: ['/app/short-rent/payments'] }, createElement(PaymentsPage), createElement(Where))),
  );
}

const openLedger = async () => {
  fireEvent.click(screen.getByTestId('payments-view-ledger'));
  await screen.findByTestId('payment-ledger-period');
};
const rows = () => within(screen.getByRole('table', { name: 'Incassi del periodo' })).getAllByTestId('payment-ledger-row');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  permissions.read = true;
  window.localStorage.clear();
  window.sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('PaymentsPage, the switch between the list and the ledger of a period', () => {
  it('PaymentsPage_Opens_OnTheListAndAsksNothingOfTheLedger', async () => {
    renderPage();

    expect(await screen.findByTestId('payments-list')).toBeInTheDocument();
    expect(screen.getByTestId('payments-view-payments')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('payments-view-ledger')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('payments-view-payments')).toHaveTextContent('Per pagamento');
    expect(screen.getByTestId('payments-view-ledger')).toHaveTextContent('Per prenotazione e periodo');
    expect(listLedger).not.toHaveBeenCalled();
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('PaymentsPage_ByBookingAndPeriod_ShowsTheLedgerOfTheMonthWithTheSameTableAndAsksOnlyThenAndSaysNothingInTheAddress', async () => {
    vi.mocked(listLedger).mockResolvedValue(answer([line(), line({ paymentId: 'p-2', currency: 'CHF', gross: 40, providerCurrency: null, providerFee: null, net: null })]));
    renderPage();
    await screen.findByTestId('payments-list');

    await openLedger();

    await waitFor(() => expect(rows()).toHaveLength(2));
    expect(listLedger).toHaveBeenCalledTimes(1);
    expect(listLedger).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-30' }, 1, 20);
    expect(screen.getByTestId('payments-view-ledger')).toHaveAttribute('aria-pressed', 'true');
    // The list and the numbers of the month are not on screen: one thing to look at.
    expect(screen.queryByTestId('payments-list')).toBeNull();
    expect(screen.queryByTestId('payments-summary')).toBeNull();
    // The booking of each line is a link; each amount is in its own currency; nothing is added up.
    expect(within(rows()[0]).getByTestId('payment-ledger-booking')).toHaveAttribute('href', `/app/short-rent/bookings/${BOOKING}`);
    expect(within(rows()[0]).getByTestId('payment-ledger-gross')).toHaveTextContent(/^100,00\s€$/);
    expect(within(rows()[1]).getByTestId('payment-ledger-gross')).toHaveTextContent(/^40,00\sCHF$/);
    expect(screen.queryByText(/140/)).toBeNull();
    // Data rule: the choice and the days are in the screen, not in the address and not in the storage of the browser.
    expect(screen.getByTestId('search').textContent).toBe('');
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (let index = 0; index < storage.length; index += 1) {
        const value = storage.getItem(storage.key(index) as string) ?? '';
        expect(value).not.toContain('ABCDE-FGHJK');
        expect(value).not.toContain('payment-ledger');
        expect(value).not.toContain('2026-11-30');
      }
    }
  });

  it('PaymentsPage_BackToTheList_ShowsTheListAgain', async () => {
    vi.mocked(listLedger).mockResolvedValue(answer([line()]));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();
    await waitFor(() => expect(rows()).toHaveLength(1));

    fireEvent.click(screen.getByTestId('payments-view-payments'));

    expect(await screen.findByTestId('payments-list')).toBeInTheDocument();
    expect(screen.queryByTestId('payment-ledger-period')).toBeNull();
  });
});

describe('PaymentLedgerPeriod, the days and the pages', () => {
  it('PaymentLedgerPeriod_MoreLinesThanAPage_IsPagedAndSaysHowManyThereAre', async () => {
    vi.mocked(listLedger).mockResolvedValueOnce(answer([line()], 45, 1)).mockResolvedValueOnce(answer([line({ paymentId: 'p-21' })], 45, 2));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();

    expect(await screen.findByTestId('payment-ledger-count')).toHaveTextContent('45 righe nel periodo');
    expect(screen.getByText('Pagina 1 di 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Successiva/ }));

    await waitFor(() => expect(listLedger).toHaveBeenLastCalledWith({ from: '2026-11-01', to: '2026-11-30' }, 2, 20));
    expect(await screen.findByText('Pagina 2 di 3')).toBeInTheDocument();
  });

  it('PaymentLedgerPeriod_AnotherPeriod_IsAskedForFromTheFirstPage', async () => {
    vi.mocked(listLedger).mockResolvedValue(answer([line()], 45, 1));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();
    await screen.findByText('Pagina 1 di 3');
    fireEvent.click(screen.getByRole('button', { name: /Successiva/ }));
    await screen.findByText('Pagina 2 di 3');

    fireEvent.change(screen.getByTestId('payment-ledger-from'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByTestId('payment-ledger-to'), { target: { value: '2026-10-31' } });

    await waitFor(() => expect(listLedger).toHaveBeenLastCalledWith({ from: '2026-10-01', to: '2026-10-31' }, 1, 20));
    expect(await screen.findByText('Pagina 1 di 3')).toBeInTheDocument();
  });

  it('PaymentLedgerPeriod_TheFirstDayAfterTheLast_SaysSoAndAsksNothingAndShowsNothingOfTheEarlierPeriod', async () => {
    vi.mocked(listLedger).mockResolvedValue(answer([line()]));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();
    await waitFor(() => expect(rows()).toHaveLength(1));
    const asked = vi.mocked(listLedger).mock.calls.length;

    fireEvent.change(screen.getByTestId('payment-ledger-from'), { target: { value: '2026-12-05' } });

    expect(await screen.findByRole('alert')).toHaveTextContent('La data di inizio è dopo quella di fine.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('Nessuna riga nel periodo')).toBeNull();
    expect(listLedger).toHaveBeenCalledTimes(asked);
  });

  it('PaymentLedgerPeriod_ADayLeftOut_AsksNothingBecauseTheServerWouldReadTheWholeHistory', async () => {
    vi.mocked(listLedger).mockResolvedValue(answer([line()]));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();
    await waitFor(() => expect(rows()).toHaveLength(1));
    const asked = vi.mocked(listLedger).mock.calls.length;

    fireEvent.change(screen.getByTestId('payment-ledger-to'), { target: { value: '' } });

    expect(await screen.findByTestId('payment-ledger-period-problem')).toHaveTextContent('Scegli il primo e l’ultimo giorno del periodo.');
    expect(screen.queryByRole('table')).toBeNull();
    expect(listLedger).toHaveBeenCalledTimes(asked);
  });
});

describe('PaymentLedgerPeriod, what a failed read and an empty period say', () => {
  it('PaymentLedgerPeriod_AFailedRead_SaysSoWithARetryAndIsNeverAnEmptyPeriod', async () => {
    vi.mocked(listLedger).mockRejectedValueOnce(statusError(500)).mockResolvedValueOnce(answer([line()]));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();

    expect(await screen.findByRole('alert')).toHaveTextContent('Non riusciamo a leggere gli incassi del periodo in questo momento.');
    expect(screen.queryByText('Nessuna riga nel periodo')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    await waitFor(() => expect(rows()).toHaveLength(1));
  });

  it('PaymentLedgerPeriod_APeriodWithNoLines_SaysThereAreNoLinesAndNotThatEverythingIsCollected', async () => {
    vi.mocked(listLedger).mockResolvedValue(answer([], 0));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();

    expect(await screen.findByText('Nessuna riga nel periodo')).toBeInTheDocument();
    expect(screen.queryByText(/Incassato/)).toBeNull();
    expect(screen.queryByTestId('payment-ledger-count')).toBeNull();
  });

  it('PaymentLedgerPeriod_APageThePeriodNoLongerHas_GoesToTheLastPageThatHasLines', async () => {
    vi.mocked(listLedger).mockResolvedValueOnce(answer([line()], 45, 1)).mockResolvedValueOnce(answer([line({ paymentId: 'p-2' })], 45, 2));
    renderPage();
    await screen.findByTestId('payments-list');
    await openLedger();
    await screen.findByText('Pagina 1 di 3');
    fireEvent.click(screen.getByRole('button', { name: /Successiva/ }));
    await screen.findByText('Pagina 2 di 3');
    // The lines went down while the page was open: page 2 is empty, and the total says there are lines.
    vi.mocked(listLedger).mockResolvedValueOnce(answer([], 25, 3)).mockResolvedValue(answer([line({ paymentId: 'p-last' })], 25, 2));

    fireEvent.click(screen.getByRole('button', { name: /Successiva/ }));

    await waitFor(() => expect(listLedger).toHaveBeenLastCalledWith({ from: '2026-11-01', to: '2026-11-30' }, 2, 20));
    expect(await screen.findByText('Pagina 2 di 2')).toBeInTheDocument();
  });
});

describe('PaymentLedgerPeriod, who may read it (permission rule)', () => {
  it('PaymentLedgerPeriod_WithoutPaymentRead_AsksNothing', async () => {
    permissions.read = false;
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(PaymentLedgerPeriod))));

    await act(async () => {});
    expect(listLedger).not.toHaveBeenCalled();
    // Nothing is said about money either: no table, no "empty period", no error.
    expect(container).toBeEmptyDOMElement();
  });
});
