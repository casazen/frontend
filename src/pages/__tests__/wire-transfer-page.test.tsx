import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import i18n from '@/i18n/config';
import { addDays, formatStayDate, todayInRome } from '@/lib/stay-dates';
import type { CreateBatchRequest, CreateBatchResponse, OwnerPayout, WireBatch, WireOwner } from '@/types';
import { WireTransferPage } from '../WireTransferPage';
import { deferred, file, payout, problem, wireBatch, wireOwner } from './agency-money-fixtures';

const api = vi.hoisted(() => ({
  listBatches: vi.fn(),
  listPayouts: vi.fn(),
  listOwners: vi.fn(),
  createBatch: vi.fn(),
  downloadBatchFile: vi.fn(),
  confirmDownload: vi.fn(),
  confirmPaid: vi.fn(),
}));
const saved = vi.hoisted(() => vi.fn());
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }));
const plan = vi.hoisted(() => ({ isAgency: true, isLoading: false, failed: false }));
const planHook = vi.hoisted(() => vi.fn());

vi.mock('@/api/wireTransfer.api', () => ({ wireTransferApi: api }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: saved, withJsonErrorBody: async (error: unknown) => error }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: planHook }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const OWNER_A = 'a0000000-0000-4000-8000-0000000000a1';
const OWNER_B = 'b0000000-0000-4000-8000-0000000000b1';
const OWNER_C = 'c0000000-0000-4000-8000-0000000000c1';
const OWNERS: WireOwner[] = [
  wireOwner({ id: OWNER_A, name: 'Marta Rossi', ibanEnd: '•••• 3456' }),
  wireOwner({ id: OWNER_B, name: 'Luca Bianchi', ibanEnd: '•••• 7788' }),
  // The registry says this owner has no IBAN.
  wireOwner({ id: OWNER_C, name: 'Anna Verdi', ibanEnd: null }),
];

const CHF_A = payout({ id: 'c0000000-0000-4000-8000-000000000001', ownerId: OWNER_A, currency: 'CHF', netAmount: 1234.5 });
const CHF_B = payout({ id: 'c0000000-0000-4000-8000-000000000002', ownerId: OWNER_B, currency: 'CHF', netAmount: 800 });
const EUR_B = payout({ id: 'e0000000-0000-4000-8000-000000000003', ownerId: OWNER_B, currency: 'EUR', netAmount: 830.25 });
const CHF_NO_IBAN = payout({ id: 'c0000000-0000-4000-8000-000000000004', ownerId: OWNER_C, currency: 'CHF', netAmount: 410 });
const REVERSED = payout({ id: 'd0000000-0000-4000-8000-000000000005', ownerId: OWNER_A, currency: 'CHF', netAmount: 99, status: 'Reversed' });
const USD_A = payout({ id: 'f0000000-0000-4000-8000-000000000006', ownerId: OWNER_A, currency: 'USD', netAmount: 55 });
const NO_CURRENCY = payout({ id: '90000000-0000-4000-8000-000000000007', ownerId: OWNER_A, currency: '  ', netAmount: 7.5 });
const PAYOUTS: OwnerPayout[] = [CHF_A, CHF_B, EUR_B, CHF_NO_IBAN, REVERSED, USD_A, NO_CURRENCY];

const CHF_FILE = 'c1c1c1c1-0000-4000-8000-000000000001';
const EUR_FILE = 'e1e1e1e1-0000-4000-8000-000000000001';
const TODAY = todayInRome();

let batches: WireBatch[];
let router: ReturnType<typeof createMemoryRouter>;

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  router = createMemoryRouter(
    [
      { path: '/app/account/wire-transfers', element: createElement(WireTransferPage) },
      { path: '/app/account/owners/:ownerId/financial', element: createElement('p', null, 'owner page') },
    ],
    { initialEntries: ['/app/account/wire-transfers'] },
  );
  render(createElement(QueryClientProvider, { client }, createElement(RouterProvider, { router })));
  return client;
}

/** The row of a payout, by its test id: while a confirmation is open the page behind it is hidden from the queries by role. */
const rowOf = (item: { id: string }) => screen.getByTestId(`wire-payout-${item.id}`);
const checkboxOf = (item: { id: string }) => rowOf(item).querySelector('input[type="checkbox"]') as HTMLInputElement;
const cardOf = (batchId: string) => screen.getByTestId(`wire-batch-${batchId}`);
/** A 404 that carries no code of its own: the page must say «not found» in its own words, not the server's. */
const gone = () => problem(404, '');
const serverFailure = () => Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } });

