import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAccountInactiveHandler, setApiAuthHandlers, setApiForbiddenHandler, setApiOnboardingRequiredHandler } from '@/lib/axios';
import type { WireBatch, WirePayout } from '@/types';
import { WireTransferPage } from '../WireTransferPage';
import { wireBatch, wirePayout } from './agency-money-fixtures';
import { wireTransport, type WireReply, type WireRequest } from './wire-transport';

// These tests use the real client of the app, with its interceptors and its handlers of the 403, and the real wire API: only the transport is replaced. What they prove is what
// the wire page does with a refusal (a person limited to some properties), with the 403 of an account, with a failed read and with a «not found» when nothing of the reads is
// mocked, as in the browser, and what the reads that sit between the server and the screen (`readOrNull`, the cut of the payouts and of the batches) leave of the money rules.
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const CHF_A = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000001', ownerName: 'Marta Rossi', currency: 'CHF', amount: 1234.5 });
const EUR_B = wirePayout({ payoutId: 'e0000000-0000-4000-8000-000000000003', ownerName: 'Luca Bianchi', currency: 'EUR', amount: 830.25 });
const FILE = wireBatch({ id: 'c1c1c1c1-0000-4000-8000-000000000001', status: 'Downloaded', transferCount: 1, totalAmount: 1234.5 });

let reply: (request: WireRequest) => WireReply;
let requests: string[];
const onForbidden = vi.fn();
const onAccountInactive = vi.fn();
const onOnboardingRequired = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

/** The transport judges the status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise. */
const transport = wireTransport(
  (request) => reply(request),
  (line) => requests.push(line),
);

const PAYABLE = '/wire-transfers/payable-payouts';
const FILES = '/wire-transfers/batches';
const CREATE = '/wire-transfers/batch';
const FILE_PAYOUTS = `/wire-transfers/batch/${FILE.id}/payouts`;

