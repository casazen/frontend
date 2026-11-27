import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { expectNoAxeViolations } from '@/test/axe';
import { freezeClock, NOON_UTC } from '@/test/clock';
import type { TicinoYearlyCount, TouristTaxAgentAccount, TouristTaxDeclaration, TouristTaxSummary } from '@/types';
import { TouristTaxYearEndPage } from '../tourist-tax-year-end-page';
import {
  agentAccountOf,
  declarationOf,
  EXEMPTIONS_RESTRICTED,
  SENSITIVE_REASON_CODES,
  summaryOf,
  ticinoOf,
  ticinoProperty,
  ticinoUnknownProperty,
  yearEndJsonOf,
} from './tourist-tax-year-end-fixtures';

// The three results of the year on screen (the declaration to the comuni, the account of the agent, the count of Ticino), through the page with the real hooks and the real API module: only the HTTP client, the permissions, the
// frame of the app and the saving of a file are replaced. What is under test is what the page shows of what the server gives: the reasons of the exemptions only as the server gives them (privacy, art. 9 GDPR), every amount
// in the currency of its answer and as the server sent it (money), and the properties whose canton is not known (data). The refusals and the failures of these reads are in `tourist-tax-year-end-wire.test.tsx`.
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => false }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: vi.fn(), withJsonErrorBody: async (error: unknown) => error }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));

vi.setConfig({ testTimeout: 30_000 });

const get = vi.mocked(axios.get);

const SUMMARY_PATH = '/tourist-tax/summary';

type Params = { params?: Record<string, string> };

interface Served {
  /** The summary of the year, the Italian figures at the top of the page, when a test gives its own. */
  summary?: (year: number) => TouristTaxSummary;
  declaration?: TouristTaxDeclaration;
  account?: (by: 'month' | 'quarter') => TouristTaxAgentAccount;
  ticino?: TicinoYearlyCount;
}

/** A server that is in order: the summary of the year, the JSON of the three results (the ones a test gives, or the ones of the fixtures) and a file for each export. */
function serve(served: Served = {}) {
  get.mockImplementation(async (path: string, config?: Params) => {
    const params = config?.params;
    if (path === SUMMARY_PATH) return { status: 200, data: (served.summary ?? summaryOf)(Number(params?.from.slice(0, 4))), headers: {} };
    if (params?.format !== 'json') return { status: 200, data: new Blob(['a;b'], { type: 'text/csv' }), headers: {} };
    const kind = path.split('/')[4];
    const by = params.by === 'quarter' ? 'quarter' : 'month';
    const data = (kind === 'declaration' ? served.declaration : kind === 'ticino' ? served.ticino : served.account?.(by)) ?? yearEndJsonOf(path, params);
    return { status: 200, data, headers: {} };
  });
}

function renderPage(client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })) {
  const view = render(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, createElement(TouristTaxYearEndPage))));
  return { ...view, client };
}

/** The cells of a row that are not its header, in the order of the columns. */
const cellsOf = (row: HTMLElement) => [...row.querySelectorAll('td')];

/** The lines of a cell that holds one number over another (the stays and, under them, the nights). */
const stacked = (cell: HTMLElement) => [...cell.children].map((line) => line.textContent);

const label = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

/** The words the page has for a reason of an exemption, in the language of the test. */
const reasonWords = (code: string) => (code === 'erased' ? label('reports.touristTax.yearEnd.declaration.exemptionReason.erased') : label(`touristTax.exemption.${code}`));

