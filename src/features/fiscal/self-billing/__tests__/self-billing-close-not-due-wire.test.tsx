import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, isAxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { MemoryRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { CLOSE_NOTE_MAX } from '../self-billing-model';
import { SelfBillingPage } from '../self-billing-page';
import { REPLACEMENT_ID, closed, detail, kept, original } from './self-billing-fixtures';

// These tests use the real client of the app, with its interceptors and its handler of the 403, and the real API of the self-billed invoices: only the transport is replaced. What they prove is what the page does with the
// answers of «Chiudi come non più dovuta» (200, 422, 404, 403, a call that fails, an answer that is not the one of the endpoint) and with the new members of the lists, as in the browser.
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
/** Whether the server has closed the kept draft: from then on its list and its detail hold the closed draft. */
let closedNow: boolean;
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
const CLOSE = `${LIST}/${REPLACEMENT_ID}/close-not-due`;
const REASON = 'portal_credit_note';
const NOTE = 'Nota di credito del portale n. 55 del 12 novembre';

/** The answers of a server that is in order: the list and the detail (before and after the closing), and the closing itself. */
function serverInOrder({ method, path }: Request): Reply {
  if (method === 'GET' && path === LIST) return { status: 200, data: closedNow ? [original(), closed()] : [original(), kept()] };
  if (method === 'GET' && path === `${LIST}/${REPLACEMENT_ID}`) return { status: 200, data: detail(closedNow ? closed() : kept()) };
  if (method === 'POST' && path === CLOSE) {
    closedNow = true;
    return { status: 200, data: detail(closed()) };
  }
  return { status: 404, data: { code: 'not_found' } };
}

/** The same server, with `answer` as the answer of the closing (it changes nothing at the server). */
const answering = (answer: Reply) => (request: Request) => (request.method === 'POST' && request.path === CLOSE ? answer : serverInOrder(request));

const calls = (method: string, path: string) => requests.filter((request) => request.method === method && request.path === path);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  render(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(SelfBillingPage))));
  return client;
}

/** Presses «Chiudi come non più dovuta» on the kept draft and gives the dialog back, with its confirm button (off until a reason is chosen). */
async function openClosing() {
  const rows = await screen.findAllByTestId('self-billing-row');
  const row = rows.find((candidate) => candidate.getAttribute('data-id') === REPLACEMENT_ID) as HTMLElement;
  fireEvent.click(within(row).getByTestId('self-billing-row-close'));
  const dialog = await screen.findByRole('dialog', { name: i18n.t('selfBilling.close.title') });
  return { dialog, confirm: within(dialog).getByRole('button', { name: i18n.t('selfBilling.close.confirm') }) };
}

