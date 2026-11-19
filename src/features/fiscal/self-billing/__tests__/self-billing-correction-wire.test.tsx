import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { SelfBillingPage } from '../self-billing-page';
import { NUMBER, REJECTED_ID, REPLACEMENT_ID, detail, generation, original, rejected, rejectedState, replacement } from './self-billing-fixtures';

// These tests use the real client of the app, with its interceptors and its handler of the 403, and the real API of the self-billed invoices: only the transport is replaced. What they prove is what the page does with the
// answers of the correction of a rejected TD17 (201, 422, 404, 403, a call that fails) and with the new members of the lists, as in the browser.
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    contexts: [{ contextKey: 'account', roleKey: 'org_admin' }],
    hasPermission: (_contextKey: string, permission: string) => permission === 'org.billing.admin',
  }),
}));
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: () => ({ isAgency: true, isLoading: false, failed: false, retry: vi.fn() }) }));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true, sdiSubmission: true }, isLoading: false }),
}));
vi.mock('@/components/layout/page-header', () => ({ PageHeader: ({ title }: { title: string }) => createElement('h1', null, title) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

type Reply = { status: number; data?: unknown };
interface Request {
  method: string;
  path: string;
  body: unknown;
}
let reply: (request: Request) => Reply;
let requests: Request[];
/** Whether the server has corrected the rejected TD17: from then on its list holds the original (history) and the replacement. */
let corrected: boolean;
const onForbidden = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

/** The transport judges the status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise. */
const transport: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const path = config.url ?? '';
  requests.push({ method, path, body: config.data });
  const { status, data } = reply({ method, path, body: config.data });
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
  if (config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

const LIST = '/fiscal/self-billing';
const CORRECT = `${LIST}/${REJECTED_ID}/correct`;
const DRAFTS = `${LIST}/drafts`;

/** The answers of a server that is in order: the list (before and after the correction), the details, the state of the rejected TD17 and the correction itself. */
function serverInOrder({ method, path }: Request): Reply {
  if (method === 'GET' && path === LIST) return { status: 200, data: corrected ? [original(), replacement()] : [rejected()] };
  if (method === 'GET' && path === `${LIST}/${REPLACEMENT_ID}`) return { status: 200, data: detail(replacement()) };
  if (method === 'GET' && path === `${LIST}/${REJECTED_ID}`) return { status: 200, data: detail(rejected()) };
  if (method === 'GET' && path === `/fiscal/documents/${REJECTED_ID}/sdi`) return { status: 200, data: rejectedState() };
  if (method === 'POST' && path === CORRECT) {
    corrected = true;
    return { status: 201, data: detail(replacement()) };
  }
  return { status: 404, data: { code: 'not_found' } };
}

const calls = (method: string, path: string) => requests.filter((request) => request.method === method && request.path === path);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(SelfBillingPage))));
}

