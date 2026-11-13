import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { saveBlobAs } from '@/lib/file-download';
import { freezeClock, LATE_EVENING_UTC, NOON_UTC } from '@/test/clock';
import type { BalancesToCollectReport, CollectionsReport } from '@/types';
import { CollectionsReportPage } from '../collections-report-page';

// The page with the real hooks and tables: only the HTTP layer, the permissions, the list of properties, the saving of a file and the
// frame of the app are replaced. What is under test is what the page does with what the server sends: it shows it as it is, says each
// state in words (never a zero for what is not available), asks for nothing it may not, and never mixes two currencies.
const granted = vi.hoisted(() => new Set<string>());

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => granted.has(`${context}:${permission}`) }),
}));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({
    data: [
      { id: 'p-1', name: 'Villa del Lago' },
      { id: 'p-2', name: 'Casa in centro' },
    ],
  }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));

const get = vi.mocked(axios.get);
const save = vi.mocked(saveBlobAs);

const UNAVAILABLE_CREDITS: CollectionsReport['credits'] = {
  stripe: { available: false, payouts: [], cardPaymentCount: 0, paymentsWithoutFigures: 0 },
  channels: { available: false, reportedBy: 'channelManager', rows: [], staysWithoutNet: 0 },
};

/** 1.234,56 EUR over three days, by two payment methods and two channels; the credits are not stored. */
const COLLECTIONS: CollectionsReport = {
  title: 'Incassato per data, per cassa, dal 01/09/2026 al 30/09/2026',
  basis: 'cash',
  period: { from: '2026-09-01', to: '2026-09-30', nights: 30 },
  total: { amount: 1234.56, amountCents: 123456, paymentCount: 3 },
  byDate: [
    { unit: 'day', label: '2026-09-01', from: '2026-09-01', to: '2026-09-01', amount: 1000, amountCents: 100000, paymentCount: 2 },
    { unit: 'day', label: '2026-09-02', from: '2026-09-02', to: '2026-09-02', amount: 234.56, amountCents: 23456, paymentCount: 1 },
    { unit: 'day', label: '2026-09-03', from: '2026-09-03', to: '2026-09-03', amount: 0, amountCents: 0, paymentCount: 0 },
  ],
  byMethod: [
    { method: 'CreditCard', amount: 1000, amountCents: 100000, paymentCount: 2, share: 0.8101 },
    { method: 'BankTransfer', amount: 234.56, amountCents: 23456, paymentCount: 1, share: 0.19 },
  ],
  byChannel: [
    { source: 'Direct', amount: 1000, amountCents: 100000, paymentCount: 2, share: 0.8101 },
    { source: 'Airbnb', amount: 234.56, amountCents: 23456, paymentCount: 1, share: 0.19 },
  ],
  credits: UNAVAILABLE_CREDITS,
};

const NOTHING_TO_COLLECT: BalancesToCollectReport = { title: 'Saldi da incassare', basis: 'balances', asOf: '2026-09-24', since: '2024-09-24', rows: [], totals: [] };

function balanceRow(overrides: Partial<BalancesToCollectReport['rows'][number]>): BalancesToCollectReport['rows'][number] {
  return {
    bookingId: 'b-1',
    bookingCode: 'ABCDE-FGHIJ',
    propertyId: 'p-1',
    propertyName: 'Villa del Lago',
    source: 'Direct',
    checkIn: '2026-09-10',
    checkOut: '2026-09-15',
    currency: 'EUR',
    total: 500,
    totalCents: 50000,
    collected: 200,
    collectedCents: 20000,
    toCollect: 300,
    toCollectCents: 30000,
    overdue: true,
    basis: 'Payments',
    ...overrides,
  };
}

type Answer = unknown | (() => unknown);

/** What the server answers to each of the reads of the page; a function is asked at every call. */
interface Server {
  collections: Answer;
  balances: Answer;
  file?: (format: string) => Promise<unknown>;
}

function serve(server: Server) {
  const answer = (value: Answer) => (typeof value === 'function' ? (value as () => unknown)() : value);
  get.mockImplementation((url: string, config?: { params?: { format?: string } }) => {
    if (config?.params?.format) return (server.file ?? (() => Promise.reject(new Error('no file served'))))(config.params.format) as never;
    const body = answer(url === '/reports/collections' ? server.collections : server.balances);
    return (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)) as never;
  });
}