/** Chooses the payouts and asks for the files: the confirmation is open and nothing was sent yet. */
async function askForTheFiles(items: Array<{ id: string }> = [CHF_A]) {
  await screen.findByTestId(`wire-payout-${items[0].id}`);
  for (const item of items) fireEvent.click(checkboxOf(item));
  await waitFor(() => expect(screen.getByTestId('wire-create')).toBeEnabled());
  fireEvent.click(screen.getByTestId('wire-create'));
  return screen.findByRole('dialog');
}

const confirmButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Crea i file per la banca' });

/** The files are made: the notice of the first currency is on the page. */
async function makeTheFiles(items: Array<{ id: string }> = [CHF_A], currency = 'CHF') {
  const dialog = await askForTheFiles(items);
  fireEvent.click(confirmButton(dialog));
  return screen.findByTestId(`wire-created-${currency}`);
}

const statusOf = (batchId: string) => within(cardOf(batchId)).getByTestId('wire-batch-status').getAttribute('data-status');
const setStatus = (batchId: string, status: WireBatch['status']) => {
  batches = batches.map((batch) => (batch.id === batchId ? { ...batch, status } : batch));
};

/** What the server does with a request to create a file: it makes the batch, which the list then shows. */
function serverMakesTheBatch(request: CreateBatchRequest): CreateBatchResponse {
  const items = PAYOUTS.filter((item) => request.payoutIds.includes(item.id));
  const currency = items[0].currency;
  const id = currency === 'CHF' ? CHF_FILE : EUR_FILE;
  const totalAmount = Math.round(items.reduce((sum, item) => sum + item.netAmount * 100, 0)) / 100;
  batches = [wireBatch({ id, currency, totalAmount, transferCount: items.length, executionDate: request.executionDate }), ...batches];
  return { batchId: id, currency, totalAmount, transferCount: items.length, executionDate: request.executionDate, format: null };
}

beforeEach(async () => {
  vi.resetAllMocks();
  batches = [];
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  Object.assign(plan, { isAgency: true, isLoading: false, failed: false });
  planHook.mockImplementation(() => ({ ...plan, retry: vi.fn() }));
  await i18n.changeLanguage('it');
  api.listPayouts.mockImplementation(async () => PAYOUTS);
  api.listOwners.mockImplementation(async () => OWNERS);
  api.listBatches.mockImplementation(async () => batches);
  api.createBatch.mockImplementation(async (request: CreateBatchRequest) => serverMakesTheBatch(request));
  api.downloadBatchFile.mockImplementation(async (batchId: string) => {
    // The server marks the batch as downloaded the first time it hands the file out.
    if (batches.find((batch) => batch.id === batchId)?.status === 'Generated') setStatus(batchId, 'Downloaded');
    return file(`attachment; filename="wire-batch-${batchId.replace(/-/g, '')}-CHF-20261114.xml"`);
  });
  api.confirmDownload.mockImplementation(async (batchId: string) => setStatus(batchId, 'Downloaded'));
  api.confirmPaid.mockImplementation(async (batchId: string) => setStatus(batchId, 'Paid'));
});

afterEach(() => cleanup());