/** The answers of a server that is in order: both payable lists, the list of the files and the payouts of the file. Each test changes what it needs. */
function serverInOrder({ path, currency }: WireRequest): WireReply {
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
  setApiAccountInactiveHandler(onAccountInactive);
  setApiOnboardingRequiredHandler(onOnboardingRequired);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
  setApiAccountInactiveHandler(null);
  setApiOnboardingRequiredHandler(null);
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

  // Only the two codes of the account are told otherwise (the next group): every other 403 stays the refusal in words, whatever its body. A code of the server that is not one of the
  // account (`forbidden`), and the page of HTML that a proxy or a firewall serves (no code at all), must neither run a handler of the account nor become a failure of the read.
  it.each([
    { name: 'a code that is not one of the account', body: { code: 'forbidden' } },
    { name: 'the page of HTML of a proxy or a firewall', body: '<!doctype html><html><head><title>403 Forbidden</title></head><body><h1>Forbidden</h1></body></html>' },
  ])('WirePage_Reads403WithAnyOtherBody_StaysTheRefusalInWords_NoHandlerOfTheAccountRuns ($name)', async ({ body }) => {
    reply = (request) => (request.path === PAYABLE || request.path === FILE_PAYOUTS ? { status: 403, data: body } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('wire-payouts-refused')).toHaveTextContent('Questi pagamenti non sono disponibili per il tuo accesso');
    // Not the handler of the deactivated account, not the one of the onboarding, not the no-access page; and not a failure of the read, nor the words of the account.
    expect(onAccountInactive).not.toHaveBeenCalled();
    expect(onOnboardingRequired).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wire-load-error')).toBeNull();
    expect(screen.queryByTestId('wire-load-error-CHF')).toBeNull();
    expect(screen.queryByTestId('wire-load-error-EUR')).toBeNull();
    expect(screen.queryByText('Il tuo account è stato disattivato.')).toBeNull();
    expect(screen.queryByText(/Completa l'attivazione dell'account/)).toBeNull();
    expect(screen.queryByTestId('wire-create')).toBeNull();

    // The payouts of a file are another read with the same rule: the refusal in the card, with no handler either.
    const panel = await openPayoutsOfTheFile();
    expect(await within(panel).findByTestId('wire-batch-payouts-refused')).toHaveTextContent('Questi pagamenti non sono disponibili per il tuo accesso');
    expect(within(panel).queryByTestId('wire-batch-payouts-error')).toBeNull();
    expect(onAccountInactive).not.toHaveBeenCalled();
    expect(onOnboardingRequired).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('theClientOfTheApp_A403OnAnyOtherRead_SendsTheAppToNoAccess', async () => {
    // The control of the tests above: the handler is wired and the transport rejects as the real one does, so its silence there is the doing of the wire reads.
    reply = () => ({ status: 403, data: '' });

    await expect(axiosInstance.get('/payments')).rejects.toBeDefined();

    expect(onForbidden).toHaveBeenCalledTimes(1);
  });
});

describe('the wire page and the 403 of the account (permission rule: a deactivated account and an unfinished onboarding go to their own page, never to the refusal in words)', () => {
  it.each([
    { code: 'account_inactive', handler: onAccountInactive, other: onOnboardingRequired, words: 'Il tuo account è stato disattivato.' },
    { code: 'onboarding_required', handler: onOnboardingRequired, other: onAccountInactive, words: "Completa l'attivazione dell'account" },
  ])('WirePage_Reads403OfTheAccount_RunsTheHandlerOfItsOwnPage_AndIsAFailureWithARetry_NeverTheRefusalInWords ($code)', async ({ code, handler, other, words }) => {
    reply = (request) => (request.path === PAYABLE || request.path === FILES ? { status: 403, data: { code } } : serverInOrder(request));

    renderPage();

    // Both lists of payouts and the list of the files: each one is a failure with a way to read again, told with the words of the account, and the app is sent where it has to go.
    const failure = await screen.findByTestId('wire-load-error');
    expect(failure).toHaveTextContent(words);
    expect(await screen.findByText('Impossibile caricare i file per la banca')).toBeInTheDocument();
    expect(within(screen.getByTestId('wire-batches')).getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
    expect(handler).toHaveBeenCalled();
    expect(other).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wire-payouts-refused')).toBeNull();
    expect(screen.queryByTestId('agency-access-refused')).toBeNull();
    expect(screen.queryByText('Questi pagamenti non sono disponibili per il tuo accesso')).toBeNull();
    expect(screen.queryByText('Non hai ancora creato nessun file per la banca.')).toBeNull();
    expect(screen.queryByTestId('wire-create')).toBeNull();
  });

  it('WireBatchPayouts_Read403WithTheCodeOfTheAccount_RunsItsHandler_AndIsAFailureNeverTheRefusalInWords', async () => {
    reply = (request) => (request.path === FILE_PAYOUTS ? { status: 403, data: { code: 'account_inactive' } } : serverInOrder(request));
    renderPage();

    const panel = await openPayoutsOfTheFile();

    expect(await within(panel).findByTestId('wire-batch-payouts-error')).toHaveTextContent('Il tuo account è stato disattivato.');
    expect(onAccountInactive).toHaveBeenCalled();
    expect(onOnboardingRequired).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(within(panel).queryByTestId('wire-batch-payouts-refused')).toBeNull();
  });

  it.each([
    { code: 'account_inactive', handler: onAccountInactive, other: onOnboardingRequired },
    { code: 'onboarding_required', handler: onOnboardingRequired, other: onAccountInactive },
  ])('theClientOfTheApp_A403OfTheAccountOnARejectedRead_RunsItsHandler ($code)', async ({ code, handler, other }) => {
    // The control of the tests above: the handlers are wired and the transport rejects as the real one does, so the handler that ran there is the doing of the wire reads.
    reply = () => ({ status: 403, data: { code } });

    await expect(axiosInstance.get('/payments')).rejects.toBeDefined();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
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
    // A page of the app served in place of the API (a rewrite that went wrong) answers 200 with HTML, and an answer with no body at all (axios gives `''`, never `undefined`)
    // is not a list either.
    reply = (request) => (request.path === PAYABLE ? { status: 200, data: request.currency === 'CHF' ? '<!doctype html><html></html>' : '' } : serverInOrder(request));

    renderPage();

    expect(await screen.findByTestId('wire-load-error')).toBeInTheDocument();
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).toBeNull();
    expect(screen.queryByTestId('wire-payouts-refused')).toBeNull();
  });

  it.each([
    ['a page of the app served in place of the API', '<!doctype html><html></html>'],
    ['an answer with no body (axios gives an empty text)', ''],
  ])('WirePage_ListOfTheFilesIs_%s_IsAFailureWithARetry_NeverACrashNorNoFiles_AndRetryReadsAgain', async (_name, body) => {
    let broken = true;
    reply = (request) => (request.path === FILES && broken ? { status: 200, data: body } : serverInOrder(request));

    renderPage();

    // The page does not crash and does not say «no files»: it says the list could not be read, with a way to read it again, and the payouts (another read) stay where they are.
    expect(await screen.findByText('Impossibile caricare i file per la banca')).toBeInTheDocument();
    expect(screen.queryByText('Non hai ancora creato nessun file per la banca.')).toBeNull();
    expect(screen.queryByTestId(`wire-batch-${FILE.id}`)).toBeNull();
    expect(await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();

    broken = false;
    fireEvent.click(within(screen.getByTestId('wire-batches')).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId(`wire-batch-${FILE.id}`)).toBeInTheDocument();
    expect(screen.queryByText('Impossibile caricare i file per la banca')).toBeNull();
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

describe('the money rules through the real client (the reads between the server and the screen keep them: what is in a file is not offered again, each currency has its own list, an IBAN is a yes or a no)', () => {
  it('WirePage_PayoutPutInAFile_LeavesTheListOfTheServer_AndAFreshPageDoesNotOfferItAgain', async () => {
    // A server that remembers what it did: the file takes its payouts out of the payable lists and goes into the list of the files.
    const made = wireBatch({ id: 'c2c2c2c2-0000-4000-8000-000000000002', status: 'Generated', transferCount: 1, totalAmount: 1234.5 });
    let payable: Record<'CHF' | 'EUR', WirePayout[]> = { CHF: [CHF_A], EUR: [EUR_B] };
    let files: WireBatch[] = [FILE];
    reply = (request) => {
      if (request.method === 'POST' && request.path === CREATE) {
        const { payoutIds } = request.body as { payoutIds: string[] };
        payable = {
          CHF: payable.CHF.filter((item) => !payoutIds.includes(item.payoutId)),
          EUR: payable.EUR.filter((item) => !payoutIds.includes(item.payoutId)),
        };
        files = [made, ...files];
        return { status: 200, data: { batchId: made.id, currency: 'CHF', totalAmount: 1234.5, transferCount: 1 } };
      }
      if (request.path === PAYABLE) return { status: 200, data: payable[request.currency === 'CHF' ? 'CHF' : 'EUR'] };
      if (request.path === FILES) return { status: 200, data: files };
      return serverInOrder(request);
    };
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    fireEvent.click(screen.getByTestId('wire-select-group-CHF'));
    await waitFor(() => expect(screen.getByTestId('wire-create')).toBeEnabled());

    fireEvent.click(screen.getByTestId('wire-create'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Crea i file per la banca' }));

    // The file is what the server answered, and the payout leaves the page: both lists were read again and the answer no longer has it.
    expect(await screen.findByTestId('wire-created-CHF')).toHaveTextContent('File in CHF creato: 1 bonifico.');
    await waitFor(() => expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeNull());
    expect(requests.filter((line) => line === `POST ${CREATE}`)).toHaveLength(1);

    // A fresh page, nothing in memory: what it offers is what the server lists now, and the payout in the file is not on it.
    cleanup();
    requests = [];
    renderPage();

    expect(await screen.findByTestId(`wire-payout-${EUR_B.payoutId}`)).toBeInTheDocument();
    expect(await screen.findByTestId(`wire-batch-${made.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeNull();
    expect(screen.queryByTestId('wire-group-CHF')).toBeNull();
    expect(requests).toContain(`GET ${PAYABLE}?currency=CHF`);
  });

  it('WirePage_OneAnswerThatMixesTheCurrencies_EachGroupShowsOnlyItsOwn_EachAmountInItsOwnCurrency', async () => {
    // One answer, given to both lists, that holds a franc payout and a euro one: the franc group takes the franc payout only, the euro group the euro one only.
    reply = (request) => (request.path === PAYABLE ? { status: 200, data: [CHF_A, EUR_B] } : serverInOrder(request));

    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    const chf = within(screen.getByTestId('wire-group-CHF'));
    const eur = within(screen.getByTestId('wire-group-EUR'));
    expect(chf.getByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
    expect(chf.queryByTestId(`wire-payout-${EUR_B.payoutId}`)).toBeNull();
    expect(eur.getByTestId(`wire-payout-${EUR_B.payoutId}`)).toBeInTheDocument();
    expect(eur.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeNull();
    expect(chf.getByTestId('wire-payout-amount')).toHaveTextContent(/^1234,50\s*CHF$/);
    expect(eur.getByTestId('wire-payout-amount')).toHaveTextContent(/^830,25\s*€$/);
  });

  it('WirePage_OneAnswerWithoutOwnerHasIban_BlocksThePayout_NeverOffersIt_AndNothingCanBeCreated', async () => {
    // A server that does not know the member: the payout is shown with the reason, and «yes» is only what the server said as a yes.
    const withoutTheMember: Partial<WirePayout> = { ...CHF_A };
    delete withoutTheMember.ownerHasIban;
    reply = (request) => (request.path === PAYABLE ? { status: 200, data: request.currency === 'CHF' ? [withoutTheMember] : [] } : serverInOrder(request));

    renderPage();

    const row = await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    expect(row.querySelector('input[type="checkbox"]')).toBeDisabled();
    expect(within(row).getByTestId('wire-payout-iban-badge')).toHaveTextContent('IBAN mancante');
    // Nothing a file can pay is on the page: no «choose all», and the button that asks for the files waits.
    expect(screen.queryByTestId('wire-select-group-CHF')).toBeNull();
    expect(screen.getByTestId('wire-create')).toBeDisabled();
  });
});
