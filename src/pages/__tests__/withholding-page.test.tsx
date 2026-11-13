import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { TaxF24Record, TaxReconciliation } from '@/types';
import { WithholdingPage } from '../WithholdingPage';
import { deferred, file, problem } from './agency-money-fixtures';

const api = vi.hoisted(() => ({
  getSummary: vi.fn(),
  downloadF24Pdf: vi.fn(),
  recordPayment: vi.fn(),
  getTaxReconciliation: vi.fn(),
  getF24: vi.fn(),
}));
const saved = vi.hoisted(() => vi.fn());
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_owner' }] }));
const plan = vi.hoisted(() => ({ isAgency: true, isLoading: false, failed: false }));
const planHook = vi.hoisted(() => vi.fn());

vi.mock('@/api/withholding.api', () => ({
  withholdingApi: { getSummary: api.getSummary, downloadF24Pdf: api.downloadF24Pdf, recordPayment: api.recordPayment },
}));
vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: { getTaxReconciliation: api.getTaxReconciliation, getF24: api.getF24 } }));
vi.mock('@/lib/file-download', () => ({ saveBlobAs: saved, withJsonErrorBody: async (error: unknown) => error }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: planHook }));
// The month the page opens on: November 2026, whatever the day the tests run.
vi.mock('@/lib/stay-dates', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/stay-dates')>()), todayInRome: () => '2026-11-12' }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, action }: { title: string; action?: ReactNode }) => createElement('div', null, createElement('h1', null, title), action),
}));

vi.setConfig({ testTimeout: 30_000 });

const F24_ID = 'f2400000-0000-4000-8000-000000000001';
const SUMMARY = {
  month: 11,
  year: 2026,
  totalBase: 500,
  totalWithholding: 100.25,
  ownerSummaries: [{ ownerId: 'bbbbbbbb-0000-4000-8000-000000000001', ownerName: 'Marta Rossi', totalBase: 500, totalWithholding: 100.25, payoutCount: 2, bookingCount: 2 }],
};
const f24Record = (overrides: Partial<TaxF24Record> = {}): TaxF24Record => ({
  id: F24_ID,
  referenceMonth: 11,
  referenceYear: 2026,
  totalAmount: 100.25,
  taxCode: '1919',
  dueDate: '2026-12-16T00:00:00',
  paidAt: null,
  isOverdue: false,
  createdAt: '2026-11-30T10:00:00Z',
  filingState: 'Generated',
  ruleVersion: '2025.1',
  handoffReference: null,
  receiptReference: null,
  rejectionReason: null,
  ...overrides,
});
const reconciliation = (f24: number | null): TaxReconciliation => ({
  year: 2026,
  obligationsTotal: 100.25,
  f24Total: f24 ?? 0,
  annualTotal: null,
  reconciled: f24 !== null,
  months: Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    obligations: index + 1 === 11 ? 100.25 : 0,
    f24: index + 1 === 11 ? f24 : null,
    filingState: index + 1 === 11 && f24 !== null ? ('Generated' as const) : null,
  })),
});

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(WithholdingPage))));
  return client;
}

const gone = () => problem(404, '');

async function openThePaymentConfirmation(day = '2026-11-20') {
  await screen.findByTestId('f24-card');
  fireEvent.change(screen.getByLabelText('Giorno del pagamento'), { target: { value: day } });
  fireEvent.click(screen.getByTestId('f24-record-payment'));
  return screen.findByRole('dialog');
}

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_owner' }];
  Object.assign(plan, { isAgency: true, isLoading: false, failed: false });
  planHook.mockImplementation(() => ({ ...plan, retry: vi.fn() }));
  await i18n.changeLanguage('it');
  api.getSummary.mockResolvedValue(SUMMARY);
  api.getTaxReconciliation.mockResolvedValue(reconciliation(100.25));
  api.getF24.mockResolvedValue(f24Record());
  api.downloadF24Pdf.mockResolvedValue(file('attachment; filename="f24-2026-11.pdf"'));
  api.recordPayment.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('the withholding page asks the role before it reads anything (agency.withholding.manage: owner and administrators)', () => {
  it.each(['org_manager', 'org_accountant'])('WithholdingPage_MemberOfTheOrgThatIsNotOwnerOrAdministrator_%s_NoQueryAndTheWayToTheAdministrator', (roleKey) => {
    workspace.contexts = [{ contextKey: 'account', roleKey }];

    renderPage();

    expect(screen.getByTestId('agency-admin-required')).toBeInTheDocument();
    expect(api.getSummary).not.toHaveBeenCalled();
    expect(api.getTaxReconciliation).not.toHaveBeenCalled();
    expect(api.getF24).not.toHaveBeenCalled();
    // The plan is read from an endpoint of the billing administrator: for anyone else it is not even asked.
    expect(planHook).not.toHaveBeenCalled();
  });
});