describe('the wire page asks the role before it reads anything (agency.wire.manage: owner and administrators)', () => {
  it.each(['org_manager', 'org_accountant'])('WirePage_MemberOfTheOrgThatIsNotOwnerOrAdministrator_%s_NoQueryAndTheWayToTheAdministrator', (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(screen.getByTestId('agency-admin-required')).toBeInTheDocument();
    expect(api.listPayouts).not.toHaveBeenCalled();
    expect(api.listOwners).not.toHaveBeenCalled();
    expect(api.listBatches).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wire-compose')).not.toBeInTheDocument();
    // The plan is read from an endpoint of the billing administrator: for anyone else it is not even asked.
    expect(planHook).not.toHaveBeenCalled();
  });

  it.each(['org_owner', 'org_admin'])('WirePage_%s_ReadsThePayoutsTheOwnersAndTheBatches', async (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(await screen.findByTestId(`wire-payout-${CHF_A.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId('agency-admin-required')).not.toBeInTheDocument();
    expect(api.listPayouts).toHaveBeenCalledTimes(1);
    expect(api.listOwners).toHaveBeenCalledTimes(1);
    expect(api.listBatches).toHaveBeenCalledTimes(1);
  });

  it('WirePage_OrgNotOnTheAgencyPlan_SaysSoAndNothingIsRead', () => {
    plan.isAgency = false;

    renderPage();

    expect(screen.getByTestId('agency-plan-required')).toHaveTextContent('Serve il piano Agenzia');
    expect(screen.getByRole('link', { name: 'Vai al piano' })).toHaveAttribute('href', '/app/account/billing');
    expect(api.listPayouts).not.toHaveBeenCalled();
    expect(api.listBatches).not.toHaveBeenCalled();
  });

  it('WirePage_PlanStillOnItsWay_WaitsAndNothingIsRead_NeverSaysNotOnThePlan', () => {
    plan.isAgency = false;
    plan.isLoading = true;

    renderPage();

    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(screen.getByText('Caricamento bonifici...')).toBeInTheDocument();
    expect(api.listPayouts).not.toHaveBeenCalled();
  });

  it('WirePage_ServerRefusesARead_TheAccessIsNotThere_TheAppStaysAndNothingIsOffered', async () => {
    api.listBatches.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByTestId('agency-access-refused')).toHaveTextContent('Questa pagina non è disponibile per il tuo accesso');
    expect(screen.queryByTestId('wire-compose')).not.toBeInTheDocument();
  });
});

describe('what the page offers is what the server accepts', () => {
  it('WirePage_OnlyConfirmedPayoutsAreOffered_ByCurrency_EachAmountInItsOwnCurrency_WithTheEndOfTheIban', async () => {
    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.id}`);
    // A reversed payout is never offered (`wire_payouts_not_confirmed`).
    expect(screen.queryByTestId(`wire-payout-${REVERSED.id}`)).not.toBeInTheDocument();
    expect(within(screen.getByTestId('wire-group-CHF')).getByRole('heading', { name: 'Pagamenti in CHF' })).toBeInTheDocument();
    expect(rowOf(CHF_A)).toHaveTextContent('Marta Rossi');
    expect(rowOf(CHF_A)).toHaveTextContent('Pagamento del 10 novembre 2026');
    expect(within(rowOf(CHF_A)).getByTestId('wire-payout-amount')).toHaveTextContent(/^1234,50\s*CHF$/);
    expect(within(rowOf(EUR_B)).getByTestId('wire-payout-amount')).toHaveTextContent(/^830,25\s*€$/);
    expect(rowOf(CHF_A).textContent).not.toContain('€');
    expect(within(rowOf(CHF_A)).getByTestId('wire-payout-iban')).toHaveTextContent('IBAN •••• 3456');
    expect(checkboxOf(CHF_A)).toBeEnabled();
    expect(checkboxOf(EUR_B)).toBeEnabled();
  });

  it('WirePage_PayoutsThatNoFileCanPay_AreShownAndCannotBeChosen_WithTheReason', async () => {
    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.id}`);
    // A currency with no wire file (`wire_currency_not_supported`).
    expect(checkboxOf(USD_A)).toBeDisabled();
    expect(screen.getByTestId('wire-group-USD')).toHaveTextContent('i pagamenti in USD non si pagano con questo file');
    // A payout that carries no currency is told as such: no symbol is made up for it.
    expect(checkboxOf(NO_CURRENCY)).toBeDisabled();
    expect(within(rowOf(NO_CURRENCY)).getByTestId('wire-payout-amount')).toHaveTextContent(/^7,50\s*\(valuta non indicata\)$/);
    expect(rowOf(NO_CURRENCY).textContent).not.toMatch(/€|CHF|USD/);
    // An owner without an IBAN cannot be paid: the server refuses the whole file for it (`wire_owner_iban_missing`).
    expect(checkboxOf(CHF_NO_IBAN)).toBeDisabled();
    expect(within(rowOf(CHF_NO_IBAN)).getByRole('link', { name: 'Apri i dati finanziari' })).toHaveAttribute('href', `/app/account/owners/${OWNER_C}/financial`);
    expect(within(rowOf(CHF_NO_IBAN)).queryByTestId('wire-payout-iban')).not.toBeInTheDocument();
  });

  it('WirePage_NoPayoutToPay_SaysSoWithTheWayToTheMonthEndClose_InsteadOfAnEmptyForm', async () => {
    api.listPayouts.mockResolvedValue([REVERSED]);

    renderPage();

    expect(await screen.findByText('Nessun pagamento da inviare in banca')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vai alla chiusura mensile' })).toHaveAttribute('href', '/app/account/owner-close');
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();
  });

  it('WirePage_ChooseAllOfACurrency_ChoosesOnlyWhatCanBePaid_AndTheSummaryNamesEachCurrency', async () => {
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.id}`);

    fireEvent.click(screen.getByTestId('wire-select-group-CHF'));
    fireEvent.click(checkboxOf(EUR_B));

    expect(checkboxOf(CHF_A)).toBeChecked();
    expect(checkboxOf(CHF_B)).toBeChecked();
    expect(checkboxOf(CHF_NO_IBAN)).not.toBeChecked();
    expect(screen.getByTestId('wire-selection')).toHaveTextContent('2 pagamenti scelti in CHF · 1 pagamento scelto in EUR');
    // The page adds up nothing: the total is the server's, once it made the file.
    expect(screen.getByTestId('wire-compose').textContent).not.toMatch(/totale/i);

    fireEvent.click(screen.getByTestId('wire-select-group-CHF'));
    expect(checkboxOf(CHF_A)).not.toBeChecked();
    expect(screen.getByTestId('wire-selection')).toHaveTextContent('1 pagamento scelto in EUR');
  });

  it('WirePage_PayoutsListNotFound_IsNotFoundWhateverTheCacheHolds', async () => {
    const client = renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.id}`);

    api.listPayouts.mockRejectedValueOnce(gone());
    await client.invalidateQueries({ queryKey: ['wire-transfers', 'payouts'] });

    expect(await screen.findByText('Pagamenti non trovati')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();
  });
});

describe('making the files (one for each currency, from confirmed payouts, debited from the account of the issuer profile)', () => {
  it('WirePage_Create_AsksToConfirmFirst_NamingEachFileAndTheDay_AndSendsNothingUntilConfirmed_NeverAsksForAnAccount', async () => {
    renderPage();
    expect(await screen.findByLabelText('Giorno di esecuzione')).toHaveValue(TODAY);
    // The debit account is the issuer profile's: the page never asks for one.
    expect(screen.queryByLabelText(/conto di addebito/i)).not.toBeInTheDocument();
    const later = addDays(TODAY, 10);
    fireEvent.change(screen.getByLabelText('Giorno di esecuzione'), { target: { value: later } });

    const dialog = await askForTheFiles([CHF_A, CHF_B, EUR_B]);

    expect(dialog).toHaveTextContent(`Stai per creare 2 file per la banca, uno per valuta, da eseguire il ${formatStayDate(later, 'it-IT')}.`);
    expect(within(dialog).getByTestId('wire-confirm-files')).toHaveTextContent('CHF: 2 bonifici');
    expect(within(dialog).getByTestId('wire-confirm-files')).toHaveTextContent('EUR: 1 bonifico');
    expect(api.createBatch).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(api.createBatch).not.toHaveBeenCalled();
  });

  it('WirePage_Create_OneRequestForEachCurrency_SendsThePayoutIdsAndTheDay_ShowsTheFilesAsTheServerAnswered_AndTheyLeaveTheList', async () => {
    const client = renderPage();

    await makeTheFiles([CHF_A, CHF_B, EUR_B]);

    expect(api.createBatch).toHaveBeenCalledTimes(2);
    const sent = api.createBatch.mock.calls.map(([request]) => request as CreateBatchRequest);
    expect(sent.map((request) => [...request.payoutIds].sort())).toEqual([[CHF_A.id, CHF_B.id].sort(), [EUR_B.id]]);
    expect(sent.every((request) => request.executionDate === TODAY)).toBe(true);
    // Nothing but the ids and the day is sent: no account, no statement.
    expect(sent.every((request) => Object.keys(request).sort().join() === 'executionDate,payoutIds')).toBe(true);
    // The files are what the server said, as it came: the number of transfers and the total in the currency of each.
    const chf = await screen.findByTestId('wire-created-CHF');
    expect(chf).toHaveTextContent('File in CHF creato: 2 bonifici.');
    expect(within(chf).getByTestId('wire-created-amount')).toHaveTextContent(/2034,50\s*CHF/);
    const eur = await screen.findByTestId('wire-created-EUR');
    expect(eur).toHaveTextContent('File in EUR creato: 1 bonifico.');
    expect(within(eur).getByTestId('wire-created-amount')).toHaveTextContent(/830,25\s*€/);
    // Not done yet: created, not downloaded, not paid; and the list of the files has them.
    await waitFor(() => expect(cardOf(CHF_FILE)).toBeInTheDocument());
    expect(statusOf(CHF_FILE)).toBe('Generated');
    expect(statusOf(EUR_FILE)).toBe('Generated');
    expect(screen.queryByTestId('wire-batch-paid')).not.toBeInTheDocument();
    // The payouts that went into a file are not offered again, and what is not chosen stays.
    expect(screen.queryByTestId(`wire-payout-${CHF_A.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${EUR_B.id}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`wire-payout-${CHF_NO_IBAN.id}`)).toBeInTheDocument();
    // The mutations are dropped as soon as nothing watches them: no request (and no payout) is kept.
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    // The confirmation closes once the server has answered every request, and the notices are next to the button the person used.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(screen.getByTestId('wire-compose')).getByTestId('wire-created-CHF')).toBeInTheDocument();
  });

  it('WirePage_Create_WhileTheRequestsAreOnTheirWay_NothingCanBeSentTwice_AndNothingCanBeChanged', async () => {
    const request = deferred<CreateBatchResponse>();
    api.createBatch.mockReturnValue(request.promise);
    renderPage();

    const dialog = await askForTheFiles([CHF_A]);
    const confirm = confirmButton(dialog);
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(api.createBatch).toHaveBeenCalledTimes(1);
    expect(checkboxOf(EUR_B)).toBeDisabled();
    expect(screen.getByLabelText('Giorno di esecuzione', { selector: 'input' })).toBeDisabled();

    request.resolve({ batchId: CHF_FILE, currency: 'CHF', totalAmount: 1234.5, transferCount: 1 });
    await screen.findByTestId('wire-created-CHF');
    expect(api.createBatch).toHaveBeenCalledTimes(1);
  });

  it('WirePage_OwnersCannotBePaid_AreToldOneByOne_WithTheLinkToTheirFinancialPage_AndNothingIsShownAsDone', async () => {
    api.createBatch.mockRejectedValue(problem(422, 'wire_owner_address_missing', { ownerIds: [OWNER_A, OWNER_B] }));
    renderPage();

    const dialog = await askForTheFiles([CHF_A, CHF_B]);
    fireEvent.click(confirmButton(dialog));

    const refused = await screen.findByTestId('wire-refused-CHF');
    expect(refused).toHaveTextContent('File in CHF non creato');
    expect(refused).toHaveTextContent("A questi proprietari manca l'indirizzo completo");
    // The owners the server listed, by name (the server only sends their ids), each with the way to complete the data.
    const marta = within(refused).getByTestId(`wire-owner-problem-${OWNER_A}`);
    expect(marta).toHaveTextContent('Marta Rossi');
    expect(within(marta).getByRole('link', { name: 'Apri i dati finanziari' })).toHaveAttribute('href', `/app/account/owners/${OWNER_A}/financial`);
    expect(within(refused).getByTestId(`wire-owner-problem-${OWNER_B}`)).toHaveTextContent('Luca Bianchi');
    // No file exists: no success, no card, and the choice stays so that the person fixes the owners and tries again.
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`wire-batch-${CHF_FILE}`)).not.toBeInTheDocument();
    expect(checkboxOf(CHF_A)).toBeChecked();
    expect(screen.getByTestId('wire-create')).toBeEnabled();
  });

  it('WirePage_OneCurrencyRefusedAndTheOtherMade_EachIsToldOnItsOwn_TheRefusedChoiceStays', async () => {
    api.createBatch.mockImplementation(async (request: CreateBatchRequest) => {
      if (request.payoutIds.includes(CHF_A.id)) throw problem(422, 'wire_owner_iban_missing', { ownerIds: [OWNER_A] });
      return serverMakesTheBatch(request);
    });
    renderPage();

    await makeTheFiles([CHF_A, EUR_B], 'EUR');

    expect(await screen.findByTestId('wire-refused-CHF')).toHaveTextContent('A questi proprietari manca l\'IBAN');
    expect(screen.getByTestId('wire-created-EUR')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    expect(checkboxOf(CHF_A)).toBeChecked();
    expect(screen.queryByTestId(`wire-payout-${EUR_B.id}`)).not.toBeInTheDocument();
  });

  it('WirePage_SchemaNotInstalled_SaysTheWireTransfersCannotBeSwitchedOnYet_NotASuccessNotAGenericError', async () => {
    api.createBatch.mockRejectedValue(problem(422, 'wire_batch_schema_unavailable'));
    renderPage();

    const dialog = await askForTheFiles();
    fireEvent.click(confirmButton(dialog));

    const notice = await screen.findByTestId('wire-refused-CHF');
    expect(notice).toHaveTextContent('I bonifici non sono ancora attivabili');
    expect(notice).toHaveTextContent('manca il file di controllo, lo aggiunge un operatore');
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    expect(screen.queryByText(/creato con successo/i)).not.toBeInTheDocument();
    expect(checkboxOf(CHF_A)).toBeChecked();
  });

  it.each([
    ['payouts_already_in_batch', /già in un file per la banca/],
    ['wire_payouts_not_published', /dopo la pubblicazione del rendiconto/],
    ['wire_debtor_incomplete', /Mancano il nome o l'indirizzo completo .* della tua agenzia/],
    ['wire_debit_account_missing', /Manca l'IBAN della tua agenzia/],
    ['wire_execution_date_invalid', /oggi o più avanti/],
    ['wire_batch_xml_invalid', /non supera il controllo del formato/],
    ['wire_batch_from_statement_retired', /dai pagamenti confermati/],
  ])('WirePage_Create_Refusal_%s_IsToldInWordsAndNothingIsShownAsDone', async (code, words) => {
    api.createBatch.mockRejectedValue(problem(422, code));
    renderPage();

    const dialog = await askForTheFiles();
    fireEvent.click(confirmButton(dialog));

    expect(await screen.findByTestId('wire-refused-CHF')).toHaveTextContent(words);
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wire-owner-problems')).not.toBeInTheDocument();
  });

  it('WirePage_Create_LostConnection_IsTold_NeverAsADoneFile_AndTheListIsReadAgain', async () => {
    api.createBatch.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.id}`);
    expect(api.listBatches).toHaveBeenCalledTimes(1);

    const dialog = await askForTheFiles();
    fireEvent.click(confirmButton(dialog));

    expect(await screen.findByTestId('wire-refused-CHF')).toHaveTextContent('Impossibile contattare il server');
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    // The answer may have been lost after the file was made: the list of the files is read again, so the person sees what is there.
    await waitFor(() => expect(api.listBatches).toHaveBeenCalledTimes(2));
  });

  it('WirePage_ExecutionDateInThePast_NothingCanBeCreated_AndTheHintSaysWhy', async () => {
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.id}`);
    fireEvent.click(checkboxOf(CHF_A));
    await waitFor(() => expect(screen.getByTestId('wire-create')).toBeEnabled());

    fireEvent.change(screen.getByLabelText('Giorno di esecuzione'), { target: { value: '2020-01-01' } });

    expect(screen.getByTestId('wire-create')).toBeDisabled();
    expect(screen.getByText('Scegli un giorno da oggi in poi.')).toBeInTheDocument();
  });
});

