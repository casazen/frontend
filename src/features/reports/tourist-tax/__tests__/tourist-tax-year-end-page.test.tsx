import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { expectNoAxeViolations } from '@/test/axe';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { TouristTaxSummary } from '@/types';
import { TouristTaxYearEndPage } from '../tourist-tax-year-end-page';
import { summaryOf, yearEndJsonOf } from './tourist-tax-year-end-fixtures';

const granted = vi.hoisted(() => new Set<string>());
const saved = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (context: string, permission: string) => granted.has(`${context}:${permission}`) }),
}));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: saved, withJsonErrorBody: async (error: unknown) => error }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));

vi.setConfig({ testTimeout: 30_000 });

const get = vi.mocked(axios.get);

const SUMMARY_PATH = '/tourist-tax/summary';
const GUEST_READ = 'short-rent:guest.read';

const file = (name: string) => ({ status: 200, data: new Blob(['a;b'], { type: 'text/csv' }), headers: { 'content-disposition': `attachment; filename="${name}"` } });

type Params = { params?: Record<string, string> };

function answerOf(path: string, config?: Params, summary: (year: number) => TouristTaxSummary = summaryOf) {
  if (path === SUMMARY_PATH) return { status: 200, data: summary(Number(config?.params?.from.slice(0, 4))), headers: {} };
  if (path.startsWith('/tourist-tax/year-end/')) {
    return config?.params?.format === 'json' ? { status: 200, data: yearEndJsonOf(path, config.params), headers: {} } : file(`${path.split('/').slice(-1)[0]}.csv`);
  }
  throw new Error(`unexpected read: ${path}`);
}

function serverInOrder(summary: (year: number) => TouristTaxSummary = summaryOf) {
  get.mockImplementation(async (path: string, config?: Params) => answerOf(path, config, summary));
}

const readsMade = () => get.mock.calls.map(([path, config]) => `${path}?${new URLSearchParams(config?.params as Record<string, string> | undefined).toString()}`).sort();

const filesAsked = () => get.mock.calls.filter(([path, config]) => path !== SUMMARY_PATH && (config?.params as Record<string, string> | undefined)?.format !== 'json');

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(
    createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, createElement(TouristTaxYearEndPage))),
  );
}

async function makeFile(testId: string, saves: number) {
  await waitFor(() => expect(screen.getByTestId(testId)).toBeEnabled());
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => expect(saved).toHaveBeenCalledTimes(saves));
}

