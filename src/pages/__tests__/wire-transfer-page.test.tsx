import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { WireTransferPage } from '../WireTransferPage';
import { deferred, file, problem, statement } from './agency-money-fixtures';

const api = vi.hoisted(() => ({
  getAll: vi.fn(),
  createBatch: vi.fn(),
  downloadBatchFile: vi.fn(),
  confirmPaid: vi.fn(),
}));
const saved = vi.hoisted(() => vi.fn());
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }));
const plan = vi.hoisted(() => ({ isAgency: true, isLoading: false, failed: false }));
const planHook = vi.hoisted(() => vi.fn());

vi.mock('@/api/statements.api', () => ({ statementsApi: { getAll: api.getAll } }));
vi.mock('@/api/wireTransfer.api', () => ({
  wireTransferApi: { createBatch: api.createBatch, downloadBatchFile: api.downloadBatchFile, confirmPaid: api.confirmPaid },
}));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: saved, withJsonErrorBody: async (error: unknown) => error }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: planHook }));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));

vi.setConfig({ testTimeout: 30_000 });

const IBAN = 'IT60X0542811101000000123456';
const BATCH_ID = 'b1b2c3d4-0000-4000-8000-000000000000';
const REFERENCE = 'WB-B1B2C3D4';
const CHF = statement({ id: 'c0000000-0000-4000-8000-000000000001', currency: 'CHF', propertyName: 'Chalet Lugano', netPayable: 1234.5 });
const EUR = statement({ id: 'e0000000-0000-4000-8000-000000000002', currency: 'EUR', propertyName: 'Casa Mare', netPayable: 830.25 });
const DRAFT = statement({ id: 'd0000000-0000-4000-8000-000000000003', status: 'Draft', propertyName: 'Casa Bozza' });
const APPROVED = statement({ id: 'a0000000-0000-4000-8000-000000000004', status: 'Approved', propertyName: 'Casa Approvata' });
const USD = statement({ id: 'f0000000-0000-4000-8000-000000000005', currency: 'USD', propertyName: 'Casa Dollari' });

const CREATED = { batchId: BATCH_ID, currency: 'CHF', totalAmount: 1234.5, transferCount: 1 };

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(WireTransferPage))));
  return client;
}

/** The checkbox of a statement. By the test id of its row: while a confirmation is open the page behind it is hidden from the queries by role. */
const checkboxOf = (item: { id: string }) => screen.getByTestId(`wire-statement-${item.id}`).querySelector('input[type="checkbox"]') as HTMLInputElement;
/** A 404 that carries no code of its own: the page must say «not found» in its own words, not the server's. */
const gone = () => problem(404, '');

/** Chooses the statement, types the debit account and asks for the file: the confirmation is open and nothing was sent yet. */
async function askForTheFile(item: { id: string } = CHF) {
  await screen.findByTestId('wire-compose');
  fireEvent.click(checkboxOf(item));
  fireEvent.change(screen.getByLabelText(/Conto di addebito \(IBAN\)/), { target: { value: IBAN } });
  fireEvent.click(screen.getByTestId('wire-create'));
  return screen.findByRole('dialog');
}

/** The file is made: the card of the batch is on the page. */
async function makeTheFile() {
  const dialog = await askForTheFile();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Crea il file dei bonifici' }));
  return screen.findByTestId('wire-batch-reference');
}

async function downloadTheFile() {
  fireEvent.click(screen.getByTestId('wire-batch-download'));
  await waitFor(() => expect(screen.getByTestId('wire-batch-status')).toHaveAttribute('data-status', 'Downloaded'));
}

async function openThePaidConfirmation() {
  fireEvent.click(screen.getByTestId('wire-batch-mark-paid'));
  return screen.findByRole('dialog');
}

