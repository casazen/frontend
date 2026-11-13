import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { StatementsPage } from '../StatementsPage';
import { deferred, file, problem, statement } from './agency-money-fixtures';

const api = vi.hoisted(() => ({
  getAll: vi.fn(),
  approve: vi.fn(),
  publish: vi.fn(),
  downloadPdf: vi.fn(),
  downloadCsv: vi.fn(),
}));
const saved = vi.hoisted(() => vi.fn());
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }));
const plan = vi.hoisted(() => ({ isAgency: true, isLoading: false, failed: false }));
const planHook = vi.hoisted(() => vi.fn());

vi.mock('@/api/statements.api', () => ({ statementsApi: api }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: saved, withJsonErrorBody: async (error: unknown) => error }));
vi.mock('sonner', () => ({ toast: toasts }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: planHook }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));

vi.setConfig({ testTimeout: 30_000 });

const CHF = statement({ id: 'c0000000-0000-4000-8000-000000000001', currency: 'CHF', propertyName: 'Chalet Lugano', status: 'Draft', totalRevenue: 1000.5, commission: 150.25, expenses: 20, withholdingTax: 0, netPayable: 830.25 });
const EUR = statement({ id: 'e0000000-0000-4000-8000-000000000002', currency: 'EUR', propertyName: 'Casa Mare', status: 'Published', totalRevenue: 2000, commission: 300, expenses: 0, withholdingTax: 100, netPayable: 1600 });
const withStatus = (item: typeof CHF, status: typeof CHF.status) => ({ ...item, status });

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(StatementsPage))));
  return client;
}

async function openDetail(item: { id: string }) {
  await screen.findByTestId('statements-list');
  fireEvent.click(within(screen.getByTestId(`statement-row-${item.id}`)).getByRole('button', { name: 'Vedi dettagli' }));
  return screen.findByTestId('statement-detail');
}

const gone = () => problem(404, '');

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  Object.assign(plan, { isAgency: true, isLoading: false, failed: false });
  planHook.mockImplementation(() => ({ ...plan, retry: vi.fn() }));
  await i18n.changeLanguage('it');
  api.getAll.mockResolvedValue([CHF, EUR]);
  api.approve.mockResolvedValue(undefined);
  api.publish.mockResolvedValue(undefined);
  api.downloadPdf.mockResolvedValue(file(null));
  api.downloadCsv.mockResolvedValue(file(null));
});

afterEach(() => cleanup());

describe('the statements page asks the role before it reads anything (agency.statement.view: owner and administrators)', () => {
  it.each(['org_manager', 'org_accountant'])('StatementsPage_MemberOfTheOrgThatIsNotOwnerOrAdministrator_%s_NoQueryAndTheWayToTheAdministrator', (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(screen.getByTestId('agency-admin-required')).toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
    expect(screen.queryByTestId('statements-list')).not.toBeInTheDocument();
    // The plan is read from an endpoint of the billing administrator: for anyone else it is not even asked.
    expect(planHook).not.toHaveBeenCalled();
  });

  it.each(['org_owner', 'org_admin'])('StatementsPage_%s_ReadsTheStatements', async (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(await screen.findByTestId('statements-list')).toBeInTheDocument();
    expect(api.getAll).toHaveBeenCalledTimes(1);
  });
});