beforeEach(async () => {
  vi.resetAllMocks();
  granted.clear();
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  serverInOrder();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the year of the page (a declaration is for one year, and the figures of another are never shown under it)', () => {
  it('YearEndPage_Opened_OffersTheCurrentYearAndTheThreeBefore_AndAsksForTheWholeOfTheCurrentYearOnly', async () => {
    renderPage();

    const select = screen.getByTestId('year-end-year');
    expect([...select.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['2026', '2025', '2024', '2023']);
    expect(select).toHaveValue('2026');

    await screen.findByTestId('year-end-figures');
    await screen.findByTestId('year-end-ticino-table');
    expect(readsMade()).toEqual([
      `${SUMMARY_PATH}?from=2026-01-01&to=2026-12-31`,
      '/tourist-tax/year-end/2026/agent-account?by=month&format=json',
      '/tourist-tax/year-end/2026/declaration?format=json',
      '/tourist-tax/year-end/2026/ticino?format=json',
    ]);
    expect(filesAsked()).toEqual([]);
  });

  it('YearEndPage_WithTheFiguresAndTheThreeFiles_HasNoAccessibilityViolationAxeCanFind', async () => {
    const { container } = renderPage();
    await screen.findByTestId('year-end-figures');

    await expectNoAxeViolations(container);
  });

  it('YearEndPage_AnotherYearChosen_AsksThatYear_AndWhileItLoadsTheFiguresOfTheOldOneAreNotShown', async () => {
    renderPage();
    await screen.findByTestId('year-end-figures');

    let answer!: (value: unknown) => void;
    get.mockImplementation(async (path: string, config?: Params) => {
      if (path === SUMMARY_PATH && config?.params?.from === '2025-01-01') return new Promise((resolve) => (answer = resolve));
      return answerOf(path, config);
    });
    fireEvent.change(screen.getByTestId('year-end-year'), { target: { value: '2025' } });

    await waitFor(() => expect(screen.queryByTestId('year-end-figures')).toBeNull());
    expect(screen.getByText(i18n.t('reports.touristTax.yearEnd.figures.loading'))).toBeInTheDocument();
    expect(screen.getByTestId('year-end-summary')).toHaveAttribute('aria-busy', 'true');

    answer({ status: 200, data: summaryOf(2025, { currency: 'EUR' }), headers: {} });
    expect(await screen.findByTestId('year-end-figures')).toBeInTheDocument();
    expect(readsMade()).toEqual(expect.arrayContaining([`${SUMMARY_PATH}?from=2025-01-01&to=2025-12-31`, '/tourist-tax/year-end/2025/declaration?format=json', '/tourist-tax/year-end/2025/ticino?format=json']));
  });
});

describe('the figures of the year (money rule: the server\'s figures, in the currency the answer names, nothing added up and no currency assumed)', () => {
  it.each([
    ['EUR', '32.345,50 €', '20.000,00 €', '12.345,50 €'],
    ['CHF', '32.345,50 CHF', '20.000,00 CHF', '12.345,50 CHF'],
  ])('YearEndFigures_CurrencyOfTheAnswerIs%s_TheFiguresAreWrittenInIt', async (currency, owed, paid, balance) => {
    serverInOrder((year) => summaryOf(year, { currency }));
    renderPage();

    await screen.findByTestId('year-end-figures');
    expect(screen.getByTestId('year-end-owed')).toHaveTextContent(owed);
    expect(screen.getByTestId('year-end-paid')).toHaveTextContent(paid);
    expect(screen.getByTestId('year-end-balance')).toHaveTextContent(balance);
    expect(screen.getByTestId('year-end-nights')).toHaveTextContent('9');
    expect(screen.queryByTestId('year-end-currency-missing')).toBeNull();
  });

  it('YearEndFigures_AnswerWithNoCurrency_TheFiguresHaveNoSymbolAndASentenceSaysWhy', async () => {
    serverInOrder((year) => summaryOf(year, { currency: '' }));
    renderPage();

    await screen.findByTestId('year-end-figures');
    expect(screen.getByTestId('year-end-owed')).toHaveTextContent('32.345,50');
    expect(screen.getByTestId('year-end-owed')).not.toHaveTextContent('€');
    expect(screen.getByTestId('year-end-currency-missing')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.figures.currencyMissing'));
  });

  it('YearEndFigures_MoreWasRemittedThanIsDue_TheDifferenceKeepsTheSignOfTheServer', async () => {
    const total = summaryOf(2026).total;
    serverInOrder((year) => summaryOf(year, { total: { ...total, paidCents: 5000000, paid: 50000, balanceCents: -1765450, balance: -17654.5 } }));
    renderPage();

    await screen.findByTestId('year-end-figures');
    expect(screen.getByTestId('year-end-balance')).toHaveTextContent('-17.654,50 €');
  });

  it('YearEndFigures_AYearWithNoStayInItalyAndNoPayment_IsToldInWords_NotShownAsZeros', async () => {
    serverInOrder((year) => summaryOf(year, { comuni: [], total: { ...summaryOf(year).total, stays: 0, nights: 0, guests: 0, owed: 0, owedCents: 0, paid: 0, paidCents: 0, balance: 0, balanceCents: 0 } }));
    renderPage();

    expect(await screen.findByTestId('year-end-empty')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.figures.empty', { year: 2026 }));
    expect(screen.queryByTestId('year-end-owed')).toBeNull();
    expect(screen.getByTestId('year-end-ticino-xlsx')).toBeEnabled();
  });

  it('YearEndFigures_StaysWithNoTaxRecorded_SayTheAmountDueMayBeIncomplete', async () => {
    const total = summaryOf(2026).total;
    serverInOrder((year) => summaryOf(year, { total: { ...total, staysWithoutAmount: 2 } }));
    renderPage();

    expect(await screen.findByTestId('year-end-incomplete')).toHaveTextContent(i18n.t('reports.touristTax.incompleteNote', { count: 2 }));
  });

  it('YearEndFigures_ACallerWhoReachesSomePropertiesOnly_SeesNoFigureAtAll_AndIsToldWhy', async () => {
    const full = summaryOf(2026);
    serverInOrder((year) => summaryOf(year, { paymentsHidden: true, comuni: [{ ...full.comuni[0]!, paid: null, paidCents: null, balance: null, balanceCents: null, status: null, remittances: null }] }));
    renderPage();

    expect(await screen.findByTestId('year-end-partial')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.figures.partial'));
    expect(screen.queryByTestId('year-end-figures')).toBeNull();
    expect(screen.queryByTestId('year-end-owed')).toBeNull();
  });
});

describe('the reasons of the exemptions (privacy rule, art. 9 GDPR: only who holds guest.read gets them, and the page never works one out)', () => {
  it('YearEndDeclaration_WithoutGuestRead_SaysTheReasonsAreRestricted_AndNeverTheSentenceThatPromisesThem', async () => {
    renderPage();
    await screen.findByTestId('year-end-figures');

    const note = screen.getByTestId('year-end-declaration-reasons');
    expect(note).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.declaration.reasonsRestricted'));
    expect(note).toHaveTextContent('dettaglio dei motivi riservato');
    expect(note).not.toHaveTextContent(i18n.t('reports.touristTax.yearEnd.declaration.reasons'));
  });

  it('YearEndDeclaration_WithGuestRead_SaysTheExemptionsAreCountedByReason_AndNotTheRestrictedSentence', async () => {
    granted.add(GUEST_READ);
    renderPage();
    await screen.findByTestId('year-end-figures');

    const note = screen.getByTestId('year-end-declaration-reasons');
    expect(note).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.declaration.reasons'));
    expect(note).not.toHaveTextContent('dettaglio dei motivi riservato');
  });

  it('YearEndDeclaration_TheFileGoesToTheDiskAsItCame_ThePageNeverOpensItToReadOrRework', async () => {
    const blob = new Blob(['comune;esenti\nMilano;1'], { type: 'text/csv' });
    const reads = (['text', 'arrayBuffer', 'slice'] as const).map((method) => vi.spyOn(blob, method));
    get.mockImplementation(async (path: string, config?: Params) =>
      path === SUMMARY_PATH || config?.params?.format === 'json'
        ? answerOf(path, config)
        : { status: 200, data: blob, headers: { 'content-disposition': 'attachment; filename="dichiarazione.csv"' } },
    );
    renderPage();

    await makeFile('year-end-declaration-csv', 1);

    expect(saved).toHaveBeenCalledWith(blob, 'dichiarazione.csv');
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });
});

describe('the files of the year (one at a time, each in the format and for the year asked)', () => {
  it('YearEndFiles_EveryButton_AsksItsOwnFileForTheYearAndTheFormat_AndTheAccountForTheCutChosen', async () => {
    renderPage();
    await screen.findByTestId('year-end-figures');

    await makeFile('year-end-declaration-xlsx', 1);
    await makeFile('year-end-agent-account-csv', 2);
    fireEvent.change(screen.getByTestId('year-end-agent-account-by'), { target: { value: 'quarter' } });
    await makeFile('year-end-agent-account-xlsx', 3);
    await makeFile('year-end-ticino-csv', 4);

    const asked = filesAsked().map(([path, config]) => [path, config?.params]);
    expect(asked).toEqual([
      ['/tourist-tax/year-end/2026/declaration', { format: 'xlsx' }],
      ['/tourist-tax/year-end/2026/agent-account', { by: 'month', format: 'csv' }],
      ['/tourist-tax/year-end/2026/agent-account', { by: 'quarter', format: 'xlsx' }],
      ['/tourist-tax/year-end/2026/ticino', { format: 'csv' }],
    ]);
    expect(screen.getByTestId('year-end-ticino')).toHaveTextContent('5 gennaio 2027');
    expect(within(screen.getByTestId('year-end-ticino-canton')).getByRole('link')).toHaveAttribute('href', '/app/short-rent/properties');
  });

  it('YearEndFiles_ADoubleClickAsksOnce_AndWhileOneIsOnItsWayNoOtherFileCanBeAsked', async () => {
    let finish!: (value: ReturnType<typeof file>) => void;
    get.mockImplementation(async (path: string, config?: Params) =>
      path === SUMMARY_PATH || config?.params?.format === 'json' ? answerOf(path, config) : new Promise((done) => (finish = done)),
    );
    renderPage();
    await waitFor(() => expect(screen.getByTestId('year-end-ticino-csv')).toBeEnabled());

    const csv = screen.getByTestId('year-end-declaration-csv');
    fireEvent.click(csv);
    fireEvent.click(csv);

    await waitFor(() => expect(screen.getByTestId('year-end-ticino-csv')).toBeDisabled());
    expect(screen.getByTestId('year-end-agent-account-xlsx')).toBeDisabled();
    await waitFor(() => expect(filesAsked()).toHaveLength(1));

    finish(file('dichiarazione.csv'));
    await waitFor(() => expect(screen.getByTestId('year-end-ticino-csv')).toBeEnabled());
    expect(saved).toHaveBeenCalledTimes(1);
  });
});