beforeEach(async () => {
  vi.resetAllMocks();
  // 24 September 2026 is «today» in Rome in these tests: the page opens on this year.
  freezeClock(NOON_UTC);
  await i18n.changeLanguage('it');
  serve();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('the reasons of the exemptions on screen (privacy rule, art. 9 GDPR: the page shows what the server gives, and the page of a caller who may not read the reasons has none of them)', () => {
  it('YearEndDeclaration_ServerGivesTheReasons_ShowsEachWithItsCounts_AndNoRestrictedRow', async () => {
    renderPage();

    const [milano] = await screen.findAllByTestId('year-end-declaration-comune');
    const items = within(within(milano).getByTestId('year-end-declaration-exemptions')).getAllByRole('listitem');

    // The reasons of the server, each with the guests, the stays and the nights of the guests it counts, in the order the server gave them.
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent(`${label('reports.touristTax.yearEnd.declaration.exemptionReason.minor_age')} 1 ospite · 1 soggiorno · 3 notti-ospite`);
    expect(items[1]).toHaveTextContent(`${reasonWords('health_care')} 1 ospite · 1 soggiorno · 3 notti-ospite`);
    expect(items[2]).toHaveTextContent(`${reasonWords('resident')} 2 ospiti · 1 soggiorno · 2 notti-ospite`);
    expect(items[3]).toHaveTextContent(`${reasonWords('erased')} 1 ospite · 1 soggiorno · 2 notti-ospite`);
    expect(screen.queryByTestId('year-end-exemption-restricted')).toBeNull();
  });

  it('YearEndDeclaration_ServerGivesTheRestrictedRow_SaysItsSentenceAndCounts_AndTheDomHasNoReasonText', async () => {
    serve({ declaration: declarationOf(2026, {}, EXEMPTIONS_RESTRICTED) });
    const { container } = renderPage();

    const restricted = await screen.findByTestId('year-end-exemption-restricted');

    // The sentence of the brief and the counts of the other exempt guests; the age is told apart, as the server gives it to everybody.
    expect(restricted).toHaveTextContent('dettaglio dei motivi riservato');
    expect(restricted).toHaveTextContent('4 ospiti · 3 soggiorni · 7 notti-ospite');
    const [milano] = screen.getAllByTestId('year-end-declaration-comune');
    expect(within(milano).getByTestId('year-end-declaration-exemptions')).toHaveTextContent(label('reports.touristTax.yearEnd.declaration.exemptionReason.minor_age'));

    // No reason in the page: not in its words, and not in an attribute (a code, a test id, a label).
    for (const code of SENSITIVE_REASON_CODES) {
      expect(container.textContent, `the words of «${code}»`).not.toContain(reasonWords(code));
      expect(container.innerHTML, `the code «${code}»`).not.toMatch(new RegExp(`\\b${code}\\b`));
    }
  });

  it('YearEndDeclaration_RestrictedInEnglish_HasItsOwnWords_AndNoReasonEither', async () => {
    await i18n.changeLanguage('en');
    serve({ declaration: declarationOf(2026, {}, EXEMPTIONS_RESTRICTED) });
    const { container } = renderPage();

    const restricted = await screen.findByTestId('year-end-exemption-restricted');

    expect(restricted).toHaveTextContent('reason detail restricted');
    expect(restricted).not.toHaveTextContent('dettaglio dei motivi riservato');
    for (const code of SENSITIVE_REASON_CODES) expect(container.textContent, `the words of «${code}»`).not.toContain(reasonWords(code));
  });

  it('YearEndDeclaration_ReasonsThePageHasNoWordsFor_AreWrittenAsTheServerGaveThem_NeverGuessed', async () => {
    serve({ declaration: declarationOf(2026, {}, [{ reason: 'a_reason_of_the_future', stays: 1, guests: 1, guestNights: 2 }]) });
    renderPage();

    const [milano] = await screen.findAllByTestId('year-end-declaration-comune');

    expect(within(milano).getByTestId('year-end-declaration-exemptions')).toHaveTextContent('a_reason_of_the_future 1 ospite · 1 soggiorno · 2 notti-ospite');
  });

  it('YearEndDeclaration_WhenThePageIsGone_TheReasonsAreNotKeptInMemory', async () => {
    // The default `gcTime` of a client: what the app keeps of a read nobody shows any more (the app's own is ten minutes).
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    renderPage(client);
    await screen.findByTestId('year-end-declaration-table');
    await screen.findByTestId('year-end-ticino-table');
    const kept = (kind: string) => client.getQueryCache().findAll({ queryKey: ['tourist-tax-summary', 'year-end', kind] }).length;
    expect([kept('declaration'), kept('ticino')]).toEqual([1, 1]);

    cleanup();

    // The declaration carries the reasons of the exemptions for a caller that holds `guest.read`: it is dropped as soon as no page shows it. The count of Ticino has none, and stays as long as the app keeps what it read.
    await waitFor(() => expect(kept('declaration')).toBe(0));
    expect(kept('ticino')).toBe(1);
  });
});

describe('the declaration to the comuni on screen (money rule: the figures of the server, in the currency of the answer, nothing added up here)', () => {
  it('YearEndDeclaration_EveryComune_ShowsTheFiguresOfTheServerInTheOrderOfTheColumns', async () => {
    renderPage();

    const [milano, roma] = await screen.findAllByTestId('year-end-declaration-comune');

    const [stays, nights, guests, owed, paid, balance, status] = cellsOf(within(milano).getByTestId('year-end-declaration-row'));
    expect(milano).toHaveTextContent('Milano');
    expect([stays, nights, guests].map((cell) => cell.textContent)).toEqual(['4', '9', '8']);
    expect(owed).toHaveTextContent('32.345,50 €');
    expect(paid).toHaveTextContent('20.000,00 €');
    expect(balance).toHaveTextContent('12.345,50 €');
    expect(status).toHaveTextContent(label('reports.touristTax.status.ToPay'));
    // The stay with no amount says the due amount may be incomplete, and is counted apart by its reason: never taken for a tax of zero.
    expect(within(milano).getByTestId('year-end-declaration-incomplete')).toHaveTextContent(label('reports.touristTax.incomplete'));
    expect(within(milano).getByTestId('year-end-declaration-taxed')).toHaveTextContent('3');
    expect(within(milano).getByTestId('year-end-declaration-without-amount')).toHaveTextContent(`${label('reports.touristTax.yearEnd.declaration.stayReason.exempt')} 1 soggiorno`);

    const [, , , romaOwed, romaPaid, romaBalance, romaStatus] = cellsOf(within(roma).getByTestId('year-end-declaration-row'));
    expect(roma).toHaveTextContent('Roma');
    expect([romaOwed, romaPaid, romaBalance].map((cell) => cell.textContent?.replace(/\s/g, ' '))).toEqual(['12.000,00 €', '12.000,00 €', '0,00 €']);
    expect(romaStatus).toHaveTextContent(label('reports.touristTax.status.Paid'));
    expect(within(roma).queryByTestId('year-end-declaration-incomplete')).toBeNull();
    // A comune with no stay without an amount and no exempt guest says so in words, not with an empty list.
    expect(within(roma).getByTestId('year-end-declaration-details')).toHaveTextContent(label('reports.touristTax.yearEnd.declaration.details.none'));
  });

  it('YearEndDeclaration_Totals_AreTheServers_NotTheSumOfTheRows', async () => {
    const declaration = declarationOf(2026);
    // Totals that are not the sum of the two comuni: whatever the page shows is what the server sent.
    serve({ declaration: { ...declaration, total: { ...declaration.total, stays: 99, nights: 98, guests: 97, owedCents: 9999999, paidCents: 1111111, balanceCents: -5, staysWithoutAmount: 0 } } });
    renderPage();

    const total = await screen.findByTestId('year-end-declaration-total');
    const [stays, nights, guests, owed, paid, balance] = cellsOf(total);

    expect([stays, nights, guests].map((cell) => cell.textContent)).toEqual(['99', '98', '97']);
    expect(owed).toHaveTextContent('99.999,99 €');
    expect(paid).toHaveTextContent('11.111,11 €');
    expect(balance).toHaveTextContent('-0,05 €');
    expect(total).not.toHaveTextContent('44.345,50');
  });

  it('YearEndFigures_Totals_AreTheServers_NotTheSumOfTheComuni', async () => {
    const full = summaryOf(2026);
    const milano = full.comuni[0]!;
    // Two comuni that add up to 14 nights, 44.345,50 due, 32.000,00 remitted and 12.345,50 left, and totals that do not: the figures at the top say what the server sent, and the note of an incomplete amount follows the
    // server's own count of the stays with no tax recorded.
    const roma = { ...milano, comune: 'Roma', nights: 5, owed: 12000, owedCents: 1200000, paid: 12000, paidCents: 1200000, balance: 0, balanceCents: 0, status: 'Paid' as const };
    serve({
      summary: (year) =>
        summaryOf(year, {
          comuni: [milano, roma],
          total: { ...full.total, nights: 98, owed: 99999.99, owedCents: 9999999, paid: 11111.11, paidCents: 1111111, balance: -0.05, balanceCents: -5, staysWithoutAmount: 0 },
        }),
    });
    renderPage();

    await screen.findByTestId('year-end-figures');

    expect(screen.getByTestId('year-end-nights')).toHaveTextContent('98');
    expect(screen.getByTestId('year-end-owed')).toHaveTextContent('99.999,99 €');
    expect(screen.getByTestId('year-end-paid')).toHaveTextContent('11.111,11 €');
    expect(screen.getByTestId('year-end-balance')).toHaveTextContent('-0,05 €');
    expect(screen.getByTestId('year-end-figures')).not.toHaveTextContent('44.345,50');
    expect(screen.queryByTestId('year-end-incomplete')).toBeNull();
  });

  it.each([
    ['EUR', '32.345,50 €', '12.000,00 €'],
    ['CHF', '32.345,50 CHF', '12.000,00 CHF'],
  ])('YearEndDeclaration_CurrencyOfTheAnswerIs%s_EveryAmountOfTheDeclarationAndOfTheAccountIsWrittenInIt', async (currency, milanoOwed, romaYear) => {
    serve({ declaration: declarationOf(2026, { currency }), account: (by) => agentAccountOf(2026, by, { currency }) });
    renderPage();

    const [milano] = await screen.findAllByTestId('year-end-declaration-comune');
    expect(cellsOf(within(milano).getByTestId('year-end-declaration-row'))[3]).toHaveTextContent(milanoOwed);
    expect(screen.queryByTestId('year-end-declaration-currency-missing')).toBeNull();

    // The account of the agent is in the currency of its own answer.
    const [, roma] = await screen.findAllByTestId('year-end-account-comune');
    expect(cellsOf(within(roma).getByTestId('year-end-account-year-row'))[3]).toHaveTextContent(romaYear);
  });

  it('YearEndDeclaration_AnswerWithNoCurrency_TheAmountsHaveNoSymbolAndASentenceSaysWhy', async () => {
    serve({ declaration: declarationOf(2026, { currency: '' }), account: (by) => agentAccountOf(2026, by, { currency: '' }) });
    renderPage();

    const [milano] = await screen.findAllByTestId('year-end-declaration-comune');
    const owed = cellsOf(within(milano).getByTestId('year-end-declaration-row'))[3];

    expect(owed).toHaveTextContent('32.345,50');
    expect(owed).not.toHaveTextContent('€');
    expect(screen.getByTestId('year-end-declaration-currency-missing')).toHaveTextContent(label('reports.touristTax.yearEnd.figures.currencyMissing'));
    await screen.findByTestId('year-end-account-table');
    expect(screen.getByTestId('year-end-account-currency-missing')).toHaveTextContent(label('reports.touristTax.yearEnd.figures.currencyMissing'));
  });

  it('YearEndDeclaration_AYearWithNoStayInItalyAndNoPayment_IsToldInWords_NotShownAsAnEmptyTable', async () => {
    serve({ declaration: declarationOf(2026, { comuni: [] }) });
    renderPage();

    expect(await screen.findByTestId('year-end-declaration-empty')).toHaveTextContent(label('reports.touristTax.yearEnd.declaration.empty', { year: 2026 }));
    expect(screen.queryByTestId('year-end-declaration-table')).toBeNull();
  });
});

describe('the account of the agent on screen (the figures of the server by comune and period, the cut of the file, the payments of the year)', () => {
  it('YearEndAccount_ByMonth_ShowsEachComuneWithItsMonthsAndTheLineOfTheYear_AndTheTotalOfTheServer', async () => {
    renderPage();

    const [milano, roma] = await screen.findAllByTestId('year-end-account-comune');

    // The rows are the server's, in its order: the months, then the line of the year.
    const months = within(milano).getAllByTestId('year-end-account-row');
    expect(months.map((row) => row.querySelector('th')?.textContent)).toEqual(['marzo 2026', 'aprile 2026']);
    const [stays, nights, guests, collected, remitted, balance] = cellsOf(months[0]);
    expect([stays, nights, guests].map((cell) => cell.textContent)).toEqual(['2', '5', '4']);
    expect(collected).toHaveTextContent('12.345,50 €');
    expect(remitted).toHaveTextContent('345,50 €');
    expect(balance).toHaveTextContent('12.000,00 €');
    // Only the month with a stay that has no tax recorded says the amount may be incomplete.
    expect(within(months[0]).queryByTestId('year-end-account-incomplete')).toBeNull();
    expect(within(months[1]).getByTestId('year-end-account-incomplete')).toBeInTheDocument();

    const year = within(milano).getByTestId('year-end-account-year-row');
    expect(year.querySelector('th')).toHaveTextContent(label('reports.touristTax.yearEnd.account.period.year', { year: 2026 }));
    expect(cellsOf(year)[3]).toHaveTextContent('32.345,50 €');
    expect(roma).toHaveTextContent('Roma');
    expect(within(roma).queryAllByTestId('year-end-account-row')).toHaveLength(0);

    const [, , , totalCollected, totalRemitted, totalBalance] = cellsOf(screen.getByTestId('year-end-account-total'));
    expect(totalCollected).toHaveTextContent('44.345,50 €');
    expect(totalRemitted).toHaveTextContent('32.000,00 €');
    expect(totalBalance).toHaveTextContent('12.345,50 €');
  });

  it('YearEndAccount_EveryPaymentOfTheYear_IsListedWithItsAmountComunePeriodDayAndReference', async () => {
    renderPage();

    const payments = within(await screen.findByTestId('year-end-account-remittances')).getAllByTestId('year-end-account-remittance');

    expect(payments).toHaveLength(3);
    expect(payments[0]).toHaveTextContent('345,50 €');
    expect(payments[0]).toHaveTextContent('Milano');
    expect(payments[1]).toHaveTextContent('19.654,50 €');
    expect(payments[1]).toHaveTextContent('Milano');
    expect(payments[1]).toHaveTextContent('F24-0001');
    expect(payments[2]).toHaveTextContent('12.000,00 €');
    expect(payments[2]).toHaveTextContent('Roma');
    // A payment with no reference says none: no empty «rif.».
    expect(payments[2]).not.toHaveTextContent('rif.');
  });

  it('YearEndAccount_TheCutIsOneChoiceForTheAccountOnScreenAndForItsFile', async () => {
    renderPage();
    await screen.findByTestId('year-end-account-table');

    fireEvent.change(screen.getByTestId('year-end-account-by'), { target: { value: 'quarter' } });

    expect(await screen.findByText('1º trimestre 2026')).toBeInTheDocument();
    expect(screen.getByText('2º trimestre 2026')).toBeInTheDocument();
    expect(screen.queryByText('marzo 2026')).toBeNull();
    expect(screen.getByTestId('year-end-agent-account-by')).toHaveValue('quarter');
    expect(get).toHaveBeenCalledWith('/tourist-tax/year-end/2026/agent-account', expect.objectContaining({ params: { by: 'quarter', format: 'json' } }));

    // The other way round: the control of the file cuts the account too.
    fireEvent.change(screen.getByTestId('year-end-agent-account-by'), { target: { value: 'month' } });

    expect(await screen.findByText('marzo 2026')).toBeInTheDocument();
    expect(screen.getByTestId('year-end-account-by')).toHaveValue('month');
  });

  it('YearEndAccount_NoRowAndNoPayment_AreToldInWords', async () => {
    serve({ account: (by) => agentAccountOf(2026, by, { rows: [], remittances: [] }) });
    renderPage();

    expect(await screen.findByTestId('year-end-account-empty')).toHaveTextContent(label('reports.touristTax.yearEnd.account.empty', { year: 2026 }));
    expect(screen.queryByTestId('year-end-account-table')).toBeNull();
    // The cut stays on the page: a person can still change it.
    expect(screen.getByTestId('year-end-account-by')).toBeEnabled();
  });

  it('YearEndAccount_RowsButNoPayment_SaysThereIsNoPaymentInsteadOfAnEmptyList', async () => {
    serve({ account: (by) => agentAccountOf(2026, by, { remittances: [] }) });
    renderPage();

    expect(await screen.findByTestId('year-end-account-remittances-empty')).toHaveTextContent(label('reports.touristTax.yearEnd.account.remittances.empty', { year: 2026 }));
    expect(screen.getByTestId('year-end-account-table')).toBeInTheDocument();
  });

  it('YearEndAccount_Total_IsTheServers_NotTheSumOfTheLinesOfTheYear', async () => {
    const account = agentAccountOf(2026);
    // Totals that are not the sum of the lines of the year of the two comuni (44.345,50 collected, 32.000,00 remitted, 6 stays): whatever the page shows is what the server sent, and the note of an incomplete amount follows
    // the server's own count of the stays with no tax recorded.
    serve({ account: (by) => agentAccountOf(2026, by, { total: { ...account.total, stays: 99, nights: 98, guests: 97, owedCents: 9999999, paidCents: 1111111, balanceCents: -5, staysWithoutAmount: 0 } }) });
    renderPage();

    const total = await screen.findByTestId('year-end-account-total');
    const [stays, nights, guests, collected, remitted, balance] = cellsOf(total);

    expect([stays, nights, guests].map((cell) => cell.textContent)).toEqual(['99', '98', '97']);
    expect(collected).toHaveTextContent('99.999,99 €');
    expect(remitted).toHaveTextContent('11.111,11 €');
    expect(balance).toHaveTextContent('-0,05 €');
    expect(total).not.toHaveTextContent('44.345,50');
    expect(within(total).queryByTestId('year-end-account-incomplete')).toBeNull();
  });
});

describe('the count of the nights in Ticino on screen (data rule: a property whose canton is not known is counted and marked, and the count never looks complete when it is not)', () => {
  it('YearEndTicino_UnknownCantons_ShowTheNoteWithTheCountOfTheServerAndMarkEachPropertyThatHasOne', async () => {
    const unknown = [ticinoUnknownProperty(), ticinoUnknownProperty({ propertyId: 'p-mendrisio', propertyName: 'Villa Comune Ignoto', city: 'Mendrisio', municipalityCode: '9999' })];
    serve({ ticino: ticinoOf(2026, { cantonUnknownCount: 2, properties: [ticinoProperty(), ...unknown] }) });
    renderPage();

    const note = await screen.findByTestId('year-end-ticino-unknown');

    // The count is the server's, and the note says where it is fixed: the Swiss municipality of the property.
    expect(note).toHaveTextContent(label('reports.touristTax.yearEnd.ticino.unknown.note', { count: 2 }));
    expect(note).toHaveTextContent('2 immobili');
    expect(within(note).getByRole('link')).toHaveAttribute('href', '/app/short-rent/properties');
    // Each property that has no known canton is marked in the table, and the one that has is not.
    const rows = screen.getAllByTestId('year-end-ticino-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).queryByTestId('year-end-ticino-canton-unknown')).toBeNull();
    for (const row of rows.slice(1)) expect(within(row).getByTestId('year-end-ticino-canton-unknown')).toHaveTextContent(label('reports.touristTax.yearEnd.ticino.unknown.marker'));
    expect(screen.getAllByTestId('year-end-ticino-canton-unknown')).toHaveLength(2);
  });

  it('YearEndTicino_OneUnknownCanton_SaysItInTheSingular', async () => {
    serve({ ticino: ticinoOf(2026, { cantonUnknownCount: 1, properties: [ticinoProperty(), ticinoUnknownProperty()] }) });
    renderPage();

    const note = await screen.findByTestId('year-end-ticino-unknown');

    expect(note).toHaveTextContent(label('reports.touristTax.yearEnd.ticino.unknown.note', { count: 1 }));
    expect(note).toHaveTextContent('1 immobile in Svizzera ha');
  });

  it('YearEndTicino_EveryCantonKnown_NoNoteAndNoMarker', async () => {
    renderPage();

    await screen.findByTestId('year-end-ticino-table');

    expect(screen.queryByTestId('year-end-ticino-unknown')).toBeNull();
    expect(screen.queryByTestId('year-end-ticino-canton-unknown')).toBeNull();
  });

  it('YearEndTicino_EachPropertyShowsTheNumbersOfTheServerAndItsTaxInItsOwnCurrency_AndTheDueDateIsTheServers', async () => {
    serve({ ticino: ticinoOf(2026, { properties: [ticinoProperty(), ticinoProperty({ propertyId: 'p-no-currency', propertyName: 'Casa Senza Valuta', currency: '', touristTax: 250 })] }) });
    renderPage();

    const [lugano, noCurrency] = await screen.findAllByTestId('year-end-ticino-row');

    expect(lugano).toHaveTextContent('Casa Lugano');
    expect(lugano).toHaveTextContent('Via Nassa 1, Lugano');
    const [stays, taxed, untaxed, withoutDocument, tax] = cellsOf(lugano);
    // A group is its stays and, under them, its nights.
    expect(stacked(stays)).toEqual(['3', '12 notti']);
    expect(stacked(taxed)).toEqual(['2', '9 notti']);
    expect(stacked(untaxed)).toEqual(['1', '3 notti']);
    expect(stacked(withoutDocument)).toEqual(['0', '0 notti']);
    expect(tax).toHaveTextContent('12.345,50 CHF');
    // A property whose answer names no currency: the figure alone, and a sentence that says why.
    expect(within(noCurrency).getByTestId('year-end-ticino-tax')).toHaveTextContent('250,00');
    expect(within(noCurrency).getByTestId('year-end-ticino-tax')).not.toHaveTextContent('CHF');
    expect(screen.getByTestId('year-end-ticino-currency-missing')).toHaveTextContent(label('reports.touristTax.yearEnd.ticino.currencyMissing'));
    expect(screen.getByTestId('year-end-ticino-due')).toHaveTextContent('5 gennaio 2027');
  });

  it('YearEndTicino_NoPropertyInTicino_IsToldInWords_NotShownAsAnEmptyTable', async () => {
    serve({ ticino: ticinoOf(2026, { properties: [] }) });
    renderPage();

    expect(await screen.findByTestId('year-end-ticino-empty')).toHaveTextContent(label('reports.touristTax.yearEnd.ticino.empty', { year: 2026 }));
    expect(screen.queryByTestId('year-end-ticino-table')).toBeNull();
  });
});

describe('the three results on screen, as a page', () => {
  it('YearEndDetails_WithTheRestrictedRowAndAnUnknownCanton_HasNoAccessibilityViolationAxeCanFind', async () => {
    serve({
      declaration: declarationOf(2026, {}, EXEMPTIONS_RESTRICTED),
      ticino: ticinoOf(2026, { cantonUnknownCount: 1, properties: [ticinoProperty(), ticinoUnknownProperty()] }),
    });
    const { container } = renderPage();
    await screen.findByTestId('year-end-exemption-restricted');
    await screen.findByTestId('year-end-account-table');
    await screen.findByTestId('year-end-ticino-unknown');

    await expectNoAxeViolations(container);
  });

  it('YearEndDetails_AnotherYearChosen_ShowsTheThreeResultsOfThatYear_NeverTheOnesOfTheOld', async () => {
    renderPage();
    await screen.findByTestId('year-end-declaration-table');

    let answer!: (value: unknown) => void;
    get.mockImplementation(async (path: string, config?: Params) => {
      if (path === '/tourist-tax/year-end/2025/ticino') return new Promise((resolve) => (answer = resolve));
      if (path === SUMMARY_PATH) return { status: 200, data: summaryOf(Number(config?.params?.from.slice(0, 4))), headers: {} };
      return { status: 200, data: yearEndJsonOf(path, config?.params), headers: {} };
    });
    fireEvent.change(screen.getByTestId('year-end-year'), { target: { value: '2025' } });

    // While the count of 2025 loads, the one of 2026 is not shown under it.
    await waitFor(() => expect(screen.queryByTestId('year-end-ticino-table')).toBeNull());
    expect(screen.getByTestId('year-end-ticino-data')).toHaveAttribute('aria-busy', 'true');
    // The section already carries the year that was chosen (its title is a heading: the row of the file has the same words, as a plain line).
    expect(screen.getByRole('heading', { name: label('reports.touristTax.yearEnd.ticino.title', { year: 2025 }) })).toBeInTheDocument();

    answer({ status: 200, data: ticinoOf(2025), headers: {} });
    expect(await screen.findByTestId('year-end-ticino-table')).toBeInTheDocument();
    expect(screen.getByTestId('year-end-ticino-due')).toHaveTextContent('5 gennaio 2026');
  });
});