describe('what the page shows is what the server has, in euro, and opening it makes nothing', () => {
  it('WithholdingPage_MonthWithAnF24_ShowsTheWithholdingByOwnerAndTheF24AsTheServerHasThem', async () => {
    renderPage();

    const f24 = await screen.findByTestId('f24-card');

    expect(screen.getByTestId('withholding-total')).toHaveTextContent(/100,25\s*€/);
    expect(screen.getByTestId('withholding-base')).toHaveTextContent(/500,00\s*€/);
    expect(screen.getByTestId('withholding-owner-bbbbbbbb-0000-4000-8000-000000000001')).toHaveTextContent('Marta Rossi');
    expect(within(f24).getByTestId('f24-amount')).toHaveTextContent(/100,25\s*€/);
    expect(within(f24).getByTestId('f24-tax-code')).toHaveTextContent('1919');
    expect(within(f24).getByTestId('f24-due-date')).toHaveTextContent('16');
    // Not paid until the person registers it: the page says so, it does not guess.
    expect(within(f24).getByTestId('f24-unpaid')).toHaveTextContent('Pagamento non ancora registrato');
    expect(within(f24).queryByTestId('f24-paid')).not.toBeInTheDocument();
    expect(api.getSummary).toHaveBeenCalledWith(11, 2026);
    expect(api.getF24).toHaveBeenCalledWith(11, 2026);
  });

  it('WithholdingPage_MonthWithoutAnF24_SaysSo_AndNeverAsksTheServerToBuildOne', async () => {
    api.getTaxReconciliation.mockResolvedValue(reconciliation(null));

    renderPage();

    expect(await screen.findByTestId('f24-none')).toHaveTextContent('Per questo mese non c\'è un F24');
    // `GET withholding/f24` builds the record when there is none: it is not called for a month the reconciliation says has no F24.
    expect(api.getF24).not.toHaveBeenCalled();
    expect(screen.queryByTestId('f24-card')).not.toBeInTheDocument();
  });

  it('WithholdingPage_OverdueF24_SaysItIsOverdueAndUnpaid_NeverPaid', async () => {
    api.getF24.mockResolvedValue(f24Record({ isOverdue: true }));

    renderPage();

    const unpaid = await screen.findByTestId('f24-unpaid');
    expect(unpaid).toHaveTextContent('il pagamento non è registrato');
    expect(screen.queryByTestId('f24-paid')).not.toBeInTheDocument();
  });

  it('WithholdingPage_SummaryNotFound_IsNotFoundWhateverTheCacheHolds', async () => {
    api.getSummary.mockRejectedValue(gone());

    renderPage();

    expect(await screen.findByText('Dati della ritenuta non trovati')).toBeInTheDocument();
    expect(screen.queryByTestId('f24-card')).not.toBeInTheDocument();
  });
});