describe('the files of the list and their steps (the administrator\'s word, never the bank\'s)', () => {
  it('WireBatchList_ShowsTheDateTheCurrencyTheCountTheTotalAndTheState_AsTheServerSaysThem_AndNoIban', async () => {
    batches = [
      wireBatch({ id: CHF_FILE, currency: 'CHF', totalAmount: 2034.5, transferCount: 2, status: 'Downloaded' }),
      // A file made before the payouts: no execution day and no message.
      wireBatch({ id: EUR_FILE, currency: 'EUR', totalAmount: 830.25, transferCount: 1, status: 'Paid', executionDate: null, format: null, paidAt: '2026-11-15T09:00:00Z' }),
    ];
    renderPage();

    const chf = await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    expect(within(chf).getByTestId('wire-batch-reference')).toHaveTextContent('WB-C1C1C1C1');
    expect(within(chf).getByTestId('wire-batch-currency')).toHaveTextContent('CHF');
    expect(within(chf).getByTestId('wire-batch-count')).toHaveTextContent('2');
    expect(within(chf).getByTestId('wire-batch-amount')).toHaveTextContent(/2034,50\s*CHF/);
    expect(within(chf).getByTestId('wire-batch-execution')).toHaveTextContent('20 novembre 2026');
    expect(within(chf).getByTestId('wire-batch-created')).toHaveTextContent('14 nov 2026');
    expect(statusOf(CHF_FILE)).toBe('Downloaded');
    expect(within(chf).getByTestId('wire-batch-status')).toHaveTextContent('File scaricato, non ancora segnato come pagato');
    const eur = cardOf(EUR_FILE);
    expect(within(eur).getByTestId('wire-batch-amount')).toHaveTextContent(/830,25\s*€/);
    expect(within(eur).getByTestId('wire-batch-execution')).toHaveTextContent('non indicata');
    expect(within(eur).getByTestId('wire-batch-paid')).toHaveTextContent("Segnato come pagato dall'amministratore il 15 nov 2026");
    expect(within(eur).getByTestId('wire-batch-paid')).toHaveTextContent('CasaZen non verifica che la banca abbia eseguito i bonifici');
    expect(within(eur).queryByTestId('wire-batch-confirm-paid')).not.toBeInTheDocument();
  });

  it('WireBatch_NoFileYet_SaysSo', async () => {
    renderPage();

    expect(await screen.findByText('Non hai ancora creato nessun file per la banca.')).toBeInTheDocument();
  });

  it('WireBatch_Download_GoesThroughTheApi_SavesUnderTheNameOfTheServer_AndTheListShowsTheStepTheServerSet', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    const client = renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    expect(statusOf(CHF_FILE)).toBe('Generated');

    fireEvent.click(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download'));

    await waitFor(() => expect(statusOf(CHF_FILE)).toBe('Downloaded'));
    expect(api.downloadBatchFile).toHaveBeenCalledWith(CHF_FILE);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0][1]).toBe(`wire-batch-${CHF_FILE.replace(/-/g, '')}-CHF-20261114.xml`);
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-paid')).toBeEnabled();
    // The file is not kept: the mutation returns nothing and is dropped.
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('WireBatch_Download_WithoutAHeaderTheNameIsRebuilt_AndAFailureIsToldNeverAsDone', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded' })];
    api.downloadBatchFile.mockResolvedValueOnce(file(null));
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download'));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(saved.mock.calls[0][1]).toBe(`wire-batch-${CHF_FILE}-CHF.xml`);

    api.downloadBatchFile.mockRejectedValueOnce(gone());
    await waitFor(() => expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download')).toBeEnabled());
    fireEvent.click(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download'));

    expect(await within(cardOf(CHF_FILE)).findByTestId('wire-batch-failure')).toHaveTextContent('Questo file dei bonifici non esiste più');
    expect(statusOf(CHF_FILE)).toBe('Downloaded');
  });

  it('WireBatch_ConfirmedDownloaded_OnlyWhileTheFileIsNotDownloaded_AndTheServerSetsTheStep', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    // Not paid before it is downloaded.
    expect(within(card).getByTestId('wire-batch-confirm-paid')).toBeDisabled();

    fireEvent.click(within(card).getByTestId('wire-batch-confirm-downloaded'));

    await waitFor(() => expect(statusOf(CHF_FILE)).toBe('Downloaded'));
    expect(api.confirmDownload).toHaveBeenCalledWith(CHF_FILE);
    expect(api.downloadBatchFile).not.toHaveBeenCalled();
    expect(within(cardOf(CHF_FILE)).queryByTestId('wire-batch-confirm-downloaded')).not.toBeInTheDocument();
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-paid')).toBeEnabled();
  });

  it('WireBatch_ConfirmedPaid_NeedsTheExactConfirmation_BatchCurrencyAmount_AndSendsNothingBeforeIt', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded', totalAmount: 2034.5, transferCount: 2 })];
    renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(card).getByTestId('wire-batch-confirm-paid'));
    const dialog = await screen.findByRole('dialog');

    // Which batch, which amount, which currency; and what it means: the administrator's word, final.
    expect(within(dialog).getByTestId('wire-confirm-summary')).toHaveTextContent('WB-C1C1C1C1');
    expect(within(dialog).getByTestId('wire-confirm-currency')).toHaveTextContent('CHF');
    expect(within(dialog).getByTestId('wire-confirm-amount')).toHaveTextContent(/2034,50\s*CHF/);
    expect(dialog).toHaveTextContent('CasaZen non sa se la banca ha eseguito i bonifici');
    expect(dialog).toHaveTextContent('Non si può annullare');
    expect(api.confirmPaid).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(api.confirmPaid).not.toHaveBeenCalled();
    expect(statusOf(CHF_FILE)).toBe('Downloaded');
  });

  it('WireBatch_ConfirmedPaid_IsPaidByTheAdministrator_NeverPaidByTheBank_AndCannotBeDoneTwice', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded' })];
    const client = renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(card).getByTestId('wire-batch-confirm-paid'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confermato pagato' }));

    await waitFor(() => expect(statusOf(CHF_FILE)).toBe('Paid'));
    expect(api.confirmPaid).toHaveBeenCalledTimes(1);
    expect(api.confirmPaid).toHaveBeenCalledWith(CHF_FILE);
    expect(cardOf(CHF_FILE)).toHaveTextContent("Segnato come pagato dall'amministratore");
    expect(cardOf(CHF_FILE)).toHaveTextContent('CasaZen non verifica che la banca abbia eseguito i bonifici');
    expect(cardOf(CHF_FILE).textContent).not.toMatch(/pagato dalla banca/i);
    expect(within(cardOf(CHF_FILE)).queryByTestId('wire-batch-confirm-paid')).not.toBeInTheDocument();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('WireBatch_RequestOnItsWay_EveryButtonOfTheCardWaits_AndTheSameConfirmationCannotBeSentTwice', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded' }), wireBatch({ id: EUR_FILE, currency: 'EUR', status: 'Downloaded' })];
    const request = deferred<undefined>();
    api.confirmPaid.mockImplementation((batchId: string) => {
      setStatus(batchId, 'Paid');
      return request.promise;
    });
    renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(card).getByTestId('wire-batch-confirm-paid'));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Confermato pagato' });
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(api.confirmPaid).toHaveBeenCalledTimes(1);
    // While it is on its way every button of the card waits, and the step shown is still the one the server last said.
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download')).toBeDisabled();
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-paid')).toBeDisabled();
    expect(statusOf(CHF_FILE)).toBe('Downloaded');
    // The other file is not held by it.
    expect(within(cardOf(EUR_FILE)).getByTestId('wire-batch-download')).toBeEnabled();

    request.resolve(undefined);
    await waitFor(() => expect(statusOf(CHF_FILE)).toBe('Paid'));
    expect(api.confirmPaid).toHaveBeenCalledTimes(1);
  });

  it('WireBatch_DownloadOnItsWay_TheOtherButtonsOfTheCardWait', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    const request = deferred<ReturnType<typeof file>>();
    api.downloadBatchFile.mockReturnValue(request.promise);
    renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(card).getByTestId('wire-batch-download'));

    await waitFor(() => expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download')).toBeDisabled());
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-downloaded')).toBeDisabled();
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-paid')).toBeDisabled();

    request.resolve(file(null));
    await waitFor(() => expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download')).toBeEnabled());
  });

  it('WireBatch_ServerSaysAlreadyPaid_TheServerWins_TheWordsSayItAndTheStepFollowsTheList', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded' })];
    api.confirmPaid.mockImplementation(async (batchId: string) => {
      // Someone else marked it as paid in the meantime.
      setStatus(batchId, 'Paid');
      throw problem(422, 'batch_already_paid');
    });
    renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(card).getByTestId('wire-batch-confirm-paid'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confermato pagato' }));

    await waitFor(() => expect(statusOf(CHF_FILE)).toBe('Paid'));
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-failure')).toHaveTextContent('già stato segnato come pagato');
  });

  it('WireBatch_PayoutReversedSinceTheFileWasMade_IsToldAndTheFileIsNeverShownAsDone', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    api.downloadBatchFile.mockRejectedValue(problem(422, 'wire_batch_payouts_reversed', { payoutIds: [CHF_A.id] }));
    renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(card).getByTestId('wire-batch-download'));

    expect(await within(cardOf(CHF_FILE)).findByTestId('wire-batch-failure')).toHaveTextContent('non caricarlo in banca');
    expect(statusOf(CHF_FILE)).toBe('Generated');
    expect(saved).not.toHaveBeenCalled();
  });

  it.each([
    ['a server failure', serverFailure(), /Impossibile segnare il file come pagato/],
    ['a lost connection', Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }), /Impossibile contattare il server/],
    ['a batch that is not there', gone(), /non esiste più o non è della tua organizzazione/],
  ])('WireBatch_ConfirmedPaid_%s_NeverShowsPaid_TheStepStaysDownloaded', async (_name, error, words) => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded' })];
    api.confirmPaid.mockRejectedValue(error);
    renderPage();
    const card = await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    fireEvent.click(within(card).getByTestId('wire-batch-confirm-paid'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confermato pagato' }));

    expect(await within(cardOf(CHF_FILE)).findByTestId('wire-batch-failure')).toHaveTextContent(words);
    expect(statusOf(CHF_FILE)).toBe('Downloaded');
    expect(within(cardOf(CHF_FILE)).queryByTestId('wire-batch-paid')).not.toBeInTheDocument();
    await waitFor(() => expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-paid')).toBeEnabled());
  });
});