const ok = (data: unknown) => ({ status: 200, data });

function failure(status: number, body: unknown = {}, asBlob = false): AxiosError {
  const data = asBlob ? new Blob([JSON.stringify(body)], { type: 'application/problem+json' }) : body;
  return new AxiosError('failed', undefined, undefined, undefined, { status, statusText: '', data, headers: {}, config: { headers: new AxiosHeaders() } });
}

function renderPage(initialPath = '/app/short-rent/reports/collections') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, { initialEntries: [initialPath] }, createElement(CollectionsReportPage)),
    ),
  );
  return { client, ...view };
}

/** The calls of the page to one of the reads. */
const callsTo = (url: string) => get.mock.calls.filter(([called, config]) => called === url && !(config as { params?: { format?: string } } | undefined)?.params?.format);

describe('CollectionsReportPage (NF-97)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    granted.clear();
    granted.add('short-rent:payment.read');
    // 24 September 2026 is "today" in Rome in these tests: the page opens on September.
    freezeClock(NOON_UTC);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // Money: the total, every amount and every share are the server's, written as they are; every cut shows the server's total.
  it('Page_Collections_ShowsTheServerTotalAndTheThreeViewsOfTheSameData', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();

    expect(await screen.findByTestId('collections-total-amount')).toHaveTextContent(/1\.?234,56 €/);
    expect(screen.getByTestId('collections-total-count')).toHaveTextContent('3 pagamenti');
    expect(callsTo('/reports/collections')[0]![1]).toMatchObject({ params: { from: '2026-09-01', to: '2026-09-30' } });

    // By date: a row for each bucket of the server, a day without payments a real zero, and the server's total under them.
    const byDate = screen.getByTestId('collections-by-date');
    expect(within(byDate).getAllByTestId('collections-by-date-row')).toHaveLength(3);
    expect(within(byDate).getByTestId('collections-by-date-total')).toHaveTextContent(/1\.?234,56 €/);
    expect(within(byDate).getAllByTestId('collections-by-date-row')[2]).toHaveTextContent('0,00 €');

    // By method: the amount, the payments and the share the server gives.
    fireEvent.click(screen.getByTestId('collections-view-method'));
    const byMethod = await screen.findByTestId('collections-by-method');
    const [card, transfer] = within(byMethod).getAllByTestId('collections-by-method-row');
    expect(card).toHaveTextContent('Carta');
    expect(card).toHaveTextContent(/1\.?000,00 €/);
    expect(card).toHaveTextContent('81,01%');
    expect(transfer).toHaveTextContent('Bonifico bancario');
    expect(transfer).toHaveTextContent('19%');
    expect(within(byMethod).getByTestId('collections-by-method-total')).toHaveTextContent(/1\.?234,56 €/);

    // By channel.
    fireEvent.click(screen.getByTestId('collections-view-channel'));
    const byChannel = await screen.findByTestId('collections-by-channel');
    expect(within(byChannel).getAllByTestId('collections-by-channel-row')[1]).toHaveTextContent('Airbnb');
    expect(within(byChannel).getByTestId('collections-by-channel-total')).toHaveTextContent(/1\.?234,56 €/);
  });

  it('Page_ShareThatTheServerDoesNotHave_IsNotAvailableNeverZero', async () => {
    const noShare = { ...COLLECTIONS, byMethod: [{ ...COLLECTIONS.byMethod[0]!, share: null }] };
    serve({ collections: ok(noShare), balances: ok(NOTHING_TO_COLLECT) });
    renderPage('/app/short-rent/reports/collections?vista=method');

    const row = await screen.findByTestId('collections-by-method-row');

    expect(row).toHaveTextContent('Non disponibile');
    expect(row).not.toHaveTextContent('0%');
  });

  it('Page_PeriodWithoutPayments_SaysSoInsteadOfAWallOfZeros', async () => {
    const empty: CollectionsReport = { ...COLLECTIONS, total: { amount: 0, amountCents: 0, paymentCount: 0 }, byMethod: [], byChannel: [] };
    serve({ collections: ok(empty), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();

    expect(await screen.findByTestId('collections-empty')).toHaveTextContent('Nessun incasso nel periodo scelto.');
    expect(screen.queryByTestId('collections-by-date')).toBeNull();
  });

  // Permission: without payment.read the page asks the server for nothing at all, and says so.
  it('Page_WithoutPaymentRead_AsksTheServerForNothing', async () => {
    granted.clear();
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();

    expect(await screen.findByTestId('collections-no-access')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByTestId('collections-export-csv')).toBeNull();
  });

  // Permission: a 403 is said in the page; it is not a report with nothing in it and not the page of the missing access.
  it('Page_403_SaysTheReportIsNotOpenToThePersonOnceAndShowsNoFigure', async () => {
    serve({ collections: { status: 403, data: {} }, balances: { status: 403, data: {} } });
    // The API turns a 403 into `null`; here the whole stack runs, so the mock answers what axios would resolve with.
    renderPage();

    expect(await screen.findByTestId('collections-forbidden')).toHaveTextContent('Non hai accesso a questo report.');
    expect(screen.queryByTestId('collections-balances-state-forbidden')).toBeNull();
    expect(screen.queryByTestId('collections-total')).toBeNull();
    expect(screen.queryByTestId('collections-balances')).toBeNull();
  });

  // Trust: a 404 (a property that is not the person's) is "not found", also when the cache still holds the old figures of the same read.
  it('Page_404AfterFigures_IsNotFoundAndTheOldFiguresGoAway', async () => {
    let answer: unknown = ok(COLLECTIONS);
    serve({ collections: () => answer, balances: ok(NOTHING_TO_COLLECT) });
    const { client } = renderPage();
    expect(await screen.findByTestId('collections-total-amount')).toBeInTheDocument();

    answer = failure(404);
    await act(async () => {
      await client.refetchQueries({ queryKey: ['report-collections', 'collections'] });
    });

    expect(await screen.findByTestId('collections-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('collections-total')).toBeNull();
    expect(screen.queryByTestId('collections-by-date')).toBeNull();
  });

  it('Page_FailureOfTheRead_IsAnErrorWithARetryNeverAnEmptyReport', async () => {
    serve({ collections: failure(500), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();

    expect(await screen.findByTestId('collections-error')).toBeInTheDocument();
    expect(screen.queryByTestId('collections-empty')).toBeNull();
    expect(screen.queryByTestId('collections-total')).toBeNull();
  });

  it('Page_FailureOfTheBalancesOnly_DoesNotSayThereIsNothingToCollect', async () => {
    serve({ collections: ok(COLLECTIONS), balances: failure(500) });
    renderPage();

    expect(await screen.findByTestId('collections-balances-state-error')).toBeInTheDocument();
    expect(screen.queryByTestId('collections-balances-empty')).toBeNull();
    expect(screen.getByTestId('collections-total-amount')).toBeInTheDocument();
  });

  // Money / privacy: the balances link to the booking, show no guest, say "not available" for a figure the channel did not report, and
  // never put two currencies in one table with one total.
  it('Balances_TwoCurrencies_AreTwoTablesEachWithTheServerTotalOfItsCurrency', async () => {
    const balances: BalancesToCollectReport = {
      ...NOTHING_TO_COLLECT,
      rows: [
        balanceRow({ bookingId: 'b-1', bookingCode: 'AAAAA-11111' }),
        balanceRow({ bookingId: 'b-2', bookingCode: 'BBBBB-22222', currency: 'CHF', total: 800, totalCents: 80000, collected: null, collectedCents: null, toCollect: 800, toCollectCents: 80000, basis: 'ChannelManager', overdue: false }),
        balanceRow({ bookingId: 'b-3', bookingCode: 'CCCCC-33333' }),
      ],
      totals: [
        { currency: 'CHF', amount: 800, amountCents: 80000, stayCount: 1 },
        { currency: 'EUR', amount: 600, amountCents: 60000, stayCount: 2 },
      ],
    };
    serve({ collections: ok(COLLECTIONS), balances: ok(balances) });
    renderPage();

    const sections = await screen.findAllByTestId('collections-balances-section');
    expect(sections).toHaveLength(2);
    expect(within(sections[0]!).getByTestId('collections-balances-currency')).toHaveTextContent('CHF');
    expect(within(sections[0]!).getAllByTestId('collections-balance-row')).toHaveLength(1);
    expect(within(sections[0]!).getByTestId('collections-balance-total')).toHaveTextContent('800,00 CHF');
    expect(within(sections[1]!).getByTestId('collections-balances-currency')).toHaveTextContent('EUR');
    expect(within(sections[1]!).getAllByTestId('collections-balance-row')).toHaveLength(2);
    expect(within(sections[1]!).getByTestId('collections-balance-total')).toHaveTextContent('600,00 €');
    // No figure of one currency in the table of the other.
    expect(sections[0]).not.toHaveTextContent('€');
    expect(sections[1]).not.toHaveTextContent('CHF');

    // The channel's own reservation: collected is not available (never derived, never zero) and says where the balance comes from.
    const channelRow = within(sections[0]!).getByTestId('collections-balance-row');
    expect(channelRow).toHaveTextContent('Non disponibile');
    expect(within(channelRow).getByTestId('collections-balance-reported')).toBeInTheDocument();
    expect(within(channelRow).queryByTestId('collections-balance-overdue')).toBeNull();
  });

  it('Balances_Stay_LinksToItsBookingWithItsCodeAndIsMarkedOverdueInWords', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok({ ...NOTHING_TO_COLLECT, rows: [balanceRow({})], totals: [{ currency: 'EUR', amount: 300, amountCents: 30000, stayCount: 1 }] }) });
    renderPage();

    const link = await screen.findByTestId('collections-balance-link');
    expect(link).toHaveTextContent('ABCDE-FGHIJ');
    expect(link).toHaveAttribute('href', '/app/short-rent/bookings/b-1');
    expect(screen.getByTestId('collections-balance-overdue')).toHaveTextContent('Scaduto');
    const row = screen.getByTestId('collections-balance-row');
    expect(row).toHaveTextContent('Villa del Lago');
    expect(row).toHaveTextContent('Sito diretto');
    expect(row).toHaveTextContent('500,00 €');
    expect(row).toHaveTextContent('200,00 €');
    expect(row).toHaveTextContent('300,00 €');
    expect(screen.getByTestId('collections-balance-total')).toHaveTextContent('Totale da incassare (1 soggiorno)');
  });

  it('Balances_NothingToCollect_SaysSo', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();

    expect(await screen.findByTestId('collections-balances-empty')).toHaveTextContent('Non c’è nulla da incassare');
  });

  // Trust: credits that the server does not have are said in one sentence and shown with no figure; a total that is partly unknown says so.
  it('Credits_NotAvailable_AreOneSentenceAndNoFigureNeverZero', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();

    const stripe = await screen.findByTestId('collections-credits-stripe-unavailable');
    expect(stripe).toHaveTextContent('Non disponibile');
    expect(screen.getByTestId('collections-credits-channels-unavailable')).toHaveTextContent('Non disponibile');
    const credits = screen.getByTestId('collections-credits');
    expect(within(credits).queryByRole('table')).toBeNull();
    expect(credits).not.toHaveTextContent('0,00');
  });

  it('Credits_Available_AreShownAsReportedAndTheMissingFiguresAreCountedApart', async () => {
    const withCredits: CollectionsReport = {
      ...COLLECTIONS,
      credits: {
        stripe: {
          available: true,
          payouts: [
            { arrivalDate: '2026-09-02', currency: 'EUR', amount: 970.5, amountCents: 97050, paymentCount: 2, status: 'Credited' },
            { arrivalDate: '2026-09-28', currency: 'CHF', amount: 55, amountCents: 5500, paymentCount: 1, status: 'Expected' },
          ],
          cardPaymentCount: 5,
          paymentsWithoutFigures: 2,
        },
        channels: {
          available: true,
          reportedBy: 'channelManager',
          rows: [{ source: 'Airbnb', currency: 'EUR', amount: 412.3, amountCents: 41230, stayCount: 3 }],
          staysWithoutNet: 1,
        },
      },
    };
    serve({ collections: ok(withCredits), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();

    const rows = await screen.findAllByTestId('collections-credits-stripe-row');
    expect(rows[0]).toHaveTextContent('970,50 €');
    expect(within(rows[0]!).getByTestId('collections-credits-stripe-status')).toHaveTextContent('Accreditato');
    expect(rows[1]).toHaveTextContent('55,00 CHF');
    expect(within(rows[1]!).getByTestId('collections-credits-stripe-status')).toHaveTextContent('Atteso');
    expect(screen.getByTestId('collections-credits-stripe-partial')).toHaveTextContent('Su 5 pagamenti con carta, 2 non hanno ancora le cifre');

    expect(screen.getByTestId('collections-credits-reported')).toHaveTextContent('Indicati dal channel manager');
    expect(screen.getByTestId('collections-credits-channel-row')).toHaveTextContent('412,30 €');
    expect(screen.getByTestId('collections-credits-channels-partial')).toHaveTextContent('1 soggiorno');
    // No vendor is named to the person.
    expect(screen.getByTestId('collections-credits')).not.toHaveTextContent(/stripe|octorate/i);
  });

  // Data: both days are required and checked before the call; a period the server would refuse is asked for nowhere, not even in the file.
  it('Period_TypedDaysWithAMissingDay_AreToldBeforeTheCallAndNothingIsAsked', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();
    await screen.findByTestId('collections-total-amount');
    expect(callsTo('/reports/collections')).toHaveLength(1);

    fireEvent.change(screen.getByTestId('collections-period'), { target: { value: 'custom' } });
    fireEvent.change(await screen.findByTestId('collections-to'), { target: { value: '' } });

    expect(await screen.findByTestId('collections-problem')).toHaveTextContent('Controlla le date');
    expect(screen.queryByTestId('collections-total')).toBeNull();
    expect(callsTo('/reports/collections')).toHaveLength(1);
    expect(screen.getByTestId('collections-export-csv')).toBeDisabled();
    expect(screen.getByTestId('collections-export-xlsx')).toBeDisabled();
  });

  it('Period_MoreThan24Months_IsToldBeforeTheCall', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();
    await screen.findByTestId('collections-total-amount');

    fireEvent.change(screen.getByTestId('collections-period'), { target: { value: 'custom' } });
    fireEvent.change(await screen.findByTestId('collections-from'), { target: { value: '2023-01-01' } });

    expect(await screen.findByTestId('collections-problem')).toHaveTextContent('24 mesi');
    expect(callsTo('/reports/collections')).toHaveLength(1);
  });

  // Data: the days are the calendar days of Europe/Rome, with the right last day of the month (28, 29, 30, 31), `yyyy-MM-dd`.
  it.each([
    { name: 'ThirtyDayMonth', now: NOON_UTC, preset: 'thisMonth', from: '2026-09-01', to: '2026-09-30' },
    { name: 'LeapFebruary', now: '2028-03-01T10:00:00Z', preset: 'lastMonth', from: '2028-02-01', to: '2028-02-29' },
    { name: 'ShortFebruary', now: '2027-03-15T10:00:00Z', preset: 'lastMonth', from: '2027-02-01', to: '2027-02-28' },
    { name: 'ThirtyOneDayMonth', now: '2026-12-10T10:00:00Z', preset: 'thisMonth', from: '2026-12-01', to: '2026-12-31' },
    // 22:30 UTC of 31 March is already 1 April in Rome (CEST): the month is April, not March.
    { name: 'LateEveningIsTheNextDayInRome', now: '2026-03-31T22:30:00Z', preset: 'thisMonth', from: '2026-04-01', to: '2026-04-30' },
    { name: 'LateEveningOfTheSeptemberDay', now: LATE_EVENING_UTC, preset: 'thisMonth', from: '2026-09-01', to: '2026-09-30' },
  ])('Period_AsksTheDaysOfRome_$name', async ({ now, preset, from, to }) => {
    vi.useRealTimers();
    freezeClock(now);
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT) });
    renderPage();
    await screen.findByTestId('collections-total-amount');

    if (preset !== 'thisMonth') fireEvent.change(screen.getByTestId('collections-period'), { target: { value: preset } });

    await waitFor(() => expect(callsTo('/reports/collections').at(-1)![1]).toMatchObject({ params: { from, to } }));
    expect(callsTo('/reports/collections').at(-1)![1]!.params.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Permission / data: a chosen property narrows the report and the balances, and the file asks for it too.
  it('Property_Chosen_NarrowsTheReportTheBalancesAndTheFile', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT), file: () => Promise.resolve({ status: 200, data: new Blob(['x'], { type: 'text/csv' }) }) });
    renderPage();
    await screen.findByTestId('collections-total-amount');

    fireEvent.change(screen.getByTestId('collections-property'), { target: { value: 'p-2' } });

    await waitFor(() => expect(callsTo('/reports/collections').at(-1)![1]).toMatchObject({ params: { propertyId: 'p-2' } }));
    expect(callsTo('/reports/balances-to-collect').at(-1)![1]).toMatchObject({ params: { propertyId: 'p-2' } });

    fireEvent.click(await screen.findByTestId('collections-export-csv'));
    await waitFor(() => expect(save).toHaveBeenCalled());
    const fileCall = get.mock.calls.find(([, config]) => (config as { params?: { format?: string } } | undefined)?.params?.format === 'csv')!;
    expect(fileCall[1]).toMatchObject({ params: { from: '2026-09-01', to: '2026-09-30', propertyId: 'p-2', format: 'csv' }, responseType: 'blob' });
  });

  // Money / data: the file comes from the authenticated API, is saved with a name made of the report and its days, and both buttons stay
  // off while a request is on its way, so a second click cannot ask for a second file.
  it('Export_WhileAFileIsOnItsWay_BothButtonsAreOffAndTheFileIsSavedUnderTheNameOfTheDays', async () => {
    let finish: (value: unknown) => void = () => undefined;
    const csv = new Blob(['Totale;1234,56'], { type: 'text/csv' });
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT), file: () => new Promise((resolve) => (finish = resolve)) });
    renderPage();
    await screen.findByTestId('collections-total-amount');

    fireEvent.click(screen.getByTestId('collections-export-csv'));

    await waitFor(() => expect(screen.getByTestId('collections-export-xlsx')).toBeDisabled());
    expect(screen.getByTestId('collections-export-csv')).toBeDisabled();
    fireEvent.click(screen.getByTestId('collections-export-csv'));
    fireEvent.click(screen.getByTestId('collections-export-xlsx'));
    const fileCalls = () => get.mock.calls.filter(([, config]) => (config as { params?: { format?: string } } | undefined)?.params?.format);
    expect(fileCalls()).toHaveLength(1);
    expect(save).not.toHaveBeenCalled();

    await act(async () => finish({ status: 200, data: csv }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(csv, 'casazen-incassato-per-cassa-20260901-20260930.csv'));
    await waitFor(() => expect(screen.getByTestId('collections-export-csv')).not.toBeDisabled());
    expect(screen.getByTestId('collections-export-xlsx')).not.toBeDisabled();
    expect(screen.queryByTestId('collections-export-failure')).toBeNull();
  });

  it('Export_Excel_AsksForTheXlsxFormatAndNamesTheFileAccordingly', async () => {
    const xlsx = new Blob(['PK'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT), file: () => Promise.resolve({ status: 200, data: xlsx }) });
    renderPage();
    await screen.findByTestId('collections-total-amount');

    fireEvent.click(screen.getByTestId('collections-export-xlsx'));

    await waitFor(() => expect(save).toHaveBeenCalledWith(xlsx, 'casazen-incassato-per-cassa-20260901-20260930.xlsx'));
    const fileCall = get.mock.calls.find(([, config]) => (config as { params?: { format?: string } } | undefined)?.params?.format === 'xlsx')!;
    expect(fileCall[1]).toMatchObject({ params: { format: 'xlsx' }, responseType: 'blob' });
  });

  // Trust: a file with too many rows is told in words (narrow the period), the person can try again, and nothing is saved.
  it('Export_TooManyRows_IsToldInWordsAndNothingIsSaved', async () => {
    serve({
      collections: ok(COLLECTIONS),
      balances: ok(NOTHING_TO_COLLECT),
      file: () => Promise.reject(failure(422, { code: 'xlsx_too_many_rows', title: 'Unprocessable Entity' }, true)),
    });
    renderPage();
    await screen.findByTestId('collections-total-amount');

    fireEvent.click(screen.getByTestId('collections-export-xlsx'));

    expect(await screen.findByTestId('collections-export-failure')).toHaveTextContent('troppe righe: scegli un periodo più breve');
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId('collections-export-xlsx')).not.toBeDisabled();
  });

  it('Export_Refused403_SaysTheReportIsNotOpenToThePersonInThePage', async () => {
    serve({ collections: ok(COLLECTIONS), balances: ok(NOTHING_TO_COLLECT), file: () => Promise.resolve({ status: 403, data: new Blob(['{}'], { type: 'application/json' }) }) });
    renderPage();
    await screen.findByTestId('collections-total-amount');

    fireEvent.click(screen.getByTestId('collections-export-csv'));

    expect(await screen.findByTestId('collections-export-failure')).toHaveTextContent('Non hai accesso a questo report.');
    expect(save).not.toHaveBeenCalled();
  });
});
