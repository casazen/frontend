import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { paymentsApi } from '@/api/payments.api';
import type { PaymentListItem } from '@/types';
import { PaymentsPage } from '../payments-page';

vi.mock('@/api/payments.api', () => ({ paymentsApi: { getAll: vi.fn() } }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn(), dismiss: vi.fn() }),
  Toaster: () => null,
}));
vi.mock('@/hooks/use-list-views-scope', () => ({ useListViewsScope: () => ({ userId: 'auth0|tester', context: 'short-rent' }) }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/features/bookings/components/bookings-section-tabs', () => ({ BookingsSectionTabs: () => null }));

/** Today in these tests (Europe/Rome): 1 November 2026. */
const NOW = new Date('2026-11-01T10:00:00Z');

function payment(overrides: Partial<PaymentListItem>): PaymentListItem {
  return {
    id: 'p-0',
    bookingId: 'b-0',
    bookingCode: 'ABCDE-FGHJK',
    propertyId: 'prop-1',
    propertyName: 'Casa Mare',
    guestName: 'Nessuno',
    amount: 100,
    amountCents: 10000,
    refundedAmount: 0,
    refundedAmountCents: 0,
    currency: 'EUR',
    status: 'Completed',
    method: 'CreditCard',
    description: 'Soggiorno',
    transactionId: 'tx-0',
    stripePaymentIntentId: 'pi_0',
    processedAt: '2026-10-01T10:00:00Z',
    createdAt: '2026-10-01T09:00:00Z',
    bookingCheckIn: '2026-11-03',
    bookingCheckOut: '2026-11-06',
    ...overrides,
  };
}

const ON_ARRIVAL = { method: 'CashOnArrival', transactionId: '', stripePaymentIntentId: null, processedAt: null } as const;

const COMING_PAID = payment({ id: 'a', guestName: 'Anna Futura', status: 'Completed', bookingCheckIn: '2026-11-03', bookingCheckOut: '2026-11-06' });
const COMING_WAITING = payment({ id: 'b', guestName: 'Bruno Presto', status: 'Pending', bookingCheckIn: '2026-11-04', bookingCheckOut: '2026-11-05', ...ON_ARRIVAL });
const ON_NOW = payment({ id: 'c', guestName: 'Carla Oggi', status: 'Pending', bookingCheckIn: '2026-10-29', bookingCheckOut: '2026-11-01', ...ON_ARRIVAL });
const PAST_PAID = payment({ id: 'd', guestName: 'Dario Passato', status: 'Completed', bookingCheckIn: '2026-10-18', bookingCheckOut: '2026-10-20' });
const PAST_WAITING = payment({ id: 'e', guestName: 'Elena Scaduta', status: 'Pending', bookingCheckIn: '2026-10-21', bookingCheckOut: '2026-10-23', ...ON_ARRIVAL });
const CANCELED = payment({ id: 'f', guestName: 'Fabio Annullato', status: 'Canceled', bookingCheckIn: '2026-12-01', bookingCheckOut: '2026-12-04' });
const REFUNDED = payment({
  id: 'g',
  guestName: 'Gina Rimborsata',
  status: 'Refunded',
  refundedAmount: 100,
  refundedAmountCents: 10000,
  bookingCheckIn: '2026-11-10',
  bookingCheckOut: '2026-11-12',
});

const ALL_ROWS = [COMING_PAID, COMING_WAITING, ON_NOW, PAST_PAID, PAST_WAITING, CANCELED, REFUNDED];
const GUESTS = ALL_ROWS.map((row) => row.guestName);

function Where() {
  return createElement('output', { 'data-testid': 'search' }, useLocation().search);
}

function renderPage(rows: PaymentListItem[], initial = '/app/short-rent/payments') {
  vi.mocked(paymentsApi.getAll).mockResolvedValue(rows);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(
      I18nextProvider,
      { i18n },
      createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [initial] }, createElement(PaymentsPage), createElement(Where))),
    ),
  );
}