/** Presses «Correggi e rimanda» on the only row of the list and gives the dialog back, with its confirm button on. */
async function openCorrection() {
  const row = await screen.findByTestId('self-billing-row');
  fireEvent.click(within(row).getByTestId('self-billing-row-correct'));
  const dialog = await screen.findByRole('dialog', { name: i18n.t('selfBilling.correct.title') });
  const confirm = within(dialog).getByRole('button', { name: i18n.t('selfBilling.correct.confirm') });
  await waitFor(() => expect(confirm).toBeEnabled());
  return { dialog, confirm };
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  corrected = false;
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

describe('the correction of a rejected TD17 through the real client (data rule: nothing is told as done before the server answers 201)', () => {
  it('SelfBillingCorrection_Answer201_AsksOnceWithNoBody_ReadsTheListAgain_AndShowsTheOriginalAsHistoryAndTheReplacementDraft', async () => {
    renderPage();

    const { confirm } = await openCorrection();
    expect(calls('POST', CORRECT)).toHaveLength(0);
    fireEvent.click(confirm);

    // One call, no body, to the address of the rejected invoice.
    await waitFor(() => expect(calls('POST', CORRECT)).toHaveLength(1));
    expect(calls('POST', CORRECT)[0].body).toBeUndefined();
    // The replacement is shown: the draft that says which invoice it replaces, with the issue of the page and no discard.
    expect(await screen.findByTestId('self-billing-replaces')).toHaveTextContent(NUMBER);
    expect(screen.getByTestId('self-billing-issue')).toBeEnabled();
    expect(screen.queryByTestId('self-billing-discard')).toBeNull();
    expect(toast.success).toHaveBeenCalledTimes(1);
    // The list was read again: the discarded original is history (no action, a reference to its replacement) next to the draft.
    await waitFor(() => expect(screen.getAllByTestId('self-billing-row')).toHaveLength(2));
    expect(calls('GET', LIST).length).toBeGreaterThanOrEqual(2);
    const history = screen.getAllByTestId('self-billing-row').find((row) => row.getAttribute('data-id') === REJECTED_ID) as HTMLElement;
    expect(within(history).getByTestId('self-billing-row-corrected')).toHaveTextContent(NUMBER);
    expect(within(history).queryByTestId('self-billing-row-correct')).toBeNull();
    expect(within(history).getByTestId('self-billing-row-replacement')).toBeInTheDocument();
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it.each([
    ['422 self_billing_not_correctable', 422, { code: 'self_billing_not_correctable' }, 'notCorrectable'],
    ['404 fiscal_document_not_found', 404, { code: 'fiscal_document_not_found' }, 'notFound'],
    ['404 with no code (a flag is off at the server)', 404, '', 'unavailable'],
    ['403 with no body', 403, '', 'forbidden'],
  ] as const)('SelfBillingCorrection_Answer%s_IsToldInItsOwnWords_NeverAsSuccess_AndWhatWasRefusedCannotBeAskedAgain', async (_name, status, body, kind) => {
    reply = (request) => (request.method === 'POST' && request.path === CORRECT ? { status, data: body } : serverInOrder(request));
    renderPage();

    const { dialog, confirm } = await openCorrection();
    fireEvent.click(confirm);

    const problem = await within(dialog).findByTestId('self-billing-correct-problem');
    expect(problem).toHaveAttribute('data-problem', kind);
    expect(problem).toHaveTextContent(i18n.t(`selfBilling.correct.problem.${kind}`));
    // Nothing says it was corrected, nothing is shown as the replacement, and the app is not sent to the page of no access.
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('self-billing-replaces')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();
    // What the server refused is not offered again: the confirmation is off, and the dialog can be left.
    await waitFor(() => expect(within(dialog).getByRole('button', { name: i18n.t('selfBilling.correct.confirm') })).toBeDisabled());
    expect(within(dialog).getByRole('button', { name: i18n.t('shared.cancel') })).toBeEnabled();
    expect(calls('POST', CORRECT)).toHaveLength(1);
    // The list is read again (a refusal of a state that changed is not left stale), and it is still a list, not an empty page.
    await waitFor(() => expect(calls('GET', LIST).length).toBeGreaterThanOrEqual(2));
    expect(screen.getAllByTestId('self-billing-row')).toHaveLength(1);
    expect(screen.queryByTestId('self-billing-empty')).toBeNull();
  });

  it('theClientOfTheApp_A403OnARead_SendsTheAppToNoAccess_SoItsSilenceOnTheCorrectionIsTheDoingOfAWrite', async () => {
    // The control of the test above: the handler is wired and the transport rejects as the real one does.
    reply = () => ({ status: 403, data: '' });

    await expect(axiosInstance.get('/payments')).rejects.toBeDefined();

    expect(onForbidden).toHaveBeenCalledTimes(1);
  });

  it('SelfBillingCorrection_ACallThatFailsWith500_IsToldWithRiprova_NothingSaysItWasCorrected_AndTryingAgainWorks', async () => {
    let failing = true;
    reply = (request) => (request.method === 'POST' && request.path === CORRECT && failing ? { status: 500, data: 'Internal error' } : serverInOrder(request));
    renderPage();

    const { dialog, confirm } = await openCorrection();
    fireEvent.click(confirm);

    const problem = await within(dialog).findByTestId('self-billing-correct-problem');
    expect(problem).toHaveAttribute('data-problem', 'failed');
    expect(problem).toHaveTextContent(i18n.t('selfBilling.correct.problem.failed'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('self-billing-replaces')).toBeNull();
    // A call that failed can be asked again, and the button says so.
    const retry = within(dialog).getByRole('button', { name: i18n.t('shared.errorState.retry') });
    await waitFor(() => expect(retry).toBeEnabled());
    failing = false;
    fireEvent.click(retry);

    expect(await screen.findByTestId('self-billing-replaces')).toHaveTextContent(NUMBER);
    expect(calls('POST', CORRECT)).toHaveLength(2);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('SelfBillingCorrection_Answer201WithABodyThatIsNotATd17_SaysTheCorrectionWasMadeButCouldNotBeRead_AndNeverShowsADraftItDoesNotHave', async () => {
    reply = (request) => {
      if (request.method === 'POST' && request.path === CORRECT) {
        corrected = true;
        return { status: 201, data: '<!doctype html><html></html>' };
      }
      return serverInOrder(request);
    };
    renderPage();

    const { confirm } = await openCorrection();
    fireEvent.click(confirm);

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(i18n.t('selfBilling.correct.unreadable')));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('self-billing-detail')).toBeNull();
    // The list is read again and shows what the server holds.
    await waitFor(() => expect(screen.getAllByTestId('self-billing-row')).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('the members the correction adds to the answers of the server (additive: an older server sends none, a wrong type is a load error)', () => {
  it('SelfBillingDrafts_TheAnswerCarriesKept_AndTheHostIsToldWhichNumbersAreHeldAndWhy', async () => {
    reply = (request) =>
      request.method === 'POST' && request.path === DRAFTS
        ? {
            status: 200,
            data: { ...generation({ updated: 1 }), kept: [{ documentId: REPLACEMENT_ID, holderKind: 'Agency', holderOwnerId: null, portalName: 'Portale Uno BV', number: NUMBER, reason: 'portal_not_configured' }] },
          }
        : serverInOrder(request);
    renderPage();

    await screen.findAllByTestId('self-billing-row');
    const button = screen.getByTestId('self-billing-prepare');
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    const report = await screen.findByTestId('self-billing-report');
    const kept = within(report).getByTestId('self-billing-report-kept');
    expect(kept).toHaveTextContent(NUMBER);
    expect(kept).toHaveTextContent(i18n.t('selfBilling.kept.portal_not_configured'));
    expect(JSON.parse(calls('POST', DRAFTS)[0].body as string)).toEqual({ period: expect.stringMatching(/^\d{4}-\d{2}$/) });
  });

  it('SelfBillingDrafts_AnOlderServerThatSendsNoKept_IsNoKept_AndAKeptThatIsNotAListIsAFailureNeverNone', async () => {
    const { kept: omitted, ...older } = generation({ created: 1 });
    expect(omitted).toEqual([]);
    reply = (request) => (request.method === 'POST' && request.path === DRAFTS ? { status: 200, data: older } : serverInOrder(request));
    renderPage();

    await screen.findAllByTestId('self-billing-row');
    const button = screen.getByTestId('self-billing-prepare');
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);

    const report = await screen.findByTestId('self-billing-report');
    expect(within(report).queryByTestId('self-billing-report-kept')).toBeNull();
    cleanup();

    reply = (request) => (request.method === 'POST' && request.path === DRAFTS ? { status: 200, data: { ...generation(), kept: 'not a list' } } : serverInOrder(request));
    renderPage();

    await screen.findAllByTestId('self-billing-row');
    const again = screen.getByTestId('self-billing-prepare');
    await waitFor(() => expect(again).toBeEnabled());
    fireEvent.click(again);

    // The answer cannot be read: it is told as a failure of the call, and no report of «done» is drawn over it.
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('selfBilling.drafts.failed')));
    expect(screen.queryByTestId('self-billing-report')).toBeNull();
  });

  it('SelfBillingList_AnOlderServerThatSendsNoMembersOfTheCorrection_StillShowsTheRows_AndOffersNothing', async () => {
    const members = ['canCorrect', 'replacesDocumentId', 'replacedByDocumentId', 'keptReason'];
    const older = Object.fromEntries(Object.entries(rejected()).filter(([key]) => !members.includes(key)));
    reply = (request) => (request.method === 'GET' && request.path === LIST ? { status: 200, data: [older] } : serverInOrder(request));
    renderPage();

    const row = await screen.findByTestId('self-billing-row');
    expect(within(row).getByTestId('self-billing-row-open')).toBeInTheDocument();
    expect(within(row).queryByTestId('self-billing-row-correct')).toBeNull();
    expect(within(row).queryByTestId('self-billing-row-kept')).toBeNull();
    expect(within(row).queryByTestId('self-billing-row-replaces')).toBeNull();
  });

  it('SelfBillingList_AMemberOfTheCorrectionOfTheWrongType_IsALoadError_NeverAnEmptyListNorAnActionTheServerDidNotOffer', async () => {
    reply = (request) => (request.method === 'GET' && request.path === LIST ? { status: 200, data: [{ ...rejected(), canCorrect: 'yes' }] } : serverInOrder(request));
    renderPage();

    expect(await screen.findByTestId('self-billing-error')).toBeInTheDocument();
    expect(screen.queryByTestId('self-billing-row-correct')).toBeNull();
    expect(screen.queryByTestId('self-billing-empty')).toBeNull();
  });
});
