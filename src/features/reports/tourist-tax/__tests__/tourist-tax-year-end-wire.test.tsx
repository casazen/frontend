import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { freezeClock, NOON_UTC } from '@/test/clock';
import { TouristTaxYearEndPage } from '../tourist-tax-year-end-page';
import { summaryOf, yearEndJsonOf } from './tourist-tax-year-end-fixtures';

const saved = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => false }) }));
vi.mock('@/lib/file-download', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/file-download')>()), saveBlobAs: saved }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));

vi.setConfig({ testTimeout: 30_000 });

type Reply = { status: number; data?: unknown };
interface Request {
  path: string;
  params: Record<string, string> | undefined;
}
let reply: (request: Request) => Reply;
let requests: string[];
const onForbidden = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

/** The transport judges the status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise. */
const transport: AxiosAdapter = async (config) => {
  const path = config.url ?? '';
  const params = config.params as Record<string, string> | undefined;
  requests.push(`${(config.method ?? 'get').toUpperCase()} ${path}${params ? `?${new URLSearchParams(params).toString()}` : ''}`);
  const { status, data } = reply({ path, params });
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
  if (config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

const SUMMARY = '/tourist-tax/summary';
const DECLARATION = '/tourist-tax/year-end/2026/declaration';
const ACCOUNT = '/tourist-tax/year-end/2026/agent-account';
const TICINO = '/tourist-tax/year-end/2026/ticino';

const fileOf = (): Reply => ({ status: 200, data: new Blob(['a;b'], { type: 'text/csv' }) });
const problem = (status: number, body: object): Reply => ({ status, data: new Blob([JSON.stringify(body)], { type: 'application/problem+json' }) });

const isJson = (request: Request) => request.params?.format === 'json';
const isFile = (request: Request) => !isJson(request);

function serverInOrder(request: Request): Reply {
  const { path, params } = request;
  if (path === SUMMARY) return { status: 200, data: summaryOf(Number(params?.from?.slice(0, 4))) };
  if (path.startsWith('/tourist-tax/year-end/')) return isJson(request) ? { status: 200, data: yearEndJsonOf(path, params) } : fileOf();
  return { status: 404, data: { code: 'not_found' } };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(createElement(MemoryRouter, null, createElement(QueryClientProvider, { client }, createElement(TouristTaxYearEndPage))));
  return client;
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  reply = serverInOrder;
  freezeClock(NOON_UTC);
  axiosInstance.defaults.adapter = transport;
  setApiAuthHandlers({ getAccessToken: async () => 'test-token' });
  setApiForbiddenHandler(onForbidden);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
});

describe('the year-end page and a 403 (permission rule: a refusal is told in the page, the app is not sent to the no-access page, and it is never an empty year or an empty file)', () => {
  it('YearEndPage_SummaryRefused403_SaysTheAccessIsNotThere_NoRedirectNoEmptyYear', async () => {
    reply = (request) => (request.path === SUMMARY ? { status: 403, data: '' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('year-end-refused')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.figures.refused'));
    // The shared handler of the 403 on a read is not called, and nothing of a declaration is drawn: not a year of zeros, not «no stay», not a failure with a retry.
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByTestId('year-end-figures')).toBeNull();
    expect(screen.queryByTestId('year-end-empty')).toBeNull();
    expect(screen.queryByTestId('year-end-error')).toBeNull();
    expect(screen.getByTestId('year-end-declaration-csv')).toBeEnabled();
  });

  it('YearEndFiles_Refused403_IsToldUnderTheFileAskedFor_NoRedirect_AndNothingIsSaved', async () => {
    reply = (request) => (request.path === DECLARATION && isFile(request) ? problem(403, { code: 'tourist_tax_year_end_needs_whole_org' }) : serverInOrder(request));
    renderPage();
    await screen.findByTestId('year-end-figures');

    fireEvent.click(screen.getByTestId('year-end-declaration-csv'));

    const failure = await screen.findByTestId('year-end-declaration-failure');
    expect(failure).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.files.noAccess'));
    expect(onForbidden).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(screen.queryByTestId('year-end-agent-account-failure')).toBeNull();
    expect(screen.queryByTestId('year-end-ticino-failure')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('year-end-declaration-csv')).toBeEnabled());
  });

  it('theClientOfTheApp_A403OnAnyOtherRead_SendsTheAppToNoAccess', async () => {
    reply = () => ({ status: 403, data: '' });

    await expect(axiosInstance.get('/payments')).rejects.toBeDefined();

    expect(onForbidden).toHaveBeenCalledTimes(1);
  });
});

describe('the year-end page and a failed read (a failure is told with a retry or under its file, never as «no stay» or as an empty file)', () => {
  it('YearEndPage_SummaryFailsWith500_IsAFailureWithARetry_NeverAnEmptyYear_AndRetryReadsAgain', async () => {
    let failing = true;
    reply = (request) => (request.path === SUMMARY && failing ? { status: 500, data: 'Internal error' } : serverInOrder(request));

    renderPage();

    const failure = await screen.findByTestId('year-end-error');
    expect(failure).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.figures.error'));
    expect(screen.queryByTestId('year-end-empty')).toBeNull();
    expect(screen.queryByTestId('year-end-figures')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();

    failing = false;
    fireEvent.click(within(failure).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('year-end-figures')).toBeInTheDocument();
    expect(screen.queryByTestId('year-end-error')).toBeNull();
  });

  it('YearEndPage_SummaryThatIsNotASummary_IsAFailure_NeverAnEmptyYear', async () => {
    reply = (request) => (request.path === SUMMARY ? { status: 200, data: '<!doctype html><html></html>' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('year-end-error')).toBeInTheDocument();
    expect(screen.queryByTestId('year-end-empty')).toBeNull();
    expect(screen.queryByTestId('year-end-figures')).toBeNull();
  });

  it('YearEndPage_SummaryNotFound404_IsNotFound_EvenWhenTheLastAnswerIsStillInTheCache', async () => {
    const client = renderPage();
    await screen.findByTestId('year-end-figures');

    reply = (request) => (request.path === SUMMARY ? { status: 404, data: '' } : serverInOrder(request));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['tourist-tax-summary'] });
    });

    expect(await screen.findByTestId('year-end-error')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.figures.notFound'));
    expect(screen.queryByTestId('year-end-figures')).toBeNull();
  });

  it('YearEndFiles_FailWith500_IsToldUnderTheFile_NeverAsAnEmptyFile_AndTheOtherFilesAreNotToldToFail', async () => {
    reply = (request) => (request.path === TICINO && isFile(request) ? problem(500, { title: 'Internal Server Error' }) : serverInOrder(request));
    renderPage();
    await screen.findByTestId('year-end-figures');

    fireEvent.click(screen.getByTestId('year-end-ticino-xlsx'));

    expect(await screen.findByTestId('year-end-ticino-failure')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.files.failed'));
    expect(saved).not.toHaveBeenCalled();
    expect(screen.queryByTestId('year-end-declaration-failure')).toBeNull();
    expect(screen.queryByTestId('year-end-agent-account-failure')).toBeNull();
  });

  it('YearEndFiles_ARefusalWithACode_IsToldInTheWordsOfTheCode', async () => {
    reply = (request) => (request.path === ACCOUNT && isFile(request) ? problem(400, { code: 'fiscal_report_period_invalid' }) : serverInOrder(request));
    renderPage();
    await screen.findByTestId('year-end-figures');

    fireEvent.click(screen.getByTestId('year-end-agent-account-csv'));

    expect(await screen.findByTestId('year-end-agent-account-failure')).toHaveTextContent(i18n.t('reports.touristTax.errors.reportPeriodInvalid'));
    expect(saved).not.toHaveBeenCalled();
  });

  it('YearEndFiles_AnAnswerThatIsAWebPageInsteadOfTheFile_IsAFailure_NotAFileToSave', async () => {
    reply = (request) => (request.path === DECLARATION && isFile(request) ? { status: 200, data: new Blob(['<!doctype html>'], { type: 'text/html' }) } : serverInOrder(request));
    renderPage();
    await screen.findByTestId('year-end-figures');

    fireEvent.click(screen.getByTestId('year-end-declaration-xlsx'));

    expect(await screen.findByTestId('year-end-declaration-failure')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.files.failed'));
    expect(saved).not.toHaveBeenCalled();
  });
});

describe('the figures of the year on screen (a refusal, a failed read, a «not found» and a server with no JSON yet are each told in their own words, and none is an empty section)', () => {
  it('YearEndDetails_AReadRefused403_IsToldUnderItsSection_NoRedirect_NoEmptySection_AndTheOthersAreNotAffected', async () => {
    reply = (request) => (request.path === DECLARATION && isJson(request) ? { status: 403, data: '' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('year-end-declaration-data-refused')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.details.noAccess'));
    // The shared handler of the 403 on a read is not called (a `ReportAccessDeniedError` is an answer), and nothing of a declaration is drawn: not a table, not «no stay», not a failure with a retry.
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByTestId('year-end-declaration-table')).toBeNull();
    expect(screen.queryByTestId('year-end-declaration-empty')).toBeNull();
    expect(screen.queryByTestId('year-end-declaration-data-error')).toBeNull();
    expect(await screen.findByTestId('year-end-account-table')).toBeInTheDocument();
    expect(await screen.findByTestId('year-end-ticino-table')).toBeInTheDocument();
    expect(screen.getByTestId('year-end-figures')).toBeInTheDocument();
    expect(screen.getByTestId('year-end-declaration-csv')).toBeEnabled();
  });

  it('YearEndDetails_AReadFailsWith500_IsAFailureWithARetryUnderItsSection_NeverAnEmptySection_AndRetryReadsAgain', async () => {
    let failing = true;
    reply = (request) => (request.path === TICINO && isJson(request) && failing ? { status: 500, data: 'Internal error' } : serverInOrder(request));

    renderPage();

    const failure = await screen.findByTestId('year-end-ticino-data-error');
    expect(failure).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.details.error'));
    expect(screen.queryByTestId('year-end-ticino-empty')).toBeNull();
    expect(screen.queryByTestId('year-end-ticino-table')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(await screen.findByTestId('year-end-declaration-table')).toBeInTheDocument();
    expect(screen.queryByTestId('year-end-declaration-data-error')).toBeNull();

    failing = false;
    fireEvent.click(within(failure).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('year-end-ticino-table')).toBeInTheDocument();
    expect(screen.queryByTestId('year-end-ticino-data-error')).toBeNull();
  });

  it('YearEndDetails_AnAnswerThatIsNotTheResult_IsAFailure_NeverAnEmptySection', async () => {
    reply = (request) => (request.path === ACCOUNT && isJson(request) ? { status: 200, data: '<!doctype html><html></html>' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('year-end-account-data-error')).toBeInTheDocument();
    expect(screen.queryByTestId('year-end-account-empty')).toBeNull();
    expect(screen.queryByTestId('year-end-account-table')).toBeNull();
  });

  it('YearEndDetails_AReadNotFound404_IsNotFound_EvenWhenTheLastAnswerIsStillInTheCache', async () => {
    const client = renderPage();
    await screen.findByTestId('year-end-declaration-table');

    reply = (request) => (request.path === DECLARATION && isJson(request) ? { status: 404, data: '' } : serverInOrder(request));
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['tourist-tax-summary'] });
    });

    expect(await screen.findByTestId('year-end-declaration-data-error')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.details.notFound'));
    expect(screen.queryByTestId('year-end-declaration-table')).toBeNull();
  });

  it('YearEndDetails_ServerWithNoJsonYet400ReportInvalidFormat_ShowsTheFilesAndOneLine_NoErrorAndNoSection', async () => {
    reply = (request) => (request.path.startsWith('/tourist-tax/year-end/') && isJson(request) ? { status: 400, data: { code: 'report_invalid_format' } } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('year-end-details-unavailable')).toHaveTextContent(i18n.t('reports.touristTax.yearEnd.details.unavailable'));
    // Not an error: no alert and no retry, no section of figures, and no refusal either.
    expect(screen.queryByRole('alert')).toBeNull();
    for (const section of ['year-end-declaration-data', 'year-end-account-data', 'year-end-ticino-data']) expect(screen.queryByTestId(section)).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(await screen.findByTestId('year-end-figures')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('year-end-declaration-csv')).toBeEnabled());
    fireEvent.click(screen.getByTestId('year-end-declaration-csv'));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
  });
});

describe('what the year-end page asks the server (the year, the format, the cut: nothing else in an address)', () => {
  const READS_AT_OPENING = [
    `GET ${SUMMARY}?from=2026-01-01&to=2026-12-31`,
    `GET ${ACCOUNT}?by=month&format=json`,
    `GET ${DECLARATION}?format=json`,
    `GET ${TICINO}?format=json`,
  ];

  it('YearEndPage_Opened_AsksTheSummaryOfTheYearAndTheJsonOfTheThreeResults_AndAFileOnlyWhenItsButtonIsPressed', async () => {
    renderPage();
    await screen.findByTestId('year-end-figures');
    await screen.findByTestId('year-end-ticino-table');
    await screen.findByTestId('year-end-account-table');
    await screen.findByTestId('year-end-declaration-table');

    expect([...requests].sort()).toEqual(READS_AT_OPENING);

    await waitFor(() => expect(screen.getByTestId('year-end-ticino-csv')).toBeEnabled());
    fireEvent.click(screen.getByTestId('year-end-ticino-csv'));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));

    expect([...requests].sort()).toEqual([...READS_AT_OPENING, `GET ${TICINO}?format=csv`].sort());
  });
});
