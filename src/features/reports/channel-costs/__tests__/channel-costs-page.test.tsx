import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders } from 'axios';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { saveBlobAs } from '@/lib/file-download';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { ChannelCostRow, ChannelCostsReport } from '@/types';
import { ChannelCostsPage } from '../channel-costs-page';

// The page with the real hooks, line and table: only the HTTP layer, the permissions, the list of properties, the saving of a file and the
// frame of the app are replaced. What is under test is what the page does with what the server sends: every figure as it is, a cost nobody
// reported as "not available" (never zero, never free), the card fees on a line of their own, and no vendor named to the person.
const granted = vi.hoisted(() => new Set<string>());

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => granted.has(`${context}:${permission}`) }),
}));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: vi.fn() }));
// The list of the properties, as the hook answers it: with `enabled: false` nothing is asked and there is nothing to choose from.
const useProperties = vi.hoisted(() => vi.fn());
vi.mock('@/queries/use-properties', () => ({ useProperties }));
const PROPERTIES = [
  { id: 'p-1', name: 'Villa del Lago' },
  { id: 'p-2', name: 'Casa in centro' },
];
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));

const get = vi.mocked(axios.get);
const save = vi.mocked(saveBlobAs);

function row(overrides: Partial<ChannelCostRow>): ChannelCostRow {
  return {
    source: 'Airbnb',
    kind: 'ChannelCommission',
    stayCount: 4,
    gross: 2000,
    grossCents: 200000,
    commission: 240,
    commissionCents: 24000,
    net: 1760,
    netCents: 176000,
    costRate: 0.12,
    commissionMode: 'DeductedFromPayout',
    staysWithoutCommission: 0,
    mostExpensive: false,
    ...overrides,
  };
}

/** The server orders the rows by cost rate, the highest first: Booking.com (15%), Airbnb (12%), then the ones without a rate. */
const BOOKING = row({
  source: 'BookingCom',
  stayCount: 5,
  gross: 2500,
  grossCents: 250000,
  commission: 375.5,
  commissionCents: 37550,
  net: 1500.25,
  netCents: 150025,
  costRate: 0.1534,
  commissionMode: 'InvoicedSeparately',
  staysWithoutCommission: 2,
  mostExpensive: true,
});
const AIRBNB = row({});
const DIRECT = row({
  source: 'Direct',
  kind: 'PaymentFee',
  stayCount: 2,
  gross: 800,
  grossCents: 80000,
  commission: null,
  commissionCents: null,
  net: null,
  netCents: null,
  costRate: null,
  commissionMode: null,
  staysWithoutCommission: 2,
});
const MANUAL = row({
  source: 'Manual',
  kind: 'NoCost',
  stayCount: 1,
  gross: 300,
  grossCents: 30000,
  commission: 0,
  commissionCents: 0,
  net: 300,
  netCents: 30000,
  costRate: 0,
  commissionMode: null,
});

const REPORT: ChannelCostsReport = {
  title: 'Costi dei canali, per competenza, dal 01/06/2026 al 31/08/2026',
  basis: 'accrual',
  period: { from: '2026-06-01', to: '2026-08-31', nights: 92 },
  rows: [BOOKING, AIRBNB, DIRECT, MANUAL],
  total: row({
    source: null,
    kind: null,
    stayCount: 12,
    gross: 5600,
    grossCents: 560000,
    commission: 615.5,
    commissionCents: 61550,
    net: 3460.25,
    netCents: 346025,
    costRate: 0.1368,
    commissionMode: null,
    staysWithoutCommission: 4,
  }),
};

function ok(data: unknown) {
  return { status: 200, data };
}

function failure(status: number, body: unknown = {}, asBlob = false): AxiosError {
  const data = asBlob ? new Blob([JSON.stringify(body)], { type: 'application/problem+json' }) : body;
  return new AxiosError('failed', undefined, undefined, undefined, { status, statusText: '', data, headers: {}, config: { headers: new AxiosHeaders() } });
}

type FileParams = { params?: { format?: string } } | undefined;

