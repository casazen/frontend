import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { isListCapped, WIRE_PAYABLE_LIST_CAP } from '@/components/finance/wire-model';
import i18n from '@/i18n/config';
import { addDays, formatStayDate, todayInRome } from '@/lib/stay-dates';
import type { CreateBatchRequest, CreateBatchResponse, WireBatch, WireBatchPayouts, WireCurrency, WirePayout } from '@/types';
import { WireTransferPage } from '../WireTransferPage';
import { deferred, file, problem, wireBatch, wirePayout } from './agency-money-fixtures';

const api = vi.hoisted(() => ({
  listBatches: vi.fn(),
  listPayablePayouts: vi.fn(),
  getBatchPayouts: vi.fn(),
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

// What the server lists as payable, by currency: the franc list holds franc payouts only, the euro list euro ones only.
const CHF_A = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000001', ownerId: OWNER_A, ownerName: 'Marta Rossi', currency: 'CHF', amount: 1234.5 });
const CHF_B = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000002', ownerId: OWNER_B, ownerName: 'Luca Bianchi', currency: 'CHF', amount: 800, periodMonth: 9 });
const EUR_B = wirePayout({ payoutId: 'e0000000-0000-4000-8000-000000000003', ownerId: OWNER_B, ownerName: 'Luca Bianchi', currency: 'EUR', amount: 830.25 });
// The server says this owner has no IBAN.
const CHF_NO_IBAN = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000004', ownerId: OWNER_C, ownerName: 'Anna Verdi', currency: 'CHF', amount: 410, ownerHasIban: false });
const REVERSED = wirePayout({ payoutId: 'd0000000-0000-4000-8000-000000000005', ownerId: OWNER_A, ownerName: 'Marta Rossi', currency: 'CHF', amount: 99, status: 'Reversed' });

const CHF_FILE = 'c1c1c1c1-0000-4000-8000-000000000001';
const EUR_FILE = 'e1e1e1e1-0000-4000-8000-000000000001';
const TODAY = todayInRome();

// The server of these tests: it keeps the payable payouts of each currency, the batches and the payouts of each batch, and moves a payout from the first to the last when it makes
// a batch, as the backend does (`payable-payouts` leaves out whatever is in a batch).
let batches: WireBatch[];
let payable: Record<WireCurrency, WirePayout[]>;
let batchPayouts: Record<string, WirePayout[]>;
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
const rowOf = (item: { payoutId: string }) => screen.getByTestId(`wire-payout-${item.payoutId}`);
const checkboxOf = (item: { payoutId: string }) => rowOf(item).querySelector('input[type="checkbox"]') as HTMLInputElement;
const cardOf = (batchId: string) => screen.getByTestId(`wire-batch-${batchId}`);
/** A 404 that carries no code of its own: the page must say «not found» in its own words, not the server's. */
const gone = () => problem(404, '');
const serverFailure = () => Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } });

/** Chooses the payouts and asks for the files: the confirmation is open and nothing was sent yet. */
async function askForTheFiles(items: Array<{ payoutId: string }> = [CHF_A]) {
  await screen.findByTestId(`wire-payout-${items[0].payoutId}`);
  for (const item of items) fireEvent.click(checkboxOf(item));
  await waitFor(() => expect(screen.getByTestId('wire-create')).toBeEnabled());
  fireEvent.click(screen.getByTestId('wire-create'));
  return screen.findByRole('dialog');
}

const confirmButton = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Crea i file per la banca' });

/** The files are made: the notice of the first currency is on the page. */
async function makeTheFiles(items: Array<{ payoutId: string }> = [CHF_A], currency = 'CHF') {
  const dialog = await askForTheFiles(items);
  fireEvent.click(confirmButton(dialog));
  return screen.findByTestId(`wire-created-${currency}`);
}

const statusOf = (batchId: string) => within(cardOf(batchId)).getByTestId('wire-batch-status').getAttribute('data-status');
const setStatus = (batchId: string, status: WireBatch['status']) => {
  batches = batches.map((batch) => (batch.id === batchId ? { ...batch, status } : batch));
};

/** What the server does with a request to create a file: it makes the batch, which the list then shows, and the payouts leave the payable list for the batch. */
function serverMakesTheBatch(request: CreateBatchRequest): CreateBatchResponse {
  const items = [...payable.CHF, ...payable.EUR].filter((item) => request.payoutIds.includes(item.payoutId));
  const currency = items[0].currency as WireCurrency;
  const id = currency === 'CHF' ? CHF_FILE : EUR_FILE;
  const totalAmount = Math.round(items.reduce((sum, item) => sum + item.amount * 100, 0)) / 100;
  payable[currency] = payable[currency].filter((item) => !request.payoutIds.includes(item.payoutId));
  batchPayouts[id] = items;
  batches = [wireBatch({ id, currency, totalAmount, transferCount: items.length, executionDate: request.executionDate }), ...batches];
  return { batchId: id, currency, totalAmount, transferCount: items.length, executionDate: request.executionDate, format: null };
}