describe('every amount is in the currency of its statement, as the server wrote it', () => {
  it('StatementsPage_List_EachStatementInItsOwnCurrency_NeverAFixedEuro', async () => {
    renderPage();

    await screen.findByTestId('statements-list');
    const chf = screen.getByTestId(`statement-row-${CHF.id}`);
    const eur = screen.getByTestId(`statement-row-${EUR.id}`);

    expect(chf).toHaveTextContent(/1000,50\s*CHF/);
    expect(chf).toHaveTextContent(/830,25\s*CHF/);
    expect(chf.textContent).not.toContain('€');
    expect(eur).toHaveTextContent(/2000,00\s*€/);
    expect(eur.textContent).not.toContain('CHF');
  });

  it('StatementsPage_FigureWithMoreThanTwoDecimals_IsShownAsTheServerSentIt_NotRounded', async () => {
    api.getAll.mockResolvedValue([{ ...EUR, netPayable: 1599.995 }]);

    renderPage();

    await screen.findByTestId('statements-list');
    expect(screen.getByTestId(`statement-row-${EUR.id}`)).toHaveTextContent(/1599,995\s*€/);
  });

  it('StatementsPage_Detail_EveryFigureInTheStatementCurrency_WithNoSignAddedAndNothingCalculated', async () => {
    renderPage();

    const detail = await openDetail(CHF);

    expect(within(detail).getByTestId('statement-revenue').textContent).toMatch(/^1000,50\s*CHF$/);
    // The server's figures as they are: the page adds no minus in front of a commission or an expense and computes no total.
    expect(within(detail).getByTestId('statement-commission').textContent).toMatch(/^150,25\s*CHF$/);
    expect(within(detail).getByTestId('statement-expenses').textContent).toMatch(/^20,00\s*CHF$/);
    expect(within(detail).getByTestId('statement-withholding').textContent).toMatch(/^0,00\s*CHF$/);
    expect(within(detail).getByTestId('statement-net').textContent).toMatch(/^830,25\s*CHF$/);
    expect(detail.textContent).not.toContain('€');
  });
});

describe('the steps of a statement cannot be undone, so they ask to be confirmed', () => {
  it('StatementDetail_Draft_NoFilesYet_AndApproveAsksWithTheStatementAndSendsNothingBeforeIt', async () => {
    renderPage();
    const detail = await openDetail(CHF);

    // The server refuses a file for a draft: the buttons are off and the page says why.
    expect(within(detail).getByTestId('statement-download-pdf')).toBeDisabled();
    expect(within(detail).getByTestId('statement-download-csv')).toBeDisabled();
    expect(within(detail).getByTestId('statement-download-draft')).toHaveTextContent('dopo l\'approvazione');
    expect(within(detail).getByTestId('statement-status')).toHaveTextContent('Bozza');

    fireEvent.click(within(detail).getByTestId('statement-approve'));
    const dialog = await screen.findByRole('dialog');

    expect(dialog).toHaveTextContent('Chalet Lugano');
    expect(dialog).toHaveTextContent('Marta Rossi');
    expect(dialog).toHaveTextContent(/830,25\s*CHF/);
    expect(dialog).toHaveTextContent('non si può più modificare');
    expect(api.approve).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(api.approve).not.toHaveBeenCalled();
  });

  it('StatementDetail_Approve_Confirmed_SendsItOnce_EveryButtonWaits_AndTheDetailFollowsTheServer', async () => {
    const request = deferred<undefined>();
    api.approve.mockReturnValue(request.promise);
    api.getAll.mockResolvedValueOnce([CHF, EUR]).mockResolvedValue([withStatus(CHF, 'Approved'), EUR]);
    const client = renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-approve'));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Approva' });
    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(api.approve).toHaveBeenCalledWith(CHF.id);
    // While the request is on its way every button of the statement waits, and it is still a draft on screen.
    expect(screen.getByTestId('statement-approve')).toBeDisabled();
    expect(screen.getByTestId('statement-status')).toHaveTextContent('Bozza');

    request.resolve(undefined);

    // The server's list decides what the statement is now: approved, with its files and the next step.
    await waitFor(() => expect(screen.getByTestId('statement-status')).toHaveTextContent('Approvato'));
    expect(screen.getByTestId('statement-publish')).toBeEnabled();
    expect(screen.getByTestId('statement-download-pdf')).toBeEnabled();
    expect(screen.queryByTestId('statement-approve')).not.toBeInTheDocument();
    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(toasts.success).toHaveBeenCalledWith('Rendiconto approvato con successo');
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('StatementDetail_Approve_ServerSaysItIsNotADraftAnymore_TheServerWins', async () => {
    api.approve.mockRejectedValue(problem(422, 'statement_not_draft'));
    api.getAll.mockResolvedValueOnce([CHF, EUR]).mockResolvedValue([withStatus(CHF, 'Published'), EUR]);
    renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-approve'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approva' }));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Questo rendiconto non è più una bozza: l\'elenco è stato aggiornato.'));
    await waitFor(() => expect(screen.getByTestId('statement-status')).toHaveTextContent('Pubblicato'));
    expect(screen.queryByTestId('statement-approve')).not.toBeInTheDocument();
    expect(toasts.success).not.toHaveBeenCalled();
  });

  it('StatementDetail_Publish_AsksWhatItReallyDoes_NothingIsSentToTheOwner_AndFinal_AndSendsOnlyAfterConfirm', async () => {
    api.getAll.mockResolvedValue([withStatus(CHF, 'Approved'), EUR]);
    renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-publish'));
    const dialog = await screen.findByRole('dialog');

    expect(dialog).toHaveTextContent('Pubblicare il rendiconto?');
    // What the server does: the status changes and the statement can go into a wire file. It sends nothing to the owner, and the dialog does not say it does.
    expect(dialog).toHaveTextContent('risulta pubblicato e può entrare in un file di bonifici');
    expect(dialog).toHaveTextContent('Da qui non parte nessun invio al proprietario');
    expect(dialog.textContent).not.toMatch(/viene inviato/);
    expect(dialog).toHaveTextContent('non si modifica più');
    expect(api.publish).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Pubblica' }));

    await waitFor(() => expect(api.publish).toHaveBeenCalledWith(CHF.id));
    expect(api.publish).toHaveBeenCalledTimes(1);
  });
});