/** Chooses the reason, writes the note and presses the confirmation, once it is on. */
async function closeWith(dialog: HTMLElement, confirm: HTMLElement, note: string = NOTE) {
  fireEvent.click(within(dialog).getByTestId(`self-billing-close-reason-${REASON}`));
  if (note !== '') fireEvent.change(within(dialog).getByTestId('self-billing-close-note'), { target: { value: note } });
  await waitFor(() => expect(confirm).toBeEnabled());
  fireEvent.click(confirm);
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  closedNow = false;
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

describe('the closing of a kept replacement through the real client (data rule: nothing is told as done before the server answers 200 with the closed draft)', () => {
  it('SelfBillingClose_Answer200_AsksOnceWithTheReasonAndTheNote_ReadsTheListAgain_AndShowsTheClosedDraftAsHistoryWithNoAction', async () => {
    renderPage();

    const { dialog, confirm } = await openClosing();
    expect(calls('POST', CLOSE)).toHaveLength(0);
    await closeWith(dialog, confirm);

    // One call, to the address of the kept draft, with the reason and the note and nothing else (the user and the day are the server's).
    await waitFor(() => expect(calls('POST', CLOSE)).toHaveLength(1));
    expect(JSON.parse(calls('POST', CLOSE)[0].body as string)).toEqual({ reason: REASON, note: NOTE });
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    // The list was read again: the draft is the closed one, with its facts, no action and no «da emettere».
    await waitFor(() => expect(screen.queryByTestId('self-billing-row-close')).toBeNull());
    const row = screen.getAllByTestId('self-billing-row').find((candidate) => candidate.getAttribute('data-id') === REPLACEMENT_ID) as HTMLElement;
    const block = within(row).getByTestId('self-billing-row-closed');
    expect(within(block).getByTestId('self-billing-row-closed-reason')).toHaveTextContent(i18n.t('selfBilling.close.reason.portal_credit_note'));
    expect(within(block).getByTestId('self-billing-row-closed-by')).toHaveTextContent('Mario Rossi');
    expect(within(block).getByTestId('self-billing-row-closed-note')).toHaveTextContent(NOTE);
    expect(within(row).queryByTestId('self-billing-row-due')).toBeNull();
    expect(calls('GET', LIST).length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it.each([
    ['422 close_reason_required', 422, { code: 'close_reason_required' }, 'reasonRequired'],
    ['422 close_note_too_long', 422, { code: 'close_note_too_long' }, 'noteTooLong'],
    ['422 self_billing_already_closed', 422, { code: 'self_billing_already_closed' }, 'alreadyClosed'],
    ['422 self_billing_not_closable', 422, { code: 'self_billing_not_closable' }, 'notClosable'],
    ['404 fiscal_document_not_found', 404, { code: 'fiscal_document_not_found' }, 'notFound'],
    ['404 with no code (a flag is off at the server)', 404, '', 'unavailable'],
    ['403 with no body', 403, '', 'forbidden'],
  ] as const)('SelfBillingClose_Answer%s_IsToldInItsOwnWords_NeverAsSuccess_AndOnlyWhatThePersonCanPutRightKeepsTheConfirmationOn', async (_name, status, body, kind) => {
    reply = answering({ status, data: body });
    renderPage();

    const { dialog, confirm } = await openClosing();
    await closeWith(dialog, confirm);

    const problem = await within(dialog).findByTestId('self-billing-close-problem');
    expect(problem).toHaveAttribute('data-problem', kind);
    expect(problem).toHaveTextContent(i18n.t(`selfBilling.close.problem.${kind}`, { max: CLOSE_NOTE_MAX }));
    // Nothing says it was closed, the app is not sent to the page of no access, and the call went out once.
    expect(toast.success).not.toHaveBeenCalled();
    expect(onForbidden).not.toHaveBeenCalled();
    expect(calls('POST', CLOSE)).toHaveLength(1);
    // What the server refused is not offered again; a reason or a note the server found missing or too long can be put right in place. The dialog can always be left.
    const putRight = kind === 'reasonRequired' || kind === 'noteTooLong';
    await waitFor(() => {
      const button = within(dialog).getByRole('button', { name: i18n.t('selfBilling.close.confirm') });
      if (putRight) expect(button).toBeEnabled();
      else expect(button).toBeDisabled();
    });
    expect(within(dialog).getByRole('button', { name: i18n.t('shared.cancel') })).toBeEnabled();
    // The list is read again (a refusal of a state that changed is not left stale), and it is still the list with the kept draft, not an empty page.
    await waitFor(() => expect(calls('GET', LIST).length).toBeGreaterThanOrEqual(2));
    expect(screen.getAllByTestId('self-billing-row')).toHaveLength(2);
    expect(screen.queryByTestId('self-billing-empty')).toBeNull();
    expect(screen.queryByTestId('self-billing-row-closed')).toBeNull();
  });

  it('SelfBillingClose_ACallThatFailsWith500_IsToldWithRiprova_NothingSaysItWasClosed_AndTryingAgainWorks', async () => {
    let failing = true;
    reply = (request) => (request.method === 'POST' && request.path === CLOSE && failing ? { status: 500, data: 'Internal error' } : serverInOrder(request));
    renderPage();

    const { dialog, confirm } = await openClosing();
    await closeWith(dialog, confirm);

    const problem = await within(dialog).findByTestId('self-billing-close-problem');
    expect(problem).toHaveAttribute('data-problem', 'failed');
    expect(problem).toHaveTextContent(i18n.t('selfBilling.close.problem.failed'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('self-billing-row-closed')).toBeNull();
    // A call that failed can be asked again, and the button says so; the same call again is safe (the server answers the closed draft).
    const retry = within(dialog).getByRole('button', { name: i18n.t('shared.errorState.retry') });
    await waitFor(() => expect(retry).toBeEnabled());
    failing = false;
    fireEvent.click(retry);

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(calls('POST', CLOSE)).toHaveLength(2);
    expect(await screen.findByTestId('self-billing-row-closed')).toBeInTheDocument();
  });

  it.each([
    ['200 with the page of the app in place of the API', { status: 200, data: '<!doctype html><html></html>' }],
    ['204 with no content', { status: 204, data: '' }],
    ['200 with a TD17 that is not closed', { status: 200, data: detail(kept()) }],
  ] as const)('SelfBillingClose_Answer%s_IsNotTheAnswerOfTheServerThatClosedIt_ToldAsACallThatFailedWithRiprova_NeverAsDone', async (_name, answer) => {
    // Only a 200 with the closed draft proves the server acted: any other answer is not the endpoint's, the draft is not shown as closed, and it can be asked again.
    reply = answering(answer);
    renderPage();

    const { dialog, confirm } = await openClosing();
    await closeWith(dialog, confirm);

    const problem = await within(dialog).findByTestId('self-billing-close-problem');
    expect(problem).toHaveAttribute('data-problem', 'failed');
    expect(problem).toHaveTextContent(i18n.t('selfBilling.close.problem.failed'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('self-billing-row-closed')).toBeNull();
    const retry = within(dialog).getByRole('button', { name: i18n.t('shared.errorState.retry') });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(calls('POST', CLOSE)).toHaveLength(1);
    // The list is read again and still holds the kept draft, with its action.
    await waitFor(() => expect(calls('GET', LIST).length).toBeGreaterThanOrEqual(2));
    expect(screen.getByTestId('self-billing-row-close')).toBeInTheDocument();
  });

  it('SelfBillingClose_TheNoteIsFreeText_AFailureKeepsNothingOfTheRequest_NothingOfItIsInTheAddressOrTheStorage_AndTheCacheOfTheMutationsIsEmptyOnceTheDialogIsGone', async () => {
    const PRIVATE_NOTE = 'Il titolare Mario Bianchi ha restituito la commissione il 3 novembre';
    reply = answering({ status: 422, data: { code: 'self_billing_not_closable' } });
    const client = renderPage();

    const { dialog, confirm } = await openClosing();
    await closeWith(dialog, confirm, PRIVATE_NOTE);

    await within(dialog).findByTestId('self-billing-close-problem');
    // The note went out in the body of the call, and only there.
    expect(JSON.parse(calls('POST', CLOSE)[0].body as string).note).toBe(PRIVATE_NOTE);
    for (const request of requests) expect(request.path).not.toContain(PRIVATE_NOTE);
    expect(window.location.href).not.toContain(encodeURIComponent(PRIVATE_NOTE));
    expect(JSON.stringify(window.localStorage) + JSON.stringify(window.sessionStorage)).not.toContain(PRIVATE_NOTE);
    // The failure the cache of the mutations keeps is reduced to what the screen turns into words: the status and the code of the answer, with no request (the body of which carries the note).
    const mutations = client.getMutationCache().getAll();
    expect(mutations).toHaveLength(1);
    const error = mutations[0].state.error;
    expect(isAxiosError(error)).toBe(true);
    expect((error as AxiosError).request).toBeUndefined();
    expect((error as AxiosError).response?.status).toBe(422);
    expect(JSON.stringify([error, (error as AxiosError).config?.data, (error as AxiosError).response?.config?.data])).not.toContain(PRIVATE_NOTE);
    // Once the dialog is gone nothing of the call is kept at all (`gcTime: 0`).
    fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('shared.cancel') }));
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
  });
});

describe('the members the closing adds to the answers of the server (additive: an older server sends none, a wrong type is a load error)', () => {
  const members = ['closedReason', 'closedAt', 'closedBy', 'closedNote'];
  const withoutMembers = (value: object) => Object.fromEntries(Object.entries(value).filter(([key]) => !members.includes(key)));

  it('SelfBillingList_AnOlderServerThatSendsNoMembersOfTheClosing_StillShowsTheRows_AndNothingIsShownAsClosed', async () => {
    reply = (request) => (request.method === 'GET' && request.path === LIST ? { status: 200, data: [withoutMembers(original()), withoutMembers(kept())] } : serverInOrder(request));
    renderPage();

    expect(await screen.findAllByTestId('self-billing-row')).toHaveLength(2);
    expect(screen.queryByTestId('self-billing-row-closed')).toBeNull();
    // Nothing of the closing is invented: the kept draft is still a kept draft, offered the way out only because the server says it is kept.
    expect(screen.getByTestId('self-billing-row-kept')).toBeInTheDocument();
    expect(screen.getAllByTestId('self-billing-row-close')).toHaveLength(1);
  });

  it.each([
    ['closedReason', 5],
    ['closedAt', 20261120],
    ['closedBy', { name: 'Mario Rossi' }],
    ['closedNote', ['una nota']],
  ] as const)('SelfBillingList_%sOfTheWrongType_IsALoadError_NeverAnEmptyListNorADraftShownAsClosed', async (member, value) => {
    reply = (request) => (request.method === 'GET' && request.path === LIST ? { status: 200, data: [{ ...closed(), [member]: value }] } : serverInOrder(request));
    renderPage();

    expect(await screen.findByTestId('self-billing-error')).toBeInTheDocument();
    expect(screen.queryByTestId('self-billing-row-closed')).toBeNull();
    expect(screen.queryByTestId('self-billing-row-close')).toBeNull();
    expect(screen.queryByTestId('self-billing-empty')).toBeNull();
  });
});