/** Opens the payouts of one file, once its card is on the page: they are read from the server only now. */
const openPayoutsOf = async (batchId: string) => {
  const card = await screen.findByTestId(`wire-batch-${batchId}`);
  fireEvent.click(within(card).getByTestId('wire-batch-payouts-toggle'));
  return screen.findByTestId(`wire-batch-payouts-${batchId}`);
};

beforeEach(async () => {
  vi.resetAllMocks();
  batches = [];
  payable = { CHF: [CHF_A, CHF_B, CHF_NO_IBAN], EUR: [EUR_B] };
  batchPayouts = {};
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  Object.assign(plan, { isAgency: true, isLoading: false, failed: false });
  planHook.mockImplementation(() => ({ ...plan, retry: vi.fn() }));
  await i18n.changeLanguage('it');
  api.listPayablePayouts.mockImplementation(async (currency: WireCurrency) => payable[currency].map((item) => ({ ...item })));
  api.getBatchPayouts.mockImplementation(async (batchId: string): Promise<WireBatchPayouts> => {
    const batch = batches.find((item) => item.id === batchId);
    if (!batch) throw gone();
    return { batch, payouts: (batchPayouts[batchId] ?? []).map((item) => ({ ...item })) };
  });
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

afterEach(() => {
  cleanup();
  focusManager.setFocused(undefined);
});

describe('the wire page asks the role before it reads anything (agency.wire.manage: owner and administrators)', () => {
  it.each(['org_manager', 'org_accountant'])('WirePage_MemberOfTheOrgThatIsNotOwnerOrAdministrator_%s_NoQueryAndTheWayToTheAdministrator', (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(screen.getByTestId('agency-admin-required')).toBeInTheDocument();
    expect(api.listPayablePayouts).not.toHaveBeenCalled();
    expect(api.getBatchPayouts).not.toHaveBeenCalled();
    expect(api.listBatches).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wire-compose')).not.toBeInTheDocument();
    // The plan is read from an endpoint of the billing administrator: for anyone else it is not even asked.
    expect(planHook).not.toHaveBeenCalled();
  });

  it.each(['org_owner', 'org_admin'])('WirePage_%s_ReadsThePayableListOfEachCurrencyAndTheBatches', async (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
    expect(screen.queryByTestId('agency-admin-required')).not.toBeInTheDocument();
    // One list per currency, each one asked for by its own currency, and nothing is read for the payouts of a batch nobody opened.
    expect(api.listPayablePayouts).toHaveBeenCalledTimes(2);
    expect(api.listPayablePayouts.mock.calls.map(([currency]) => currency).sort()).toEqual(['CHF', 'EUR']);
    expect(api.listBatches).toHaveBeenCalledTimes(1);
    expect(api.getBatchPayouts).not.toHaveBeenCalled();
  });

  it('WirePage_OrgNotOnTheAgencyPlan_SaysSoAndNothingIsRead', () => {
    plan.isAgency = false;

    renderPage();

    expect(screen.getByTestId('agency-plan-required')).toHaveTextContent('Serve il piano Agency');
    expect(screen.getByRole('link', { name: 'Vai al piano' })).toHaveAttribute('href', '/app/account/billing');
    expect(api.listPayablePayouts).not.toHaveBeenCalled();
    expect(api.listBatches).not.toHaveBeenCalled();
  });

  it('WirePage_PlanStillOnItsWay_WaitsAndNothingIsRead_NeverSaysNotOnThePlan', () => {
    plan.isAgency = false;
    plan.isLoading = true;

    renderPage();

    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(screen.getByText('Caricamento bonifici...')).toBeInTheDocument();
    expect(api.listPayablePayouts).not.toHaveBeenCalled();
  });

  it('WirePage_ServerRefusesTheListOfTheFiles_TheAccessIsNotThere_TheAppStaysAndNothingIsOffered', async () => {
    api.listBatches.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByTestId('agency-access-refused')).toHaveTextContent('Questa pagina non è disponibile per il tuo accesso');
    expect(screen.queryByTestId('wire-compose')).not.toBeInTheDocument();
  });
});

describe('what the page offers is what the server lists as payable (confirmed, published, in no file), one list for each currency', () => {
  it('WirePage_OffersTheListOfEachCurrency_EachAmountInItsOwnCurrency_WithTheOwnerAndThePeriodOfTheStatement', async () => {
    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    expect(within(screen.getByTestId('wire-group-CHF')).getByRole('heading', { name: 'Pagamenti in CHF' })).toBeInTheDocument();
    expect(within(screen.getByTestId('wire-group-EUR')).getByRole('heading', { name: 'Pagamenti in EUR' })).toBeInTheDocument();
    expect(rowOf(CHF_A)).toHaveTextContent('Marta Rossi');
    expect(within(rowOf(CHF_A)).getByTestId('wire-payout-period')).toHaveTextContent('Rendiconto di ottobre 2026');
    expect(within(rowOf(CHF_B)).getByTestId('wire-payout-period')).toHaveTextContent('Rendiconto di settembre 2026');
    expect(within(rowOf(CHF_A)).getByTestId('wire-payout-amount')).toHaveTextContent(/^1234,50\s*CHF$/);
    expect(within(rowOf(EUR_B)).getByTestId('wire-payout-amount')).toHaveTextContent(/^830,25\s*€$/);
    expect(rowOf(CHF_A).textContent).not.toContain('€');
    // The server says only whether the owner has an IBAN: nothing of an account is drawn, and an owner who has one has no label about it.
    expect(within(rowOf(CHF_A)).queryByTestId('wire-payout-iban-badge')).not.toBeInTheDocument();
    expect(checkboxOf(CHF_A)).toBeEnabled();
    expect(checkboxOf(EUR_B)).toBeEnabled();
  });

  it('WirePage_TheFrancListNeverShowsAnEuroPayout_EvenFromAnAnswerThatMixedThem_AndNeverOffersAReversedOne', async () => {
    // A server answer that mixed the currencies and held a reversed payout by mistake: the franc list is the franc payouts that are confirmed, and nothing else.
    payable.CHF = [CHF_A, EUR_B, REVERSED];
    payable.EUR = [];

    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    expect(within(screen.getByTestId('wire-group-CHF')).queryByTestId(`wire-payout-${EUR_B.payoutId}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${EUR_B.payoutId}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId('wire-group-EUR')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${REVERSED.payoutId}`)).not.toBeInTheDocument();
  });

  it('WirePage_CurrencyListsNeverMix_TheEuroPayoutsAreInTheEuroGroupOnly_AndEachListWasAskedForByItsOwnCurrency', async () => {
    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    const chf = within(screen.getByTestId('wire-group-CHF'));
    const eur = within(screen.getByTestId('wire-group-EUR'));
    expect(chf.getAllByTestId(/^wire-payout-[0-9a-f-]{36}$/).map((row) => row.getAttribute('data-testid'))).toEqual(
      [CHF_A, CHF_B, CHF_NO_IBAN].map((item) => `wire-payout-${item.payoutId}`),
    );
    expect(eur.getAllByTestId(/^wire-payout-[0-9a-f-]{36}$/).map((row) => row.getAttribute('data-testid'))).toEqual([`wire-payout-${EUR_B.payoutId}`]);
    expect(api.listPayablePayouts).toHaveBeenCalledWith('CHF');
    expect(api.listPayablePayouts).toHaveBeenCalledWith('EUR');
  });

  it('WirePage_PayoutOfAnOwnerWithoutAnIban_IsShownBlockedWithTheReason_AndNotChosenByChooseAll', async () => {
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);

    // An owner without an IBAN cannot be paid: the server refuses the whole file for it (`wire_owner_iban_missing`), so the payout is shown and cannot be chosen.
    const row = rowOf(CHF_NO_IBAN);
    expect(row).toHaveTextContent('Anna Verdi');
    expect(checkboxOf(CHF_NO_IBAN)).toBeDisabled();
    expect(within(row).getByTestId('wire-payout-iban-badge')).toHaveTextContent('IBAN mancante');
    expect(within(row).getByTestId('wire-payout-iban-missing')).toHaveTextContent("Manca l'IBAN del proprietario: non si può pagare finché non lo aggiungi.");
    expect(checkboxOf(CHF_NO_IBAN)).toHaveAccessibleDescription(/Manca l'IBAN del proprietario/);
    expect(within(row).getByRole('link', { name: 'Apri i dati finanziari' })).toHaveAttribute('href', `/app/account/owners/${OWNER_C}/financial`);

    fireEvent.click(screen.getByTestId('wire-select-group-CHF'));
    fireEvent.click(checkboxOf(CHF_NO_IBAN));
    expect(checkboxOf(CHF_A)).toBeChecked();
    expect(checkboxOf(CHF_B)).toBeChecked();
    expect(checkboxOf(CHF_NO_IBAN)).not.toBeChecked();
    expect(screen.getByTestId('wire-selection')).toHaveTextContent('2 pagamenti scelti in CHF');
  });

  it('WirePage_NoPayoutToPay_SaysSoWithTheWayToTheMonthEndClose_InsteadOfAnEmptyForm', async () => {
    payable = { CHF: [], EUR: [] };

    renderPage();

    expect(await screen.findByText('Nessun pagamento da inviare in banca')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vai alla chiusura mensile' })).toHaveAttribute('href', '/app/account/owner-close');
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();
  });

  it('WirePage_OnlyTheCurrencyThatHasPayoutsIsShown_TheOtherOneHasNoGroup', async () => {
    payable.EUR = [];

    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    expect(screen.getByTestId('wire-group-CHF')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-group-EUR')).not.toBeInTheDocument();
  });

  it('WirePage_ChooseAllOfACurrency_ChoosesOnlyWhatCanBePaid_AndTheSummaryNamesEachCurrency', async () => {
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);

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

  it('WirePage_PayableListNotFound_IsNotFoundWhateverTheCacheHolds', async () => {
    const client = renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);

    api.listPayablePayouts.mockRejectedValueOnce(gone());
    await client.invalidateQueries({ queryKey: ['wire-transfers', 'payable', 'CHF'] });

    expect(await screen.findByText('Pagamenti non trovati')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
  });
});

describe('a payout that is in a batch is not on the list: it leaves at once and does not come back after a reload', () => {
  it('WirePage_PayoutPutInABatch_LeavesTheListAtOnce_AndTheListsAreReadAgain_AndItDoesNotComeBackAfterAReload', async () => {
    renderPage();

    await makeTheFiles([CHF_A]);

    // The server was asked again for the payable payouts of both currencies after the request, and its answer no longer has the payout.
    await waitFor(() => expect(api.listPayablePayouts.mock.calls.length).toBeGreaterThanOrEqual(4));
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`wire-payout-${CHF_B.payoutId}`)).toBeInTheDocument();
    await waitFor(() => expect(cardOf(CHF_FILE)).toBeInTheDocument());

    // A reload: a new page, nothing in memory. The server's list has no payout of the batch, so none is offered, and the payouts of the batch are the batch's.
    cleanup();
    api.listPayablePayouts.mockClear();
    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_B.payoutId}`);
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
    expect(api.listPayablePayouts).toHaveBeenCalledTimes(2);
    const panel = await openPayoutsOf(CHF_FILE);
    expect(await within(panel).findByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).toHaveTextContent('Marta Rossi');
    expect(within(panel).queryByTestId(`wire-batch-payout-${CHF_B.payoutId}`)).not.toBeInTheDocument();
    // Still not offered: being in a batch is the server's word, not the memory of the page.
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
  });

  it('WirePage_PayoutOfAnExistingBatch_IsNotOnTheSelectableList_ButIsInThePayoutsOfItsBatch', async () => {
    // The page is opened with a franc batch that was made earlier: its payout is in no payable list, the others are.
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded', transferCount: 1, totalAmount: 1234.5 })];
    batchPayouts[CHF_FILE] = [CHF_A];
    payable.CHF = [CHF_B, CHF_NO_IBAN];

    renderPage();

    await screen.findByTestId(`wire-payout-${CHF_B.payoutId}`);
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox').filter((box) => !(box as HTMLInputElement).disabled)).toHaveLength(2);

    const panel = await openPayoutsOf(CHF_FILE);
    expect(await within(panel).findByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
  });

  it('WirePage_CreateRefusedBecauseThePayoutIsAlreadyInAFile_ReadsTheListsAgain_AndThePayoutLeavesTheList', async () => {
    api.createBatch.mockImplementation(async () => {
      // Someone else put the payout in a file in the meantime: the server refuses it, and its list no longer has it.
      payable.CHF = payable.CHF.filter((item) => item.payoutId !== CHF_A.payoutId);
      throw problem(422, 'payouts_already_in_batch');
    });
    renderPage();

    const dialog = await askForTheFiles([CHF_A]);
    fireEvent.click(confirmButton(dialog));

    // The refusal is told in words, nothing is shown as done, and the list is the server's now.
    expect(await screen.findByTestId('wire-refused-CHF')).toHaveTextContent(/già in un file per la banca/);
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument());
    expect(screen.getByTestId(`wire-payout-${CHF_B.payoutId}`)).toBeInTheDocument();
  });

  it('WirePage_WindowGetsTheFocusBack_ReadsTheListsAgain_EvenWhenTheyAreStillFresh', async () => {
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    expect(api.listPayablePayouts).toHaveBeenCalledTimes(2);

    // Another person of the agency makes a file with this payout while the page is open and out of focus.
    payable.CHF = payable.CHF.filter((item) => item.payoutId !== CHF_A.payoutId);
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));

    await waitFor(() => expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument());
    expect(api.listPayablePayouts).toHaveBeenCalledTimes(4);
  });

  it('WirePage_FileMadeButTheListsReadAgainStillHoldThePayout_ReplicaLag_TheRowDoesNotComeBack_NorCanItBeChosen', async () => {
    // The server made the file, but the lists it answers next are those of before (a replica that is behind): the payout is still on them. The page put it in a file in this visit,
    // so it is never offered again, whatever a list read again says (the second line of defence; the server's refusal, `payouts_already_in_batch`, is the last).
    const LATE = wirePayout({ payoutId: 'c0000000-0000-4000-8000-000000000006', ownerId: OWNER_A, ownerName: 'Marta Rossi', currency: 'CHF', amount: 55 });
    api.createBatch.mockImplementation(async (request: CreateBatchRequest) => {
      const before: Record<WireCurrency, WirePayout[]> = { CHF: [...payable.CHF], EUR: [...payable.EUR] };
      const made = serverMakesTheBatch(request);
      payable = before;
      return made;
    });
    const client = renderPage();

    await makeTheFiles([CHF_A]);

    // The lists were read again after the request and the page holds their answer, which still has the payout: not a row of the page, and nothing to choose.
    expect(client.getQueryData<WirePayout[]>(['wire-transfers', 'payable', 'CHF'])?.map((item) => item.payoutId)).toContain(CHF_A.payoutId);
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`wire-payout-${CHF_B.payoutId}`)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wire-select-group-CHF'));
    expect(screen.getByTestId('wire-selection')).toHaveTextContent('1 pagamento scelto in CHF');
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();

    // The window gets the focus back and the lists are read again, still with the payout (and with a payout confirmed meanwhile, which tells that the answer is on the page).
    payable.CHF = [...payable.CHF, LATE];
    act(() => focusManager.setFocused(false));
    act(() => focusManager.setFocused(true));

    expect(await screen.findByTestId(`wire-payout-${LATE.payoutId}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId('wire-selection')).toHaveTextContent('1 pagamento scelto in CHF');
  });
});