/** The guests of the rows in the table, in the order of `GUESTS`. */
async function shownGuests(): Promise<string[]> {
  const table = await screen.findByRole('table', { name: 'Pagamenti' });
  const cells = within(table).getAllByRole('rowheader').map((cell) => cell.textContent ?? '');
  return GUESTS.filter((guest) => cells.some((text) => text.startsWith(guest)));
}

const address = () => screen.getByTestId('search').textContent;

describe('PaymentsPage, the quick filters (SR-04c)', { timeout: 20000 }, () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    window.localStorage.clear();
    window.sessionStorage.clear();
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('PaymentsPage_Opens_OnInArrivoWithTheStaysThatAreComingOrOn', async () => {
    renderPage(ALL_ROWS);

    // The stay that ends today is still on; the past ones, the cancelled and the refunded are not here.
    expect(await shownGuests()).toEqual(['Anna Futura', 'Bruno Presto', 'Carla Oggi']);
    expect(screen.getByTestId('list-chip-incoming')).toHaveAttribute('aria-pressed', 'true');
    // The page opens on it without a word in the address.
    expect(address()).toBe('');
  });

  it('PaymentsPage_Chips_InArrivoFirst_ThenTuttiToCollectCollectedRefundedAndCanceled', async () => {
    renderPage(ALL_ROWS);
    await shownGuests();

    const chips = screen.getAllByTestId(/^list-chip-/).map((chip) => chip.textContent);

    expect(chips).toEqual(['In arrivo', 'Tutti', 'Da incassare', 'Incassati', 'Rimborsati', 'Annullati']);
  });

  it('PaymentsPage_Tutti_ShowsEveryPaymentAndTheAddressSaysIt', async () => {
    renderPage(ALL_ROWS);
    await shownGuests();

    fireEvent.click(screen.getByTestId('list-chip-all'));

    expect(await shownGuests()).toEqual(GUESTS);
    expect(address()).toBe('?chip=all');
  });

  it('PaymentsPage_Annullati_ShowsOnlyThePaymentsCanceledWithTheirBooking', async () => {
    renderPage(ALL_ROWS);
    await shownGuests();

    fireEvent.click(screen.getByTestId('list-chip-canceled'));

    expect(await shownGuests()).toEqual(['Fabio Annullato']);
    expect(address()).toBe('?chip=canceled');
  });

  it('PaymentsPage_DaIncassare_StillHasTheOnesOfAStayThatIsOver', async () => {
    renderPage(ALL_ROWS);
    await shownGuests();

    fireEvent.click(screen.getByTestId('list-chip-toCollect'));

    // «In arrivo» does not have Elena (her stay is over); «Da incassare» does.
    expect(await shownGuests()).toEqual(['Bruno Presto', 'Carla Oggi', 'Elena Scaduta']);
  });

  it('PaymentsPage_AddressWithAChip_KeepsItsView_AndOneWithoutIt_OpensOnInArrivo', async () => {
    renderPage(ALL_ROWS, '/app/short-rent/payments?chip=collected');

    expect(await shownGuests()).toEqual(['Anna Futura', 'Dario Passato']);
  });

  it('PaymentsPage_NothingComingIn_SaysSoAndTheButtonOpensTuttiPagamenti', async () => {
    renderPage([PAST_PAID, CANCELED]);

    expect(await screen.findByText('Nessun incasso in arrivo')).toBeInTheDocument();
    expect(screen.queryByText('Nessun pagamento con questi filtri')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Vedi tutti i pagamenti' }));

    expect(await shownGuests()).toEqual(['Dario Passato', 'Fabio Annullato']);
    expect(address()).toBe('?chip=all');
  });

  it('PaymentsPage_ASearchThatFindsNothing_KeepsTheGenericWords', async () => {
    renderPage(ALL_ROWS, '/app/short-rent/payments?q=zzz');

    expect(await screen.findByText('Nessun pagamento con questi filtri')).toBeInTheDocument();
    expect(screen.queryByText('Nessun incasso in arrivo')).not.toBeInTheDocument();
  });
});