const status = () => screen.getByTestId('wire-batch-status').getAttribute('data-status');

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  Object.assign(plan, { isAgency: true, isLoading: false, failed: false });
  planHook.mockImplementation(() => ({ ...plan, retry: vi.fn() }));
  await i18n.changeLanguage('it');
  api.getAll.mockResolvedValue([CHF, EUR, DRAFT, APPROVED, USD]);
  api.createBatch.mockResolvedValue(CREATED);
  api.downloadBatchFile.mockResolvedValue(file(`attachment; filename="wire-batch-${BATCH_ID.replace(/-/g, '')}-CHF-20261105.xml"`));
  api.confirmPaid.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('the wire page asks the role before it reads anything (agency.wire.manage: owner and administrators)', () => {
  it.each(['org_manager', 'org_accountant'])('WirePage_MemberOfTheOrgThatIsNotOwnerOrAdministrator_%s_NoQueryAndTheWayToTheAdministrator', (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(screen.getByTestId('agency-admin-required')).toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
    expect(api.createBatch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wire-compose')).not.toBeInTheDocument();
    // The plan is read from an endpoint of the billing administrator: for anyone else it is not even asked.
    expect(planHook).not.toHaveBeenCalled();
  });

  it.each(['org_owner', 'org_admin'])('WirePage_%s_ReadsTheStatements', async (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(await screen.findByTestId('wire-compose')).toBeInTheDocument();
    expect(screen.queryByTestId('agency-admin-required')).not.toBeInTheDocument();
    expect(api.getAll).toHaveBeenCalledTimes(1);
  });
});

describe('what the page offers is what the server accepts', () => {
  it('WirePage_OnlyPublishedStatementsOfTheCurrenciesOfAWireFile_AreOffered', async () => {
    renderPage();

    await screen.findByTestId('wire-compose');
    // The server refuses a statement that is not published (`statements_not_published`): it is not even listed.
    expect(screen.queryByTestId(`wire-statement-${DRAFT.id}`)).not.toBeInTheDocument();
    expect(screen.queryByTestId(`wire-statement-${APPROVED.id}`)).not.toBeInTheDocument();
    expect(checkboxOf(CHF)).toBeEnabled();
    expect(checkboxOf(EUR)).toBeEnabled();
    // A currency with no wire file is shown and cannot be chosen (`wire_currency_not_supported`).
    expect(checkboxOf(USD)).toBeDisabled();
  });

  it('WirePage_StatementsOfTwoCurrencies_NeverInTheSameFile_AndEachAmountIsInItsOwnCurrency', async () => {
    renderPage();

    await screen.findByTestId('wire-compose');
    expect(screen.getByTestId(`wire-statement-${CHF.id}`)).toHaveTextContent(/1234,50\s*CHF/);
    expect(screen.getByTestId(`wire-statement-${EUR.id}`)).toHaveTextContent(/830,25\s*€/);
    expect(screen.getByTestId(`wire-statement-${CHF.id}`)).not.toHaveTextContent('€');

    fireEvent.click(checkboxOf(CHF));

    // One currency per file: the euro statement waits (`mixed_currencies_not_allowed`), and the page adds up nothing.
    expect(checkboxOf(EUR)).toBeDisabled();
    expect(screen.getByTestId('wire-selection')).toHaveTextContent('1 rendiconto scelto in CHF');
    expect(screen.getByTestId('wire-compose').textContent).not.toMatch(/totale/i);

    fireEvent.click(checkboxOf(CHF));
    expect(checkboxOf(EUR)).toBeEnabled();
  });

  it('WirePage_NothingPublished_SaysSoInsteadOfAnEmptyForm', async () => {
    api.getAll.mockResolvedValue([DRAFT, APPROVED]);

    renderPage();

    expect(await screen.findByText('Nessun rendiconto pubblicato')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-create')).not.toBeInTheDocument();
  });

  it('WirePage_StatementsListNotFound_IsNotFoundWhateverTheCacheHolds', async () => {
    api.getAll.mockRejectedValue(gone());

    renderPage();

    expect(await screen.findByText('Rendiconti non trovati')).toBeInTheDocument();
    expect(screen.queryByTestId('wire-compose')).not.toBeInTheDocument();
  });
});

describe('making the file (the debit account is a bank account)', () => {
  it('WirePage_Create_AsksToConfirmFirst_NamingTheCurrencyAndTheAccountMasked_AndSendsNothingUntilConfirmed', async () => {
    renderPage();

    const dialog = await askForTheFile();

    expect(dialog).toHaveTextContent('1 rendiconto in CHF');
    expect(dialog).toHaveTextContent('IT60 •••• 3456');
    // The account is never written in full again, and nothing was sent yet.
    expect(dialog.textContent).not.toContain(IBAN);
    expect(api.createBatch).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(api.createBatch).not.toHaveBeenCalled();
  });

  it('WirePage_Create_SendsTheStatementsAndTheAccountOnce_ShowsTheBatchAsTheServerAnswered_AndForgetsTheAccount', async () => {
    const client = renderPage();

    await makeTheFile();

    expect(api.createBatch).toHaveBeenCalledTimes(1);
    expect(api.createBatch).toHaveBeenCalledWith({ statementIds: [CHF.id], debitAccount: IBAN });
    // The batch is what the server said, as it came: reference, currency, number of transfers and the total in its own currency.
    expect(screen.getByTestId('wire-batch-reference')).toHaveTextContent(REFERENCE);
    expect(screen.getByTestId('wire-batch-currency')).toHaveTextContent('CHF');
    expect(screen.getByTestId('wire-batch-count')).toHaveTextContent('1');
    expect(screen.getByTestId('wire-batch-amount')).toHaveTextContent(/1234,50\s*CHF/);
    // Not done yet: created, not downloaded, not paid.
    expect(status()).toBe('Generated');
    expect(screen.getByTestId('wire-batch-status')).toHaveTextContent('File creato, non ancora scaricato');
    expect(screen.queryByTestId('wire-batch-paid')).not.toBeInTheDocument();
    expect(screen.getByTestId('wire-batch-mark-paid')).toBeDisabled();
    // The account is shown masked and is nowhere in full: not in the page, not in the field, not in the cache of the mutations.
    expect(screen.getByTestId('wire-batch-debit')).toHaveTextContent('IT60 •••• 3456');
    expect(document.body.textContent).not.toContain(IBAN);
    expect(screen.getByLabelText(/Conto di addebito \(IBAN\)/)).toHaveValue('');
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    // The statements that went into the file are not offered again in this visit.
    expect(checkboxOf(CHF)).toBeDisabled();
  });

  it('WirePage_DebitAccountHint_SaysWhatIsTrue_TheServerKeepsTheAccountInTheWireFile_NotThatNothingIsSaved', async () => {
    renderPage();

    await screen.findByTestId('wire-compose');
    // The server stores the debit account with the batch and in the file it keeps: the hint must not promise the opposite.
    const hint = screen.getByText(/Il conto della tua agenzia da cui partiranno i bonifici/);
    expect(hint).toHaveTextContent('è scritto nel file dei bonifici, che CasaZen conserva');
    expect(hint.textContent).not.toMatch(/non viene salvato/i);
  });

  it('WirePage_Create_WhileTheRequestIsOnItsWay_NothingCanBeSentTwice', async () => {
    const request = deferred<typeof CREATED>();
    api.createBatch.mockReturnValue(request.promise);
    renderPage();

    const dialog = await askForTheFile();
    const confirm = within(dialog).getByRole('button', { name: 'Crea il file dei bonifici' });
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(api.createBatch).toHaveBeenCalledTimes(1);
    expect(checkboxOf(EUR)).toBeDisabled();

    request.resolve(CREATED);
    await screen.findByTestId('wire-batch-reference');
    expect(api.createBatch).toHaveBeenCalledTimes(1);
  });

  it('WirePage_SchemaNotInstalled_SaysTheWireTransfersCannotBeSwitchedOnYet_NotASuccessNotAGenericError', async () => {
    api.createBatch.mockRejectedValue(problem(422, 'wire_batch_schema_unavailable'));
    const client = renderPage();

    const dialog = await askForTheFile();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea il file dei bonifici' }));

    const notice = await screen.findByTestId('wire-unavailable');
    expect(notice).toHaveTextContent('I bonifici non sono ancora attivabili');
    expect(notice).toHaveTextContent('Manca il file di controllo, lo aggiunge un operatore');
    // No file exists: no card, no success, and not the generic failure either; the statements stay free to choose.
    expect(screen.queryByTestId('wire-batch-reference')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wire-failure')).not.toBeInTheDocument();
    expect(screen.queryByText(/creato con successo/i)).not.toBeInTheDocument();
    expect(checkboxOf(CHF)).toBeEnabled();
    expect(checkboxOf(CHF)).toBeChecked();
    // The account stays in the field for the next try and is in no cache.
    expect(screen.getByLabelText(/Conto di addebito \(IBAN\)/)).toHaveValue(IBAN);
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it.each([
    ['wire_batch_xml_invalid', /non supera il controllo del formato/],
    ['wire_batch_content_invalid', /non corrisponde ai rendiconti scelti/],
    ['wire_currency_not_supported', /solo in euro \(EUR\) o in franchi svizzeri \(CHF\)/],
    ['wire_amount_invalid', /maggiore di zero e avere al massimo due decimali/],
    ['statements_already_in_batch', /già in un file dei bonifici/],
    ['invalid_debit_account_iban', /IBAN del conto di addebito non è valido/],
  ])('WirePage_Create_Refusal_%s_IsToldInWordsAndNothingIsShownAsDone', async (code, words) => {
    api.createBatch.mockRejectedValue(problem(422, code));
    renderPage();

    const dialog = await askForTheFile();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crea il file dei bonifici' }));

    expect(await screen.findByTestId('wire-failure')).toHaveTextContent(words);
    expect(screen.queryByTestId('wire-batch-reference')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wire-unavailable')).not.toBeInTheDocument();
  });
});

describe('the file of the batch and its payment (the administrator\'s word, never the bank\'s)', () => {
  it('WireBatch_Download_GoesThroughTheApi_SavesUnderTheNameOfTheServer_AndMovesToDownloaded', async () => {
    const client = renderPage();
    await makeTheFile();

    await downloadTheFile();

    expect(api.downloadBatchFile).toHaveBeenCalledWith(BATCH_ID);
    expect(saved).toHaveBeenCalledTimes(1);
    expect(saved.mock.calls[0][1]).toBe(`wire-batch-${BATCH_ID.replace(/-/g, '')}-CHF-20261105.xml`);
    expect(screen.getByTestId('wire-batch-status')).toHaveTextContent('File scaricato, non ancora segnato come pagato');
    expect(screen.getByTestId('wire-batch-mark-paid')).toBeEnabled();
    // The file is not kept: the mutation returns nothing and is dropped.
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('WireBatch_Download_WithoutAHeaderTheNameIsRebuilt_AndAFailureKeepsTheStep', async () => {
    api.downloadBatchFile.mockResolvedValueOnce(file(null));
    renderPage();
    await makeTheFile();

    await downloadTheFile();
    expect(saved.mock.calls[0][1]).toBe(`wire-batch-${BATCH_ID}-CHF.xml`);

    api.downloadBatchFile.mockRejectedValueOnce(gone());
    fireEvent.click(screen.getByTestId('wire-batch-download'));

    expect(await screen.findByTestId('wire-batch-failure')).toHaveTextContent('Questo file dei bonifici non esiste più');
    expect(status()).toBe('Downloaded');
  });

  it('WireBatch_MarkPaid_NeedsTheExactConfirmation_BatchCurrencyAmount_AndSendsNothingBeforeIt', async () => {
    renderPage();
    await makeTheFile();
    await downloadTheFile();

    const dialog = await openThePaidConfirmation();

    // Which batch, which amount, which currency; and what it means: the administrator's word, final.
    expect(within(dialog).getByTestId('wire-confirm-summary')).toHaveTextContent(REFERENCE);
    expect(within(dialog).getByTestId('wire-confirm-currency')).toHaveTextContent('CHF');
    expect(within(dialog).getByTestId('wire-confirm-amount')).toHaveTextContent(/1234,50\s*CHF/);
    expect(dialog).toHaveTextContent('CasaZen non sa se la banca ha eseguito i bonifici');
    expect(dialog).toHaveTextContent('Non si può annullare');
    expect(api.confirmPaid).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(api.confirmPaid).not.toHaveBeenCalled();
    expect(status()).toBe('Downloaded');
  });

  it('WireBatch_MarkPaid_Confirmed_IsPaidByTheAdministrator_NeverPaidByTheBank', async () => {
    const client = renderPage();
    await makeTheFile();
    await downloadTheFile();

    const dialog = await openThePaidConfirmation();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Segna come pagato' }));

    await waitFor(() => expect(status()).toBe('Paid'));
    expect(api.confirmPaid).toHaveBeenCalledTimes(1);
    expect(api.confirmPaid).toHaveBeenCalledWith(BATCH_ID);
    const card = screen.getByTestId(`wire-batch-${BATCH_ID}`);
    expect(card).toHaveTextContent('Segnato come pagato dall\'amministratore');
    expect(card).toHaveTextContent('CasaZen non verifica che la banca abbia eseguito i bonifici');
    expect(card.textContent).not.toMatch(/pagato dalla banca/i);
    // It cannot be marked twice from the page.
    expect(screen.queryByTestId('wire-batch-mark-paid')).not.toBeInTheDocument();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('WireBatch_RequestOnItsWay_EveryButtonOfTheCardWaits_AndTheSameConfirmationCannotBeSentTwice', async () => {
    const request = deferred<undefined>();
    api.confirmPaid.mockReturnValue(request.promise);
    renderPage();
    await makeTheFile();
    await downloadTheFile();

    const dialog = await openThePaidConfirmation();
    const confirm = within(dialog).getByRole('button', { name: 'Segna come pagato' });
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(api.confirmPaid).toHaveBeenCalledTimes(1);
    // While it is on its way the server has not said paid: the card does not either.
    expect(status()).toBe('Downloaded');
    expect(screen.getByTestId('wire-batch-download')).toBeDisabled();

    request.resolve(undefined);
    await waitFor(() => expect(status()).toBe('Paid'));
    expect(api.confirmPaid).toHaveBeenCalledTimes(1);
  });

  it('WireBatch_DownloadOnItsWay_TheOtherButtonsOfTheCardWait', async () => {
    const request = deferred<ReturnType<typeof file>>();
    api.downloadBatchFile.mockReturnValue(request.promise);
    renderPage();
    await makeTheFile();

    fireEvent.click(screen.getByTestId('wire-batch-download'));

    await waitFor(() => expect(screen.getByTestId('wire-batch-download')).toBeDisabled());
    expect(screen.getByTestId('wire-batch-mark-paid')).toBeDisabled();
    // Not downloaded until the server handed the file out.
    expect(status()).toBe('Generated');

    request.resolve(file(null));
    await waitFor(() => expect(status()).toBe('Downloaded'));
  });

  it('WireBatch_ServerSaysAlreadyPaid_TheServerWins_AndTheStepFollowsIt', async () => {
    api.confirmPaid.mockRejectedValue(problem(422, 'batch_already_paid'));
    renderPage();
    await makeTheFile();
    await downloadTheFile();

    const dialog = await openThePaidConfirmation();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Segna come pagato' }));

    await waitFor(() => expect(status()).toBe('Paid'));
    expect(screen.getByTestId('wire-batch-failure')).toHaveTextContent('già stato segnato come pagato');
  });

  it('WireBatch_ServerSaysNotDownloaded_TheServerWins_AndTheStepGoesBack', async () => {
    api.confirmPaid.mockRejectedValue(problem(422, 'batch_not_downloaded'));
    renderPage();
    await makeTheFile();
    await downloadTheFile();

    const dialog = await openThePaidConfirmation();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Segna come pagato' }));

    await waitFor(() => expect(status()).toBe('Generated'));
    expect(screen.getByTestId('wire-batch-failure')).toHaveTextContent('Prima di segnare il file come pagato va scaricato');
    expect(screen.queryByTestId('wire-batch-paid')).not.toBeInTheDocument();
  });

  it.each([
    ['a server failure', Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } }), /Impossibile segnare il file come pagato/],
    ['a lost connection', Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }), /Impossibile contattare il server/],
    ['a batch that is not there', gone(), /non esiste più o non è della tua organizzazione/],
  ])('WireBatch_MarkPaid_%s_NeverShowsPaid_TheStepStaysDownloaded', async (_name, error, words) => {
    api.confirmPaid.mockRejectedValue(error);
    renderPage();
    await makeTheFile();
    await downloadTheFile();

    const dialog = await openThePaidConfirmation();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Segna come pagato' }));

    expect(await screen.findByTestId('wire-batch-failure')).toHaveTextContent(words);
    expect(status()).toBe('Downloaded');
    expect(screen.queryByTestId('wire-batch-paid')).not.toBeInTheDocument();
    expect(screen.getByTestId('wire-batch-mark-paid')).toBeEnabled();
  });
});

describe('the plan of the organization is checked before anything is read (any other plan is answered 403, and a refused read sends the whole app to the page of no access)', () => {
  it('WirePage_OrgNotOnTheAgencyPlan_SaysSoAndNothingIsRead', () => {
    plan.isAgency = false;

    renderPage();

    expect(screen.getByTestId('agency-plan-required')).toHaveTextContent('Serve il piano Agenzia');
    expect(screen.getByRole('link', { name: 'Vai al piano' })).toHaveAttribute('href', '/app/account/billing');
    expect(screen.getByTestId('wire-transfer-page')).toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
  });

  it('WirePage_PlanStillOnItsWay_WaitsAndNothingIsRead_NeverSaysNotOnThePlan', () => {
    plan.isAgency = false;
    plan.isLoading = true;

    renderPage();

    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(screen.getByText('Caricamento bonifici...')).toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
  });

  it('WirePage_PlanThatCouldNotBeRead_SaysItAndNeverNotOnThePlan', () => {
    plan.isAgency = false;
    plan.failed = true;

    renderPage();

    expect(screen.getByTestId('error-state')).toHaveTextContent("Impossibile verificare il piano dell'organizzazione");
    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
  });

  it('WirePage_OrgOnTheAgencyPlan_ReadsAsBefore', async () => {
    renderPage();

    expect(await screen.findByTestId('wire-compose')).toBeInTheDocument();
    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(api.getAll).toHaveBeenCalledTimes(1);
  });

  it('WirePage_ServerRefusesTheFirstRead_TheAccessIsNotThere_TheAppStaysAndNothingIsOffered', async () => {
    api.getAll.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByTestId('agency-access-refused')).toHaveTextContent('Questa pagina non è disponibile per il tuo accesso');
    expect(screen.queryByTestId('wire-compose')).not.toBeInTheDocument();
  });
});