function serve(report: () => unknown, file?: (format: string) => Promise<unknown>) {
  get.mockImplementation((_url: string, config?: FileParams) => {
    if (config?.params?.format) return (file ?? (() => Promise.reject(new Error('no file served'))))(config.params.format) as never;
    const body = report();
    return (body instanceof Error ? Promise.reject(body) : Promise.resolve(body)) as never;
  });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const view = render(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(ChannelCostsPage))),
  );
  return { client, ...view };
}

const reads = () => get.mock.calls.filter(([, config]) => !(config as FileParams)?.params?.format);

describe('ChannelCostsPage (NF-98)', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    useProperties.mockImplementation((_params: unknown, options?: { enabled?: boolean }) => ({ data: options?.enabled === false ? undefined : PROPERTIES }));
    granted.clear();
    granted.add('short-rent:payment.read');
    granted.add('short-rent:property.read');
    // 24 September 2026 is "today" in Rome in these tests: the page opens on the three whole months before this one (June to August).
    freezeClock(NOON_UTC);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  // Money: one line for each channel, written from the cost rate and the commission of the server, the most expensive first as the server
  // orders them and marked with a word and an icon; a cost nobody reported is "not available", never a cost of zero.
  it('Summary_OneLineForEachChannel_IsWrittenFromTheServerFiguresInTheServerOrder', async () => {
    serve(() => ok(REPORT));
    renderPage();

    const lines = await screen.findAllByTestId('channel-costs-summary-line');
    expect(lines.map((line) => line.textContent?.replace(/[\u00a0\u202f]/g, ' '))).toEqual([
      'Booking.com ti costa il 15,34% del lordo (375,50 €).',
      'Airbnb ti costa il 12% del lordo (240,00 €).',
      'Sito diretto: le commissioni di incasso con carta non sono disponibili.',
      'Manuale: nessun costo per te.',
    ]);
    expect(reads()[0]![1]).toMatchObject({ params: { from: '2026-06-01', to: '2026-08-31' } });

    // The row the server flags is marked by a word (and an icon), once.
    const marks = screen.getAllByTestId('channel-costs-most-expensive');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toHaveTextContent('Il più costoso');
    expect(screen.getAllByTestId('channel-costs-summary-row')[0]).toContainElement(marks[0]!);
  });

  it('Summary_StaysWithoutACommission_AreSaidApartInTheLineNeverTakenAsFree', async () => {
    serve(() => ok(REPORT));
    renderPage();

    const first = (await screen.findAllByTestId('channel-costs-summary-row'))[0]!;

    expect(within(first).getByTestId('channel-costs-summary-without')).toHaveTextContent('2 soggiorni senza commissione indicata non sono contati come gratuiti.');
    expect(within(first).getByTestId('channel-costs-summary-line')).not.toHaveTextContent('gratuit');
  });

  it('Table_EveryFigureIsTheServers_AndTheModeIsExplainedInWords', async () => {
    serve(() => ok(REPORT));
    renderPage();

    const rows = await screen.findAllByTestId('channel-costs-row');
    // The channels first, then the card fees of the direct stays on a line of their own, then the stays with no cost.
    expect(rows.map((candidate) => within(candidate).getAllByRole('rowheader')[0]!.textContent)).toEqual(['Booking.com', 'Airbnb', 'Sito diretto', 'Manuale']);

    const booking = rows[0]!;
    expect(booking).toHaveTextContent(/2\.?500,00 €/);
    expect(booking).toHaveTextContent('375,50 €');
    expect(booking).toHaveTextContent(/1\.?500,25 €/);
    expect(booking).toHaveTextContent('15,34%');
    expect(within(booking).getByTestId('channel-costs-mode')).toHaveTextContent('Fatturata a parte');
    expect(within(booking).getByTestId('channel-costs-mode')).toHaveTextContent('Il canale ti fattura la commissione a parte: la paghi tu dopo.');
    expect(within(rows[1]!).getByTestId('channel-costs-mode')).toHaveTextContent('Trattenuta dal pagamento');
    expect(within(rows[1]!).getByTestId('channel-costs-mode')).toHaveTextContent('Il canale ti paga già al netto della commissione.');
    // A mode that is not a claim: "unknown" has its own words.
    expect(screen.queryByText('Non nota')).toBeNull();
  });

  it('Table_ModeThatTheServerDoesNotKnow_IsSaidAsUnknownNeverClaimed', async () => {
    serve(() => ok({ ...REPORT, rows: [row({ commissionMode: 'Unknown' })] }));
    renderPage();

    const mode = await screen.findByTestId('channel-costs-mode');

    expect(mode).toHaveTextContent('Non nota');
    expect(mode).toHaveTextContent('Non sappiamo come il canale incassa la commissione.');
  });

  // Money: the card fees of the direct stays are a line of their own; with no fee stored they are "not available", never zero.
  it('Table_CardFeesOfTheDirectStays_AreTheirOwnLineAndNotAvailableNeverZero', async () => {
    serve(() => ok(REPORT));
    renderPage();

    const group = await screen.findByTestId('channel-costs-group-cardFees');

    expect(group).toHaveTextContent('Prenotazioni dirette: commissioni di incasso con carta');
    const direct = within(group).getByTestId('channel-costs-row');
    expect(within(direct).getByTestId('channel-costs-unavailable')).toHaveTextContent('Non disponibile');
    expect(within(direct).getByTestId('channel-costs-unavailable')).toHaveTextContent('Non ancora registrate per questi pagamenti.');
    // No zero amount and no zero rate anywhere in the line (the gross, 800,00, has zeros of its own).
    expect(direct).not.toHaveTextContent(/(?<![\d.,])0,00/);
    expect(direct).not.toHaveTextContent(/(?<![\d.,])0%/);
    // The channels' commissions are in another group: the card fees are not mixed with them.
    expect(within(screen.getByTestId('channel-costs-group-channels')).queryByText('Sito diretto')).toBeNull();
  });

  it('Table_StaysWithoutACommission_AreNotedForTheRowAndForTheTotalNeverPresentedAsFree', async () => {
    serve(() => ok(REPORT));
    renderPage();

    const rows = await screen.findAllByTestId('channel-costs-row');

    expect(within(rows[0]!).getByTestId('channel-costs-row-without')).toHaveTextContent('2 soggiorni senza commissione indicata: non contati come gratuiti');
    expect(within(rows[1]!).queryByTestId('channel-costs-row-without')).toBeNull();
    expect(screen.getByTestId('channel-costs-without-commission')).toHaveTextContent('4 soggiorni non hanno una commissione indicata dal canale');
    expect(screen.getByTestId('channel-costs-without-commission')).toHaveTextContent('non sono considerati gratuiti');
  });

  it('Table_NoStayWithoutACommission_HasNoNote', async () => {
    serve(() => ok({ ...REPORT, rows: [AIRBNB], total: { ...REPORT.total, staysWithoutCommission: 0 } }));
    renderPage();

    await screen.findByTestId('channel-costs-total');

    expect(screen.queryByTestId('channel-costs-without-commission')).toBeNull();
  });

  it('Table_TotalRow_IsTheServersTotalAsItIs', async () => {
    serve(() => ok(REPORT));
    renderPage();

    const total = await screen.findByTestId('channel-costs-total');

    expect(total).toHaveTextContent('Totale');
    expect(total).toHaveTextContent('12');
    expect(total).toHaveTextContent(/5\.?600,00 €/);
    expect(total).toHaveTextContent('615,50 €');
    expect(total).toHaveTextContent(/3\.?460,25 €/);
    expect(total).toHaveTextContent('13,68%');
  });

  it('Table_TotalWithoutAKnownCost_IsNotAvailableNeverZero', async () => {
    const unknown = row({ source: null, kind: null, commission: null, commissionCents: null, net: null, netCents: null, costRate: null, commissionMode: null });
    serve(() => ok({ ...REPORT, rows: [DIRECT], total: unknown }));
    renderPage();

    const total = await screen.findByTestId('channel-costs-total');

    expect(total).toHaveTextContent('Non disponibile');
    expect(total).not.toHaveTextContent(/(?<![\d.,])0,00 €/);
    expect(total).not.toHaveTextContent(/(?<![\d.,])0%/);
  });

  it('Page_NoConfirmedStay_SaysSoInsteadOfAnEmptyTable', async () => {
    serve(() => ok({ ...REPORT, rows: [], total: { ...REPORT.total, stayCount: 0 } }));
    renderPage();

    expect(await screen.findByTestId('channel-costs-empty')).toHaveTextContent('Nessun soggiorno confermato nel periodo scelto');
    expect(screen.queryByTestId('channel-costs-table')).toBeNull();
  });

  it('Page_Texts_NameNoVendor', async () => {
    serve(() => ok(REPORT));
    renderPage();
    await screen.findByTestId('channel-costs-total');

    expect(screen.getByTestId('channel-costs-page').textContent).not.toMatch(/stripe|octorate|concordato/i);
  });

  // Permission: without payment.read the page asks the server for nothing at all, and says so.
  it('Page_WithoutPaymentRead_AsksTheServerForNothing', async () => {
    granted.clear();
    serve(() => ok(REPORT));
    renderPage();

    expect(await screen.findByTestId('channel-costs-no-access')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
    expect(useProperties).not.toHaveBeenCalled();
    expect(screen.queryByTestId('channel-costs-export-csv')).toBeNull();
  });

  // Permission: the list of the properties is another permission (property.read). Without it the list is not asked for (the server would
  // answer 403 and the shared client would send the app to the page of the missing access): there is no property to choose and the report
  // covers the whole scope of the person.
  it('Page_WithoutPropertyRead_DoesNotAskForTheListOfPropertiesAndTheReportCoversTheWholeScope', async () => {
    granted.delete('short-rent:property.read');
    serve(() => ok(REPORT));
    renderPage();

    expect(await screen.findByTestId('channel-costs-table')).toBeInTheDocument();
    expect(useProperties).toHaveBeenCalled();
    expect(useProperties.mock.calls.every(([, options]) => (options as { enabled?: boolean } | undefined)?.enabled === false)).toBe(true);
    expect(screen.queryByTestId('channel-costs-property')).toBeNull();
    expect(reads()[0]![1]!.params).toEqual({ from: '2026-06-01', to: '2026-08-31' });
  });

  it('Page_403_SaysTheReportIsNotOpenToThePersonAndShowsNoFigure', async () => {
    serve(() => ({ status: 403, data: {} }));
    renderPage();

    expect(await screen.findByTestId('channel-costs-forbidden')).toHaveTextContent('Non hai accesso a questo report.');
    expect(screen.queryByTestId('channel-costs-table')).toBeNull();
    expect(screen.queryByTestId('channel-costs-summary')).toBeNull();
  });

  // Trust: a 404 is "not found", also when the cache still holds the old figures of the same read.
  it('Page_404AfterFigures_IsNotFoundAndTheOldFiguresGoAway', async () => {
    let answer: unknown = ok(REPORT);
    serve(() => answer);
    const { client } = renderPage();
    expect(await screen.findByTestId('channel-costs-table')).toBeInTheDocument();

    answer = failure(404);
    await act(async () => {
      await client.refetchQueries({ queryKey: ['report-channel-costs'] });
    });

    expect(await screen.findByTestId('channel-costs-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('channel-costs-table')).toBeNull();
    expect(screen.queryByTestId('channel-costs-summary')).toBeNull();
  });

  it('Page_FailureOfTheRead_IsAnErrorWithARetryNeverAnEmptyReport', async () => {
    serve(() => failure(500));
    renderPage();

    expect(await screen.findByTestId('channel-costs-error')).toBeInTheDocument();
    expect(screen.queryByTestId('channel-costs-empty')).toBeNull();
  });

  it('Period_TypedDaysWithAMissingDay_AreToldBeforeTheCallAndNothingIsAskedNorExported', async () => {
    serve(() => ok(REPORT));
    renderPage();
    await screen.findByTestId('channel-costs-table');
    expect(reads()).toHaveLength(1);

    fireEvent.change(screen.getByTestId('channel-costs-period'), { target: { value: 'custom' } });
    fireEvent.change(await screen.findByTestId('channel-costs-from'), { target: { value: '' } });

    expect(await screen.findByTestId('channel-costs-problem')).toHaveTextContent('Controlla le date');
    expect(screen.queryByTestId('channel-costs-table')).toBeNull();
    expect(reads()).toHaveLength(1);
    expect(screen.getByTestId('channel-costs-export-csv')).toBeDisabled();
    expect(screen.getByTestId('channel-costs-export-xlsx')).toBeDisabled();
  });

  it('Property_Chosen_NarrowsTheReport', async () => {
    serve(() => ok(REPORT));
    renderPage();
    await screen.findByTestId('channel-costs-table');

    fireEvent.change(screen.getByTestId('channel-costs-property'), { target: { value: 'p-1' } });

    await waitFor(() => expect(reads().at(-1)![1]).toMatchObject({ params: { propertyId: 'p-1' } }));
  });

  // Data / money: the file comes from the authenticated API, under a name made of the report and its days (no property, no guest), with
  // both buttons off while it is on its way; too many rows is told in words and nothing is saved.
  it.each([
    { format: 'csv', name: 'casazen-costi-dei-canali-competenza-20260601-20260831.csv', type: 'text/csv' },
    { format: 'xlsx', name: 'casazen-costi-dei-canali-competenza-20260601-20260831.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ])('Export_IsSavedUnderTheNameOfTheDaysWhileBothButtonsAreOff_$format', async ({ format, name, type }) => {
    let finish: (value: unknown) => void = () => undefined;
    const file = new Blob(['x'], { type });
    serve(() => ok(REPORT), () => new Promise((resolve) => (finish = resolve)));
    renderPage();
    await screen.findByTestId('channel-costs-table');

    fireEvent.click(screen.getByTestId(`channel-costs-export-${format}`));

    await waitFor(() => expect(screen.getByTestId('channel-costs-export-csv')).toBeDisabled());
    expect(screen.getByTestId('channel-costs-export-xlsx')).toBeDisabled();
    expect(get.mock.calls.filter(([, config]) => (config as FileParams)?.params?.format)).toHaveLength(1);

    await act(async () => finish({ status: 200, data: file }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(file, name));
    await waitFor(() => expect(screen.getByTestId('channel-costs-export-csv')).not.toBeDisabled());
  });

  it('Export_TooManyRows_IsToldInWordsAndNothingIsSaved', async () => {
    serve(() => ok(REPORT), () => Promise.reject(failure(422, { code: 'xlsx_too_many_rows' }, true)));
    renderPage();
    await screen.findByTestId('channel-costs-table');

    fireEvent.click(screen.getByTestId('channel-costs-export-xlsx'));

    // The cap is said in words: too many rows, the most a sheet can have, and what to do about it.
    const failureText = await screen.findByTestId('channel-costs-export-failure');
    expect(failureText).toHaveTextContent('Troppe righe: un foglio di un file Excel può avere al massimo 10.000 righe.');
    expect(failureText).toHaveTextContent('Scegli un periodo più breve e riprova.');
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByTestId('channel-costs-export-xlsx')).not.toBeDisabled();
  });

  it('Export_CsvTooManyRows_SaysTheCapOfTheCsvInWords', async () => {
    serve(() => ok(REPORT), () => Promise.reject(failure(422, { code: 'csv_too_many_rows' }, true)));
    renderPage();
    await screen.findByTestId('channel-costs-table');

    fireEvent.click(screen.getByTestId('channel-costs-export-csv'));

    expect(await screen.findByTestId('channel-costs-export-failure')).toHaveTextContent('Troppe righe: un file CSV può avere al massimo 10.000 righe.');
    expect(save).not.toHaveBeenCalled();
  });
});