describe('the files of a statement come through the authenticated API under the name the server gave them', () => {
  it('StatementDetail_Pdf_SavedUnderTheNameOfTheServer', async () => {
    api.getAll.mockResolvedValue([withStatus(CHF, 'Approved'), EUR]);
    api.downloadPdf.mockResolvedValue(file('attachment; filename="rendiconto-2026-10-abc.pdf"'));
    const client = renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-download-pdf'));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(api.downloadPdf).toHaveBeenCalledWith(CHF.id);
    expect(saved.mock.calls[0][1]).toBe('rendiconto-2026-10-abc.pdf');
    // Nothing is kept: the mutation returns no bytes and is dropped.
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('StatementDetail_Csv_WithoutAReadableHeader_SavedUnderTheNameTheServerWouldGive', async () => {
    api.getAll.mockResolvedValue([withStatus(CHF, 'Published'), EUR]);
    renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-download-csv'));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(api.downloadCsv).toHaveBeenCalledWith(CHF.id);
    expect(saved.mock.calls[0][1]).toBe(`rendiconto-2026-10-${CHF.id.replace(/-/g, '')}.csv`);
  });

  it('StatementDetail_FileOnItsWay_EveryButtonWaits', async () => {
    const request = deferred<ReturnType<typeof file>>();
    api.getAll.mockResolvedValue([withStatus(CHF, 'Approved'), EUR]);
    api.downloadPdf.mockReturnValue(request.promise);
    renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-download-pdf'));

    await waitFor(() => expect(within(detail).getByTestId('statement-download-pdf')).toBeDisabled());
    expect(within(detail).getByTestId('statement-download-csv')).toBeDisabled();
    expect(within(detail).getByTestId('statement-publish')).toBeDisabled();

    request.resolve(file(null));
    await waitFor(() => expect(within(detail).getByTestId('statement-download-csv')).toBeEnabled());
  });

  it('StatementDetail_FileRefused_ToldInWords_NothingIsSaved', async () => {
    api.getAll.mockResolvedValue([withStatus(CHF, 'Approved'), EUR]);
    api.downloadPdf.mockRejectedValue(problem(422, 'statement_not_exportable'));
    renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-download-pdf'));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Il PDF e il CSV si scaricano solo dopo l\'approvazione del rendiconto.'));
    expect(saved).not.toHaveBeenCalled();
  });

  it('StatementDetail_StatementGone_IsNotFound_InTheWordsOfThePageNotTheServers', async () => {
    api.getAll.mockResolvedValue([withStatus(CHF, 'Approved'), EUR]);
    api.downloadCsv.mockRejectedValue(gone());
    renderPage();
    const detail = await openDetail(CHF);

    fireEvent.click(within(detail).getByTestId('statement-download-csv'));

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith('Rendiconto non trovato'));
    expect(saved).not.toHaveBeenCalled();
  });
});

