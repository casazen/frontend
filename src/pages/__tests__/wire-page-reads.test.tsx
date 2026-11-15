import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { WireTransferPage } from '../WireTransferPage';
import { wireBatch, wirePayout } from './agency-money-fixtures';

// These tests use the real client of the app, with its interceptors and its handler of the 403, and the real wire API: only the transport is replaced. What they prove is what
// the wire page does with a refusal (a person limited to some properties), with a failed read and with a «not found» when nothing of the reads is mocked, as in the browser.
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const CHF_A = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000001', ownerName: 'Marta Rossi', currency: 'CHF', amount: 1234.5 });
const EUR_B = wirePayout({ payoutId: 'e0000000-0000-4000-8000-000000000003', ownerName: 'Luca Bianchi', currency: 'EUR', amount: 830.25 });
const FILE = wireBatch({ id: 'c1c1c1c1-0000-4000-8000-000000000001', status: 'Downloaded', transferCount: 1, totalAmount: 1234.5 });

type Reply = { status: number; data?: unknown };
interface Request {
  method: string;
  path: string;
  currency: string | undefined;
}
let reply: (request: Request) => Reply;
let requests: string[];
const onForbidden = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

/** The transport judges the status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise. */
const transport: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const path = config.url ?? '';
  const currency = (config.params as { currency?: string } | undefined)?.currency;
  requests.push(`${method} ${path}${currency ? `?currency=${currency}` : ''}`);
  const { status, data } = reply({ method, path, currency });
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
  if (config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

const PAYABLE = '/wire-transfers/payable-payouts';
const FILES = '/wire-transfers/batches';
const FILE_PAYOUTS = `/wire-transfers/batch/${FILE.id}/payouts`;

/** The answers of a server that is in order: both payable lists, the list of the files and the payouts of the file. Each test changes what it needs. */
function serverInOrder({ path, currency }: Request): Reply {
  if (path === PAYABLE) return { status: 200, data: currency === 'CHF' ? [CHF_A] : [EUR_B] };
  if (path === FILES) return { status: 200, data: [FILE] };
  if (path === FILE_PAYOUTS) return { status: 200, data: { batch: FILE, payouts: [CHF_A] } };
  return { status: 404, data: { code: 'not_found' } };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const router = createMemoryRouter([{ path: '/app/account/wire-transfers', element: createElement(WireTransferPage) }], { initialEntries: ['/app/account/wire-transfers'] });
  render(createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router })));
  return client;
}

/** Opens the payouts of the file, once its card is on the page. */
async function openPayoutsOfTheFile() {
  const card = await screen.findByTestId(`wire-batch-${FILE.id}`);
  fireEvent.click(within(card).getByTestId('wire-batch-payouts-toggle'));
  return screen.findByTestId(`wire-batch-payouts-${FILE.id}`);
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  reply = serverInOrder;
  axiosInstance.defaults.adapter = transport;
  setApiAuthHandlers({ getAccessToken: async () => 'test-token' });
  setApiForbiddenHandler(onForbidden);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
});