describe('a read that fails with the last answer in memory is never drawn as if it were in order', () => {
  it('WireBatchList_UpdateFails_TheOldFiguresStayButSayTheyMayBeOutOfDate_AndRetryReadsAgain', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    const client = renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();

    api.listBatches.mockRejectedValueOnce(serverFailure());
    await client.invalidateQueries({ queryKey: ['wire-transfers', 'batches'] });

    const notice = await screen.findByTestId('read-not-updated');
    expect(notice).toHaveTextContent('Non è stato possibile aggiornare questi dati');
    expect(screen.getByTestId(`wire-batch-${CHF_FILE}`)).toBeInTheDocument();

    fireEvent.click(within(notice).getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument());
    expect(screen.getByTestId(`wire-batch-${CHF_FILE}`)).toBeInTheDocument();
  });

  it('WirePage_FirstReadOfTheBatchesFails_NoOldFiguresToDraw_SaysSoWithARetry_AndThePayoutsStayUsable', async () => {
    api.listBatches.mockRejectedValue(serverFailure());

    renderPage();

    expect(await screen.findByText('Impossibile caricare i file per la banca')).toBeInTheDocument();
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();
    expect(await screen.findByTestId(`wire-payout-${CHF_A.id}`)).toBeInTheDocument();
  });

  it('WirePage_FirstReadOfThePayoutsFails_NoOldFiguresToDraw_SaysSoWithARetry', async () => {
    api.listPayouts.mockRejectedValue(serverFailure());

    renderPage();

    expect(await screen.findByText('Impossibile caricare i pagamenti ai proprietari')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();
  });
});