describe('what the page says when the server does not have it', () => {
  it('StatementsPage_ListNotFound_IsNotFoundWhateverTheCacheHolds', async () => {
    api.getAll.mockRejectedValue(gone());

    renderPage();

    expect(await screen.findByText('Rendiconto non trovato')).toBeInTheDocument();
    expect(screen.queryByTestId('statements-list')).not.toBeInTheDocument();
  });

  it('StatementsPage_OpenStatementLeavesTheList_TheDetailSaysNotFoundInsteadOfShowingACopy', async () => {
    api.getAll.mockResolvedValueOnce([withStatus(CHF, 'Approved'), EUR]).mockResolvedValue([EUR]);
    const client = renderPage();
    await openDetail(CHF);

    await client.invalidateQueries({ queryKey: ['statements'] });

    expect(await screen.findByText('Rendiconto non trovato')).toBeInTheDocument();
    expect(screen.queryByTestId('statement-detail')).not.toBeInTheDocument();
  });
});

describe('the plan of the organization is checked before anything is read (any other plan is answered 403, and a refused read sends the whole app to the page of no access)', () => {
  it('StatementsPage_OrgNotOnTheAgencyPlan_SaysSoAndNothingIsRead', () => {
    plan.isAgency = false;

    renderPage();

    expect(screen.getByTestId('agency-plan-required')).toHaveTextContent('Serve il piano Agenzia');
    expect(screen.getByRole('link', { name: 'Vai al piano' })).toHaveAttribute('href', '/app/account/billing');
    expect(screen.getByTestId('statements-page')).toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
  });

  it('StatementsPage_PlanStillOnItsWay_WaitsAndNothingIsRead_NeverSaysNotOnThePlan', () => {
    plan.isAgency = false;
    plan.isLoading = true;

    renderPage();

    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(screen.getByText('Caricamento rendiconti…')).toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
  });

  it('StatementsPage_PlanThatCouldNotBeRead_SaysItAndNeverNotOnThePlan', () => {
    plan.isAgency = false;
    plan.failed = true;

    renderPage();

    expect(screen.getByTestId('error-state')).toHaveTextContent("Impossibile verificare il piano dell'organizzazione");
    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(api.getAll).not.toHaveBeenCalled();
  });

  it('StatementsPage_OrgOnTheAgencyPlan_ReadsAsBefore', async () => {
    renderPage();

    expect(await screen.findByTestId('statements-list')).toBeInTheDocument();
    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(api.getAll).toHaveBeenCalledTimes(1);
  });

  it('StatementsPage_ServerRefusesTheFirstRead_TheAccessIsNotThere_TheAppStaysAndNothingIsOffered', async () => {
    api.getAll.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByTestId('agency-access-refused')).toHaveTextContent('Questa pagina non è disponibile per il tuo accesso');
    expect(screen.queryByTestId('statements-list')).not.toBeInTheDocument();
  });
});

describe('a read that fails with the last answer in memory is never drawn as if it were in order', () => {
  it('StatementsPage_UpdateFails_TheOldFiguresStayButSayTheyMayBeOutOfDate_AndRetryReadsAgain', async () => {
    const client = renderPage();
    await screen.findByTestId('statements-list');
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();

    api.getAll.mockRejectedValueOnce(Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } }));
    await client.invalidateQueries({ queryKey: ['statements'] });

    const notice = await screen.findByTestId('read-not-updated');
    expect(notice).toHaveTextContent('Non è stato possibile aggiornare questi dati');
    expect(screen.getByTestId('statements-list')).toBeInTheDocument();

    api.getAll.mockResolvedValue([CHF, EUR]);
    fireEvent.click(within(notice).getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument());
    expect(screen.getByTestId('statements-list')).toBeInTheDocument();
  });

  it('StatementsPage_FirstReadFails_NoOldFiguresToDraw_SaysSoWithARetryNotAStaleNotice', async () => {
    api.getAll.mockRejectedValue(Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } }));

    renderPage();

    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();
    expect(screen.queryByTestId('statements-list')).not.toBeInTheDocument();
  });
});