describe('the wire page and a 403 (permission rule: a refusal is told in the page, the app is not sent to the no-access page, and it is never an empty list)', () => {
  it('WirePage_PayableReadsRefused403_SaysTheAccessIsNotThereWhereThePayoutsWouldBe_NoRedirectNoEmptyList', async () => {
    reply = (request) => (request.path === PAYABLE ? { status: 403, data: '' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('wire-payouts-refused')).toHaveTextContent('Questi pagamenti non sono disponibili per il tuo accesso');
    // The shared handler of the 403 on a read is not called, and nothing of the payouts is drawn: not an empty form, not «no payments to make», not an error with a retry.
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).toBeNull();
    expect(screen.queryByTestId('wire-create')).toBeNull();
    expect(screen.queryByTestId('wire-group-CHF')).toBeNull();
    expect(screen.queryByTestId('wire-load-error')).toBeNull();
    expect(screen.queryByTestId('agency-access-refused')).toBeNull();
    // The list of the files is another read with its own answer: the page stays where it is.
    expect(await screen.findByTestId(`wire-batch-${FILE.id}`)).toBeInTheDocument();
  });

  it('WirePage_ListOfTheFilesRefused403_IsTheAccessMessageOfThePage_NoRedirect', async () => {
    reply = (request) => (request.path === FILES ? { status: 403, data: '' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('agency-access-refused')).toBeInTheDocument();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wire-compose')).toBeNull();
  });

  it('WireBatchPayouts_Refused403_SaysTheAccessIsNotThereInTheCard_NoRedirectNoEmptyList', async () => {
    reply = (request) => (request.path === FILE_PAYOUTS ? { status: 403, data: '' } : serverInOrder(request));
    renderPage();

    const panel = await openPayoutsOfTheFile();

    expect(await within(panel).findByTestId('wire-batch-payouts-refused')).toHaveTextContent('Questi pagamenti non sono disponibili per il tuo accesso');
    expect(onForbidden).not.toHaveBeenCalled();
    expect(within(panel).queryByTestId('wire-batch-payouts-empty')).toBeNull();
    expect(within(panel).queryByTestId('wire-batch-payouts-error')).toBeNull();
    expect(within(panel).queryByTestId('wire-batch-payouts-count')).toBeNull();
  });

  it('theClientOfTheApp_A403OnAnyOtherRead_SendsTheAppToNoAccess', async () => {
    // The control of the tests above: the handler is wired and the transport rejects as the real one does, so its silence there is the doing of the wire reads.
    reply = () => ({ status: 403, data: '' });

    await expect(axiosInstance.get('/payments')).rejects.toBeDefined();

    expect(onForbidden).toHaveBeenCalledTimes(1);
  });
});

describe('the wire page and a failed read (a failure is told with a retry, never as «no payments to make»)', () => {
  it('WirePage_PayableReadsFailWith500_AreAFailureWithARetry_NeverNoPaymentsToMake_AndRetryReadsAgain', async () => {
    let failing = true;
    reply = (request) => (request.path === PAYABLE && failing ? { status: 500, data: 'Internal error' } : serverInOrder(request));

    renderPage();

    const failure = await screen.findByTestId('wire-load-error');
    expect(failure).toHaveTextContent('Impossibile caricare i pagamenti ai proprietari');
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).toBeNull();
    expect(screen.queryByTestId('wire-create')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();

    failing = false;
    fireEvent.click(within(failure).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
    expect(screen.getByTestId(`wire-payout-${EUR_B.payoutId}`)).toBeInTheDocument();
    expect(screen.queryByTestId('wire-load-error')).toBeNull();
  });

  it('WirePage_PayableReadThatIsNotAList_IsAFailure_NeverAnEmptyList', async () => {
    // A page of the app served in place of the API (a rewrite that went wrong) answers 200 with HTML, and an answer with no body at all is not a list either.
    reply = (request) => (request.path === PAYABLE ? { status: 200, data: request.currency === 'CHF' ? '<!doctype html><html></html>' : undefined } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('wire-load-error')).toBeInTheDocument();
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).toBeNull();
    expect(screen.queryByTestId('wire-payouts-refused')).toBeNull();
  });

  it('WirePage_PayableReadNotFound404_IsNotFound', async () => {
    reply = (request) => (request.path === PAYABLE ? { status: 404, data: '' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByText('Pagamenti non trovati')).toBeInTheDocument();
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).toBeNull();
    expect(screen.queryByTestId('wire-create')).toBeNull();
  });

  it('WireBatchPayouts_ReadFailsWith500_IsAFailureWithARetry_NeverAnEmptyList_AndRetryReadsAgain', async () => {
    let failing = true;
    reply = (request) => (request.path === FILE_PAYOUTS && failing ? { status: 500, data: 'Internal error' } : serverInOrder(request));
    renderPage();

    const panel = await openPayoutsOfTheFile();

    const failure = await within(panel).findByTestId('wire-batch-payouts-error');
    expect(failure).toHaveTextContent('Impossibile caricare i pagamenti di questo file');
    expect(within(panel).queryByTestId('wire-batch-payouts-empty')).toBeNull();
    failing = false;
    fireEvent.click(within(failure).getByRole('button', { name: 'Riprova' }));
    expect(await within(panel).findByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
  });

  it('WireBatchPayouts_ReadNotFound404_IsNotFound', async () => {
    reply = (request) => (request.path === FILE_PAYOUTS ? { status: 404, data: '' } : serverInOrder(request));
    renderPage();

    const panel = await openPayoutsOfTheFile();

    expect(await within(panel).findByTestId('wire-batch-payouts-error')).toHaveTextContent('non esiste più o non è della tua organizzazione');
  });
});

describe('what the wire page asks the server (one payable list per currency, and nothing personal in an address)', () => {
  it('WirePage_Opened_AsksOnePayableListForEachCurrencyAndTheFiles_NothingAboutAnOwnerInTheAddress_AndNothingForAFileNobodyOpened', async () => {
    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    await screen.findByTestId(`wire-batch-${FILE.id}`);

    expect([...requests].sort()).toEqual([`GET ${FILES}`, `GET ${PAYABLE}?currency=CHF`, `GET ${PAYABLE}?currency=EUR`].sort());
    // The franc payouts are in the franc group and the euro ones in the euro group: two lists that never mix.
    expect(within(screen.getByTestId('wire-group-CHF')).queryByTestId(`wire-payout-${EUR_B.payoutId}`)).toBeNull();
    expect(within(screen.getByTestId('wire-group-EUR')).queryByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeNull();

    // The payouts of the file are asked for once, when the person opens them, by the id of the file and nothing else.
    await openPayoutsOfTheFile();
    await waitFor(() => expect(requests.filter((request) => request === `GET ${FILE_PAYOUTS}`)).toHaveLength(1));
    expect(requests.some((request) => request.includes(CHF_A.ownerId) || request.includes(CHF_A.ownerName))).toBe(false);
  });
});