describe('a list as long as the server gives it may not be the whole of it (the cap of the server) and the texts say what a payout needs to be on it', () => {
  it('WirePage_ListWithTheCapOfRows_SaysThereMayBeMore_AndAShortListSaysNothing', async () => {
    const many = Array.from({ length: WIRE_PAYABLE_LIST_CAP }, (_, index) =>
      wirePayout({ payoutId: `f0000000-0000-4000-8000-${String(index).padStart(12, '0')}`, ownerId: OWNER_A, ownerName: 'Marta Rossi', currency: 'CHF', amount: 10 + index }),
    );
    payable = { CHF: many, EUR: [EUR_B] };

    renderPage();

    const note = await screen.findByTestId('wire-cap-note-CHF', undefined, { timeout: 15_000 });
    expect(note).toHaveTextContent('Sono elencati al massimo 1000 pagamenti in CHF, i più vecchi');
    expect(within(screen.getByTestId('wire-group-CHF')).getByTestId('wire-cap-note-CHF')).toBe(note);
    // The euro list is short: nothing is said about it.
    expect(screen.getByTestId(`wire-payout-${EUR_B.payoutId}`)).toBeInTheDocument();
    expect(screen.queryByTestId('wire-cap-note-EUR')).not.toBeInTheDocument();
  });

  it('isListCapped_OneRowBelowTheCapOrNoList_IsNotCapped_TheCapIs', () => {
    expect(isListCapped(new Array(WIRE_PAYABLE_LIST_CAP - 1))).toBe(false);
    expect(isListCapped(new Array(WIRE_PAYABLE_LIST_CAP))).toBe(true);
    expect(isListCapped([])).toBe(false);
    expect(isListCapped(null)).toBe(false);
    expect(isListCapped(undefined)).toBe(false);
  });

  const PUBLICATION_TEXTS = [
    { language: 'it', published: /pubblicato al proprietario/, positive: /maggiore di zero/ },
    { language: 'en', published: /published to the owner/, positive: /above zero/ },
  ];

  it.each(PUBLICATION_TEXTS)('WirePage_NoPayoutToPay_SaysThatTheStatementMustBePublishedToTheOwnerAndTheNetAboveZero ($language)', async ({ language, published, positive }) => {
    await i18n.changeLanguage(language);
    payable = { CHF: [], EUR: [] };

    renderPage();

    const description = await screen.findByText(published);
    expect(description).toHaveTextContent(positive);
  });

  it.each(PUBLICATION_TEXTS)('WirePage_ListOfPayouts_SaysThatOnlyThePayoutsOfAPublishedStatementAndOfANetAboveZeroAreListed ($language)', async ({ language, published, positive }) => {
    await i18n.changeLanguage(language);

    renderPage();

    const hint = await screen.findByText(published);
    expect(hint).toHaveTextContent(positive);
    expect(screen.getByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
  });
});

describe('a read of the payable payouts that fails is told as a failure, never as «no payments to make»', () => {
  it('WirePage_FirstReadOfBothListsFails_NoOldFiguresToDraw_SaysSoWithARetry_AndNeverNoPaymentsToMake', async () => {
    api.listPayablePayouts.mockRejectedValue(serverFailure());

    renderPage();

    expect(await screen.findByText('Impossibile caricare i pagamenti ai proprietari')).toBeInTheDocument();
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();

    // Read again: the lists come.
    api.listPayablePayouts.mockImplementation(async (currency: WireCurrency) => payable[currency]);
    fireEvent.click(within(screen.getByTestId('wire-load-error')).getByRole('button', { name: 'Riprova' }));
    expect(await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
    expect(screen.queryByTestId('wire-load-error')).not.toBeInTheDocument();
  });

  it('WirePage_OnlyTheFrancListFails_SaysSoForTheFranc_AndTheEuroListIsStillOffered', async () => {
    api.listPayablePayouts.mockImplementation(async (currency: WireCurrency) => {
      if (currency === 'CHF') throw serverFailure();
      return payable[currency];
    });

    renderPage();

    expect(await screen.findByTestId('wire-load-error-CHF')).toHaveTextContent('Impossibile caricare i pagamenti in CHF');
    expect(await screen.findByTestId(`wire-payout-${EUR_B.payoutId}`)).toBeInTheDocument();
    expect(screen.queryByTestId('wire-group-CHF')).not.toBeInTheDocument();
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('wire-load-error-CHF')).getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
  });

  it('WirePage_UpdateOfAnEmptyListFails_IsAFailureWithARetry_NotTheOldEmptyList', async () => {
    payable = { CHF: [], EUR: [] };
    const client = renderPage();
    expect(await screen.findByText('Nessun pagamento da inviare in banca')).toBeInTheDocument();

    api.listPayablePayouts.mockRejectedValue(serverFailure());
    await client.invalidateQueries({ queryKey: ['wire-transfers', 'payable'] });

    expect(await screen.findByTestId('wire-load-error')).toBeInTheDocument();
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).not.toBeInTheDocument();
  });

  it('WirePage_ServerRefusesThePayableLists_IsTheAccessMessageInThePage_NotAnEmptyListAndTheFilesStayWhereTheyAre', async () => {
    api.listPayablePayouts.mockResolvedValue(null);
    batches = [wireBatch({ id: CHF_FILE })];

    renderPage();

    // The caller reaches only some properties: the payouts of every owner are not shown, and the page says why instead of «no payments to make».
    expect(await screen.findByTestId('wire-payouts-refused')).toHaveTextContent('Questi pagamenti non sono disponibili per il tuo accesso');
    expect(screen.getByTestId('wire-payouts-refused')).toHaveTextContent('limitato ad alcune strutture');
    expect(screen.queryByText('Nessun pagamento da inviare in banca')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();
    expect(screen.queryByTestId('agency-access-refused')).not.toBeInTheDocument();
    // The list of the files is another read, with its own answer.
    expect(await screen.findByTestId(`wire-batch-${CHF_FILE}`)).toBeInTheDocument();
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
    expect(sent.map((request) => [...request.payoutIds].sort())).toEqual([[CHF_A.payoutId, CHF_B.payoutId].sort(), [EUR_B.payoutId]]);
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
    expect(screen.queryByTestId(`wire-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`wire-payout-${EUR_B.payoutId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`wire-payout-${CHF_NO_IBAN.payoutId}`)).toBeInTheDocument();
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
    // The owners the server listed, by the name the payouts of the list carry (the server only sends their ids), each with the way to complete the data.
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
      if (request.payoutIds.includes(CHF_A.payoutId)) throw problem(422, 'wire_owner_iban_missing', { ownerIds: [OWNER_A] });
      return serverMakesTheBatch(request);
    });
    renderPage();

    await makeTheFiles([CHF_A, EUR_B], 'EUR');

    expect(await screen.findByTestId('wire-refused-CHF')).toHaveTextContent('A questi proprietari manca l\'IBAN');
    expect(screen.getByTestId('wire-created-EUR')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    expect(checkboxOf(CHF_A)).toBeChecked();
    expect(screen.queryByTestId(`wire-payout-${EUR_B.payoutId}`)).not.toBeInTheDocument();
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

  it('WirePage_Create_LostConnection_IsTold_NeverAsADoneFile_AndTheListsAreReadAgain', async () => {
    api.createBatch.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    expect(api.listBatches).toHaveBeenCalledTimes(1);
    expect(api.listPayablePayouts).toHaveBeenCalledTimes(2);

    const dialog = await askForTheFiles();
    fireEvent.click(confirmButton(dialog));

    expect(await screen.findByTestId('wire-refused-CHF')).toHaveTextContent('Impossibile contattare il server');
    expect(screen.queryByTestId('wire-created-CHF')).not.toBeInTheDocument();
    // The answer may have been lost after the file was made: the list of the files and the payable lists are read again, so the person sees what is there.
    await waitFor(() => expect(api.listBatches).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(api.listPayablePayouts).toHaveBeenCalledTimes(4));
  });

  it('WirePage_ExecutionDateInThePast_NothingCanBeCreated_AndTheHintSaysWhy', async () => {
    renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
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
    // While it is on its way every button of the card waits (the one that opens the payouts of the file too), and the step shown is still the one the server last said.
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-download')).toBeDisabled();
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-paid')).toBeDisabled();
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-payouts-toggle')).toBeDisabled();
    expect(statusOf(CHF_FILE)).toBe('Downloaded');
    // The other file is not held by it.
    expect(within(cardOf(EUR_FILE)).getByTestId('wire-batch-download')).toBeEnabled();
    expect(within(cardOf(EUR_FILE)).getByTestId('wire-batch-payouts-toggle')).toBeEnabled();

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
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-payouts-toggle')).toBeDisabled();

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
    api.downloadBatchFile.mockRejectedValue(problem(422, 'wire_batch_payouts_reversed', { payoutIds: [CHF_A.payoutId] }));
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

describe('the payouts of a file (read from the server when the person opens them, never for a file nobody opened)', () => {
  it('WireBatchPayouts_Opened_ReadsThePayoutsOfThatFileOnly_ShowsOwnerPeriodAndAmountInTheirOwnCurrency_AndClosesAgain', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded', transferCount: 2, totalAmount: 2034.5 }), wireBatch({ id: EUR_FILE, currency: 'EUR', status: 'Downloaded' })];
    batchPayouts[CHF_FILE] = [CHF_A, CHF_B];
    batchPayouts[EUR_FILE] = [EUR_B];
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    expect(api.getBatchPayouts).not.toHaveBeenCalled();
    const toggle = within(cardOf(CHF_FILE)).getByTestId('wire-batch-payouts-toggle');
    expect(toggle).toHaveTextContent('Mostra i pagamenti del file');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);

    const panel = await screen.findByTestId(`wire-batch-payouts-${CHF_FILE}`);
    expect(await within(panel).findByTestId('wire-batch-payouts-count')).toHaveTextContent('2 pagamenti nel file');
    expect(api.getBatchPayouts).toHaveBeenCalledTimes(1);
    expect(api.getBatchPayouts).toHaveBeenCalledWith(CHF_FILE);
    expect(within(within(panel).getByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).getByTestId('wire-batch-payout-owner')).toHaveTextContent('Marta Rossi');
    expect(within(panel).getByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).toHaveTextContent('Rendiconto di ottobre 2026');
    expect(within(within(panel).getByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).getByTestId('wire-batch-payout-amount')).toHaveTextContent(/^1234,50\s*CHF$/);
    expect(within(panel).queryByTestId(`wire-batch-payout-${EUR_B.payoutId}`)).not.toBeInTheDocument();
    expect(within(panel).queryByTestId('wire-batch-payouts-reversed')).not.toBeInTheDocument();
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-payouts-toggle')).toHaveAttribute('aria-expanded', 'true');
    expect(within(cardOf(CHF_FILE)).getByTestId('wire-batch-payouts-toggle')).toHaveTextContent('Nascondi i pagamenti del file');
    // The other file was not asked for.
    expect(within(cardOf(EUR_FILE)).queryByTestId(`wire-batch-payouts-${EUR_FILE}`)).not.toBeInTheDocument();

    fireEvent.click(within(cardOf(CHF_FILE)).getByTestId('wire-batch-payouts-toggle'));
    expect(screen.queryByTestId(`wire-batch-payouts-${CHF_FILE}`)).not.toBeInTheDocument();
  });

  it('WireBatchPayouts_PayoutReversedAfterTheFileWasMade_IsInTheListAndSaysSo_AndTheFileIsNotToBeUploaded', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded', transferCount: 2 })];
    batchPayouts[CHF_FILE] = [CHF_A, { ...CHF_B, status: 'Reversed' }];
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    const panel = await openPayoutsOf(CHF_FILE);

    expect(await within(panel).findByTestId(`wire-batch-payout-${CHF_B.payoutId}`)).toHaveAttribute('data-status', 'Reversed');
    expect(within(within(panel).getByTestId(`wire-batch-payout-${CHF_B.payoutId}`)).getByTestId('wire-batch-payout-reversed')).toHaveTextContent('Annullato dopo la creazione del file');
    expect(within(within(panel).getByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).queryByTestId('wire-batch-payout-reversed')).not.toBeInTheDocument();
    expect(within(panel).getByTestId('wire-batch-payouts-reversed')).toHaveTextContent('non caricarlo in banca');
  });

  it('WireBatchPayouts_PayoutReversedInAFileThatIsPaid_SaysSoOnItsRow_WithNoWarningToNotUploadTheFile', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Paid', paidAt: '2026-11-15T09:00:00Z' })];
    batchPayouts[CHF_FILE] = [{ ...CHF_A, status: 'Reversed' }];
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    const panel = await openPayoutsOf(CHF_FILE);

    expect(await within(panel).findByTestId('wire-batch-payout-reversed')).toBeInTheDocument();
    expect(within(panel).queryByTestId('wire-batch-payouts-reversed')).not.toBeInTheDocument();
  });

  it('WireBatchPayouts_FileMadeBeforeThePayouts_SaysItHasNoList_NotAFailureAndNotAnEmptyFile', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded' })];
    batchPayouts[CHF_FILE] = [];
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    const panel = await openPayoutsOf(CHF_FILE);

    expect(await within(panel).findByTestId('wire-batch-payouts-empty')).toHaveTextContent('Questo file non ha un elenco dei pagamenti');
    expect(within(panel).queryByRole('alert')).not.toBeInTheDocument();
  });

  it('WireBatchPayouts_ServerRefusesTheRead_IsTheAccessMessageInTheCard_NotAnEmptyList', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    api.getBatchPayouts.mockResolvedValue(null);
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    const panel = await openPayoutsOf(CHF_FILE);

    expect(await within(panel).findByTestId('wire-batch-payouts-refused')).toHaveTextContent('Questi pagamenti non sono disponibili per il tuo accesso');
    expect(within(panel).queryByTestId('wire-batch-payouts-empty')).not.toBeInTheDocument();
    expect(within(panel).queryByTestId('wire-batch-payouts-count')).not.toBeInTheDocument();
  });

  it('WireBatchPayouts_FailedRead_IsAFailureWithARetry_NeverAnEmptyList_AndRetryReadsAgain', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    batchPayouts[CHF_FILE] = [CHF_A];
    api.getBatchPayouts.mockRejectedValueOnce(serverFailure());
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);

    const panel = await openPayoutsOf(CHF_FILE);

    expect(await within(panel).findByTestId('wire-batch-payouts-error')).toHaveTextContent('Impossibile caricare i pagamenti di questo file');
    expect(within(panel).queryByTestId('wire-batch-payouts-empty')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Riprova' }));
    expect(await within(panel).findByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
    expect(within(panel).queryByTestId('wire-batch-payouts-error')).not.toBeInTheDocument();
  });

  it('WireBatchPayouts_FileNotFound_IsNotFoundWhateverTheCacheHolds', async () => {
    batches = [wireBatch({ id: CHF_FILE })];
    batchPayouts[CHF_FILE] = [CHF_A];
    const client = renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    const panel = await openPayoutsOf(CHF_FILE);
    await within(panel).findByTestId(`wire-batch-payout-${CHF_A.payoutId}`);

    api.getBatchPayouts.mockRejectedValueOnce(gone());
    await client.invalidateQueries({ queryKey: ['wire-transfers', 'batch-payouts', CHF_FILE] });

    expect(await within(panel).findByTestId('wire-batch-payouts-error')).toHaveTextContent('non esiste più o non è della tua organizzazione');
    expect(within(panel).queryByTestId(`wire-batch-payout-${CHF_A.payoutId}`)).not.toBeInTheDocument();
  });

  it('WireBatchPayouts_ConfirmPaidRefusedBecauseAPayoutWasReversed_ReadsThePayoutsAgain_AndTheOpenListShowsIt', async () => {
    batches = [wireBatch({ id: CHF_FILE, status: 'Downloaded', transferCount: 2 })];
    batchPayouts[CHF_FILE] = [CHF_A, CHF_B];
    api.confirmPaid.mockImplementation(async (batchId: string) => {
      // A payout of the file was reversed after the file was made: the server refuses to mark the file as paid, and the file says so now.
      batchPayouts[batchId] = [CHF_A, { ...CHF_B, status: 'Reversed' }];
      throw problem(422, 'wire_batch_payouts_reversed', { payoutIds: [CHF_B.payoutId] });
    });
    renderPage();
    await screen.findByTestId(`wire-batch-${CHF_FILE}`);
    const panel = await openPayoutsOf(CHF_FILE);
    await within(panel).findByTestId(`wire-batch-payout-${CHF_B.payoutId}`);
    expect(within(panel).queryByTestId('wire-batch-payout-reversed')).not.toBeInTheDocument();

    fireEvent.click(within(cardOf(CHF_FILE)).getByTestId('wire-batch-confirm-paid'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Confermato pagato' }));

    expect(await within(cardOf(CHF_FILE)).findByTestId('wire-batch-failure')).toHaveTextContent('non caricarlo in banca');
    await waitFor(() => expect(within(screen.getByTestId(`wire-batch-payouts-${CHF_FILE}`)).getByTestId('wire-batch-payout-reversed')).toBeInTheDocument());
    expect(statusOf(CHF_FILE)).toBe('Downloaded');
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

  it('WirePage_UpdateOfThePayableListFails_TheOldFiguresStayButSayTheyMayBeOutOfDate_AndRetryReadsAgain', async () => {
    const client = renderPage();
    await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`);
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();

    api.listPayablePayouts.mockRejectedValueOnce(serverFailure());
    await client.invalidateQueries({ queryKey: ['wire-transfers', 'payable', 'CHF'] });

    const notice = await screen.findByTestId('read-not-updated');
    expect(notice).toHaveTextContent('quello che vedi può essere vecchio');
    // The old list stays (it is not empty): it is told as possibly out of date, not as current.
    expect(screen.getByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();

    fireEvent.click(within(notice).getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument());
    expect(screen.getByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
  });

  it('WirePage_FirstReadOfTheBatchesFails_NoOldFiguresToDraw_SaysSoWithARetry_AndThePayoutsStayUsable', async () => {
    api.listBatches.mockRejectedValue(serverFailure());

    renderPage();

    expect(await screen.findByText('Impossibile caricare i file per la banca')).toBeInTheDocument();
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();
    expect(await screen.findByTestId(`wire-payout-${CHF_A.payoutId}`)).toBeInTheDocument();
  });
});