describe('the F24 PDF comes through the authenticated API under the name of the server', () => {
  it('F24Card_Download_AsksTheMonthAndSavesUnderTheNameOfTheServer_NothingIsKept', async () => {
    const client = renderPage();
    const f24 = await screen.findByTestId('f24-card');

    fireEvent.click(within(f24).getByTestId('f24-download'));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(api.downloadF24Pdf).toHaveBeenCalledWith(11, 2026);
    expect(saved.mock.calls[0][1]).toBe('f24-2026-11.pdf');
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('F24Card_Download_WithoutAReadableHeader_UsesTheNameTheServerWouldGive', async () => {
    api.downloadF24Pdf.mockResolvedValue(file(null));
    renderPage();
    const f24 = await screen.findByTestId('f24-card');

    fireEvent.click(within(f24).getByTestId('f24-download'));

    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(saved.mock.calls[0][1]).toBe('f24-2026-11.pdf');
  });

  it('F24Card_Download_NoF24OnTheServer_ToldInWords_NothingIsSaved', async () => {
    api.downloadF24Pdf.mockRejectedValue(problem(404, 'f24_not_found'));
    renderPage();
    const f24 = await screen.findByTestId('f24-card');

    fireEvent.click(within(f24).getByTestId('f24-download'));

    expect(await within(f24).findByTestId('f24-failure')).toHaveTextContent('Per questo mese non c\'è un F24.');
    expect(saved).not.toHaveBeenCalled();
  });

  it('F24Card_FileOnItsWay_EveryButtonOfTheCardWaits', async () => {
    const request = deferred<ReturnType<typeof file>>();
    api.downloadF24Pdf.mockReturnValue(request.promise);
    renderPage();
    const f24 = await screen.findByTestId('f24-card');
    fireEvent.change(screen.getByLabelText('Giorno del pagamento'), { target: { value: '2026-11-20' } });

    fireEvent.click(within(f24).getByTestId('f24-download'));

    await waitFor(() => expect(within(f24).getByTestId('f24-download')).toBeDisabled());
    expect(within(f24).getByTestId('f24-record-payment')).toBeDisabled();
    expect(screen.getByLabelText('Giorno del pagamento')).toBeDisabled();

    request.resolve(file(null));
    await waitFor(() => expect(within(f24).getByTestId('f24-record-payment')).toBeEnabled());
  });
});

describe('registering the payment of the F24 cannot be undone, and it is the administrator\'s word', () => {
  it('F24Card_Record_NeedsADayAndAConfirmationNamingTheF24_TheAmountAndTheDay_BeforeAnythingIsSent', async () => {
    renderPage();
    const f24 = await screen.findByTestId('f24-card');
    // No day, no button.
    expect(within(f24).getByTestId('f24-record-payment')).toBeDisabled();

    const dialog = await openThePaymentConfirmation();

    expect(dialog).toHaveTextContent('Registrare il pagamento dell\'F24?');
    expect(dialog).toHaveTextContent(/novembre 2026/i);
    expect(dialog).toHaveTextContent(/100,25\s*€/);
    expect(dialog).toHaveTextContent('Lo registri tu: CasaZen non sa se il versamento è andato a buon fine');
    expect(dialog).toHaveTextContent('Non si può annullare da qui');
    expect(api.recordPayment).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Annulla' }));
    expect(api.recordPayment).not.toHaveBeenCalled();
  });

  it('F24Card_Record_Confirmed_SendsTheF24ByItsIdOnce_AndTheServersAnswerDecidesWhatTheCardShows', async () => {
    api.getF24.mockResolvedValueOnce(f24Record()).mockResolvedValue(f24Record({ paidAt: '2026-11-20T00:00:00Z' }));
    const client = renderPage();
    const dialog = await openThePaymentConfirmation();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registra pagamento' }));

    await waitFor(() => expect(api.recordPayment).toHaveBeenCalledTimes(1));
    // The F24 by its id (the server answers 404 `f24_not_found` for anything else) and the day.
    expect(api.recordPayment).toHaveBeenCalledWith({ f24Id: F24_ID, paidAt: new Date('2026-11-20').toISOString() });
    const paid = await screen.findByTestId('f24-paid');
    expect(paid).toHaveTextContent('Pagamento registrato dall\'amministratore');
    expect(paid).toHaveTextContent('CasaZen non verifica il versamento');
    // Registered: the form is gone, it cannot be registered twice from here.
    expect(screen.queryByTestId('f24-payment')).not.toBeInTheDocument();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });

  it('F24Card_Record_RequestOnItsWay_NothingCanBeSentTwice_AndTheCardIsNotPaidYet', async () => {
    const request = deferred<undefined>();
    api.recordPayment.mockReturnValue(request.promise);
    renderPage();
    const dialog = await openThePaymentConfirmation();
    const confirm = within(dialog).getByRole('button', { name: 'Registra pagamento' });

    fireEvent.click(confirm);
    await waitFor(() => expect(confirm).toBeDisabled());
    fireEvent.click(confirm);
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    expect(api.recordPayment).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('f24-download')).toBeDisabled();
    expect(screen.queryByTestId('f24-paid')).not.toBeInTheDocument();

    request.resolve(undefined);
    await waitFor(() => expect(screen.getByTestId('f24-download')).toBeEnabled());
    expect(api.recordPayment).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a server failure', Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } }), /Impossibile registrare il pagamento/],
    ['an F24 that is not there', problem(404, 'f24_not_found'), /Per questo mese non c'è un F24/],
  ])('F24Card_Record_%s_IsToldInWords_AndTheF24StaysUnpaid', async (_name, error, words) => {
    api.recordPayment.mockRejectedValue(error);
    renderPage();
    const dialog = await openThePaymentConfirmation();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Registra pagamento' }));

    expect(await screen.findByTestId('f24-failure')).toHaveTextContent(words);
    expect(screen.getByTestId('f24-unpaid')).toBeInTheDocument();
    expect(screen.queryByTestId('f24-paid')).not.toBeInTheDocument();
    expect(screen.getByTestId('f24-record-payment')).toBeEnabled();
  });
});

describe('the plan of the organization is checked before anything is read (any other plan is answered 403, and a refused read sends the whole app to the page of no access)', () => {
  it('WithholdingPage_OrgNotOnTheAgencyPlan_SaysSoAndNothingIsRead', () => {
    plan.isAgency = false;

    renderPage();

    expect(screen.getByTestId('agency-plan-required')).toHaveTextContent('Serve il piano Agenzia');
    expect(screen.getByRole('link', { name: 'Vai al piano' })).toHaveAttribute('href', '/app/account/billing');
    expect(screen.getByTestId('withholding-page')).toBeInTheDocument();
    expect(api.getSummary).not.toHaveBeenCalled();
  });

  it('WithholdingPage_PlanStillOnItsWay_WaitsAndNothingIsRead_NeverSaysNotOnThePlan', () => {
    plan.isAgency = false;
    plan.isLoading = true;

    renderPage();

    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(screen.getByText('Caricamento delle ritenute…')).toBeInTheDocument();
    expect(api.getSummary).not.toHaveBeenCalled();
  });

  it('WithholdingPage_PlanThatCouldNotBeRead_SaysItAndNeverNotOnThePlan', () => {
    plan.isAgency = false;
    plan.failed = true;

    renderPage();

    expect(screen.getByTestId('error-state')).toHaveTextContent("Impossibile verificare il piano dell'organizzazione");
    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(api.getSummary).not.toHaveBeenCalled();
  });

  it('WithholdingPage_OrgOnTheAgencyPlan_ReadsAsBefore', async () => {
    renderPage();

    expect(await screen.findByTestId('withholding-summary')).toBeInTheDocument();
    expect(screen.queryByTestId('agency-plan-required')).not.toBeInTheDocument();
    expect(api.getSummary).toHaveBeenCalledTimes(1);
  });

  it('WithholdingPage_ServerRefusesTheFirstRead_TheAccessIsNotThere_TheAppStaysAndNothingIsOffered', async () => {
    api.getSummary.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByTestId('agency-access-refused')).toHaveTextContent('Questa pagina non è disponibile per il tuo accesso');
    expect(screen.queryByTestId('withholding-summary')).not.toBeInTheDocument();
  });
});

describe('a read that fails with the last answer in memory is never drawn as if it were in order', () => {
  it('WithholdingPage_UpdateFails_TheOldFiguresStayButSayTheyMayBeOutOfDate_AndRetryReadsAgain', async () => {
    const client = renderPage();
    await screen.findByTestId('withholding-summary');
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();

    api.getSummary.mockRejectedValueOnce(Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } }));
    await client.invalidateQueries({ queryKey: ['withholding', 'summary', 11, 2026] });

    const notice = await screen.findByTestId('read-not-updated');
    expect(notice).toHaveTextContent('Non è stato possibile aggiornare questi dati');
    expect(screen.getByTestId('withholding-summary')).toBeInTheDocument();

    api.getSummary.mockResolvedValue(SUMMARY);
    fireEvent.click(within(notice).getByRole('button', { name: 'Riprova' }));

    await waitFor(() => expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument());
    expect(screen.getByTestId('withholding-summary')).toBeInTheDocument();
  });

  it('WithholdingPage_FirstReadFails_NoOldFiguresToDraw_SaysSoWithARetryNotAStaleNotice', async () => {
    api.getSummary.mockRejectedValue(Object.assign(new Error('boom'), { isAxiosError: true, response: { status: 500, data: 'Internal error' } }));

    renderPage();

    expect(await screen.findByTestId('error-state')).toBeInTheDocument();
    expect(screen.queryByTestId('read-not-updated')).not.toBeInTheDocument();
    expect(screen.queryByTestId('withholding-summary')).not.toBeInTheDocument();
  });
});
