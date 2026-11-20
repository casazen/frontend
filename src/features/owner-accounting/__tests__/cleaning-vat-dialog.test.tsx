import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { TodoActivity } from '@/api/internal-activities.api';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAccountInactiveHandler, setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { cleaningVatKeys } from '@/queries/use-cleaning-vat';
import { SHORT_RENT_ROLE_KEYS, SHORT_RENT_ROLE_PERMISSIONS, hostContextsOf, workspacePredicateOf } from '@/test/host-roles';
import { TodoActivityCard } from '@/features/todo/activity-card';
import { CleaningVatQuestionHost } from '../components/cleaning-vat-dialog';

// These tests use the real client of the app, with its interceptors and its handler of the 403, the real API of the question and the real hooks: only the transport is replaced. What they prove is what the dialog of
// «La ditta di pulizie ha applicato l'IVA su questa fattura?» sends (the three answers, «Ricorda»), what it does with the rate of the server and with each refusal (403, 404, 409, 422) and each failure, and who is
// offered it: never a success before the server says it, and never the page of no access.
const env = vi.hoisted(() => ({ contexts: [] as ContextBootstrapDto[] }));

vi.mock('@/hooks/use-workspace', async () => {
  const { workspacePredicateOf: predicateOf } = await import('@/test/host-roles');
  return { useWorkspace: () => ({ contexts: env.contexts, hasPermission: predicateOf(env.contexts) }) };
});
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const REQUEST_ID = 'cccccccc-1111-4111-8111-cccccccccccc';
const PROPERTY_ID = 'dddddddd-2222-4222-8222-dddddddddddd';
const PATH = `/service-requests/${REQUEST_ID}/cleaning-vat`;

/** The question as the API answers it: a Swiss cleaning on a day the table has the 8.1% for, that nobody answered, for a caller of the whole organization. */
const question = (overrides: Record<string, unknown> = {}) => ({
  serviceRequestId: REQUEST_ID,
  propertyId: PROPERTY_ID,
  bookingId: null,
  supplierOrgId: 'eeeeeeee-3333-4333-8333-eeeeeeeeeeee',
  supplierName: 'Ditta Esempio SA',
  country: 'CH',
  cleaningDate: '2026-10-12',
  standardRatePercent: 8.1,
  answer: null,
  answerRatePercent: null,
  answeredAt: null,
  companyAppliesVat: null,
  statedAnswer: null,
  statedRatePercent: null,
  statedByCompany: false,
  canRemember: true,
  ...overrides,
});

/** What the server stores for an answer: the same question with the answer in it. */
const answered = (answer: string, overrides: Record<string, unknown> = {}) =>
  question({ answer, answerRatePercent: answer === 'Applied' ? 8.1 : null, statedAnswer: answer, statedRatePercent: answer === 'Applied' ? 8.1 : null, ...overrides });

type Reply = { status: number; data?: unknown };
interface Request {
  method: string;
  path: string;
  body: unknown;
}
let reply: (request: Request) => Reply;
let requests: Request[];
/** While it is a promise, the answers (POST) wait for it: a call that is on its way. */
let hold: Promise<void> | null;
const onForbidden = vi.fn();
const onAccountInactive = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

const bodyOf = (data: unknown): unknown => {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
};

/** The transport judges the status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise. */
const transport: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toUpperCase();
  const path = config.url ?? '';
  requests.push({ method, path, body: bodyOf(config.data) });
  if (method === 'POST' && hold) await hold;
  const { status, data } = reply({ method, path, body: bodyOf(config.data) });
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
  if (config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

/** The answers of a server that is in order: the question, and for each answer the question with that answer in it. */
function serverInOrder({ method, path, body }: Request): Reply {
  if (path !== PATH) return { status: 404, data: { code: 'not_found' } };
  if (method === 'GET') return { status: 200, data: question() };
  if (method === 'POST') return { status: 200, data: answered((body as { answer: string }).answer) };
  return { status: 404, data: { code: 'not_found' } };
}

const calls = (method: string) => requests.filter((request) => request.method === method && request.path === PATH);
const posts = () => calls('POST').map((request) => request.body);

function Probe() {
  const location = useLocation();
  return createElement('output', { 'data-testid': 'address' }, location.search);
}

const pageOfTheRequest = (search: string) => `/app/short-rent/interventions/${REQUEST_ID}${search}`;

/** The page of the request in the interventions, with the question open on it as the «Da fare» leaves it. */
function renderPage(options: { search?: string; client?: QueryClient } = {}) {
  const client = options.client ?? new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [pageOfTheRequest(options.search ?? `?cleaningVat=${REQUEST_ID}`)] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/app/short-rent/interventions/:id', element: createElement('div', null, createElement(CleaningVatQuestionHost), createElement(Probe)) }),
        ),
      ),
    ),
  );
  return { client, invalidate };
}

const ANSWER_IDS = ['Applied', 'NotApplied', 'Unknown'].map((answer) => `cleaning-vat-answer-${answer}`);

/** The button of an answer, once the question is on screen and the button can be pressed. */
async function answerButton(answer: 'Applied' | 'NotApplied' | 'Unknown') {
  const button = await screen.findByTestId(`cleaning-vat-answer-${answer}`);
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

const rememberBox = () => screen.getByRole('checkbox', { name: i18n.t('ownerAccounting.cleaningVat.remember') });
const problemText = (kind: string) => i18n.t(`ownerAccounting.cleaningVat.problem.${kind}`);

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  hold = null;
  reply = serverInOrder;
  env.contexts = hostContextsOf('property_owner');
  axiosInstance.defaults.adapter = transport;
  setApiAuthHandlers({ getAccessToken: async () => 'test-token' });
  setApiForbiddenHandler(onForbidden);
  setApiAccountInactiveHandler(onAccountInactive);
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
  axiosInstance.defaults.adapter = realAdapter;
  setApiAuthHandlers(null);
  setApiForbiddenHandler(null);
  setApiAccountInactiveHandler(null);
});

describe('the question of the VAT of a cleaning: what it shows (AC: «Sì» carries the rate of the server and is not offered when the server has none)', () => {
  it('CleaningVat_TheQuestionTellsTheCompanyTheDayAndTheCountry_AndSiCarriesTheRateOfTheServer', async () => {
    renderPage();

    const dialog = await screen.findByRole('dialog', { name: i18n.t('ownerAccounting.cleaningVat.title') });
    await screen.findByTestId('cleaning-vat-form');
    expect(within(dialog).getByTestId('cleaning-vat-company')).toHaveTextContent('Ditta Esempio SA');
    expect(within(dialog).getByTestId('cleaning-vat-when')).toHaveTextContent('12 ottobre 2026');
    expect(within(dialog).getByTestId('cleaning-vat-when')).toHaveTextContent('Svizzera');
    expect(within(dialog).getByTestId('cleaning-vat-answer-Applied')).toHaveTextContent('Sì, 8,1%');
    expect(within(dialog).getByTestId('cleaning-vat-answer-NotApplied')).toHaveTextContent('No, senza IVA');
    expect(within(dialog).getByTestId('cleaning-vat-answer-Unknown')).toHaveTextContent('Non lo so');
    // «Non lo so» is explained in one line, and nothing is sent by opening the question.
    expect(within(dialog).getByTestId('cleaning-vat-hint-Unknown')).toHaveTextContent(i18n.t('ownerAccounting.cleaningVat.unknownHint'));
    expect(calls('GET')).toHaveLength(1);
    expect(calls('POST')).toHaveLength(0);
  });

  it('CleaningVat_AnItalianCleaningInEnglish_SaysItsCountryAndItsOwnRate', async () => {
    await i18n.changeLanguage('en');
    reply = (request) => (request.method === 'GET' ? { status: 200, data: question({ country: 'IT', standardRatePercent: 22 }) } : serverInOrder(request));
    renderPage();

    expect(await screen.findByTestId('cleaning-vat-answer-Applied')).toHaveTextContent('Yes, 22%');
    expect(screen.getByTestId('cleaning-vat-when')).toHaveTextContent('Italy');
    expect(screen.getByTestId('cleaning-vat-answer-NotApplied')).toHaveTextContent('No, without VAT');
    expect(screen.getByTestId('cleaning-vat-answer-Unknown')).toHaveTextContent("I don't know");
  });

  // A data rule: the rate is the server's (the table with the validity of each rate), never a number of the console. With none for the day «Sì» cannot be given, and says why.
  it('CleaningVat_StandardRatePercentNull_DisablesSiWithTheSentenceOfWhy_AndTheOtherTwoAnswersStayAvailable', async () => {
    reply = (request) => (request.method === 'GET' ? { status: 200, data: question({ standardRatePercent: null }) } : serverInOrder(request));
    renderPage();

    const yes = await screen.findByTestId('cleaning-vat-answer-Applied');
    expect(yes).toBeDisabled();
    expect(yes).toHaveTextContent(/^Sì$/);
    expect(screen.getByTestId('cleaning-vat-hint-Applied')).toHaveTextContent(i18n.t('ownerAccounting.cleaningVat.yesUnavailable'));
    expect(yes).toHaveAttribute('aria-describedby', screen.getByTestId('cleaning-vat-hint-Applied').id);
    fireEvent.click(yes);
    expect(calls('POST')).toHaveLength(0);
    expect(await answerButton('NotApplied')).toBeEnabled();
    expect(await answerButton('Unknown')).toBeEnabled();
  });

  it('CleaningVat_ACleaningThatAlreadyHasAnAnswer_SaysWhatTheInvoiceUsesAndStillAsksForANewOne', async () => {
    reply = (request) => (request.method === 'GET' ? { status: 200, data: answered('Applied', { statedByCompany: true }) } : serverInOrder(request));
    renderPage();

    expect(await screen.findByTestId('cleaning-vat-current')).toHaveTextContent('Risposta ricordata per questa ditta: Sì, 8,1%');
    expect(await answerButton('NotApplied')).toBeEnabled();
  });
});

describe('the answers (AC: the three answers send exactly the payload, «Ricorda» is never sent by default)', () => {
  it.each(['Applied', 'NotApplied', 'Unknown'] as const)(
    'CleaningVat_%s_SendsExactlyTheAnswerAndNoRemember_ByDefault_ThenClosesTheQuestionAndReadsTheTodoAgain',
    async (answer) => {
      const { invalidate } = renderPage();

      await screen.findByTestId('cleaning-vat-form');
      // «Ricorda per questa ditta» is there for who may, and nobody ticked it.
      expect(rememberBox()).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(await answerButton(answer));

      await waitFor(() => expect(posts()).toHaveLength(1));
      expect(posts()[0]).toEqual({ answer, remember: false });
      // The answer of the server closes the dialog (the address loses the question and keeps the page), tells it in words and reads the «Da fare» again.
      await waitFor(() => expect(screen.queryByTestId('cleaning-vat-dialog')).toBeNull());
      expect(screen.getByTestId('address')).toHaveTextContent('');
      expect(toast.success).toHaveBeenCalledTimes(1);
      expect(vi.mocked(toast.success).mock.calls[0][0]).toContain(i18n.t(`ownerAccounting.cleaningVat.answer.${answer}`, { rate: '8,1%' }));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['internal-activities'] });
      expect(onForbidden).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['Applied', { answer: 'Applied', remember: true }],
    ['NotApplied', { answer: 'NotApplied', remember: true }],
    // «Non lo so» is never remembered for the company (the server refuses it): the box does not make it travel.
    ['Unknown', { answer: 'Unknown', remember: false }],
  ] as const)('CleaningVat_WithTheBoxTicked_%s_Sends_%j', async (answer, expected) => {
    renderPage();

    await screen.findByTestId('cleaning-vat-form');
    fireEvent.click(rememberBox());
    expect(rememberBox()).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(await answerButton(answer));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toEqual(expected);
  });

  it('CleaningVat_WhenTheServerSaysTheCallerMayNotRemember_NoBoxIsDrawn_AndRememberIsNeverSent', async () => {
    reply = (request) => (request.method === 'GET' ? { status: 200, data: question({ canRemember: false }) } : serverInOrder(request));
    renderPage();

    const answer = await answerButton('NotApplied');
    expect(screen.queryByRole('checkbox')).toBeNull();
    fireEvent.click(answer);

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]).toEqual({ answer: 'NotApplied', remember: false });
  });

  it('CleaningVat_WhileAnAnswerIsOnItsWay_EveryButtonWaitsAndTheDialogStays_ThenTheOneAnswerCloses', async () => {
    let release: () => void = () => undefined;
    hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    renderPage();

    await screen.findByTestId('cleaning-vat-form');
    const box = rememberBox();
    const yes = await answerButton('Applied');
    fireEvent.click(yes);

    // A request is on its way: no answer, no box and no way out is available, and a second click sends nothing.
    await waitFor(() => expect(posts()).toHaveLength(1));
    for (const id of ANSWER_IDS) await waitFor(() => expect(screen.getByTestId(id)).toBeDisabled());
    expect(box).toBeDisabled();
    expect(screen.getByTestId('cleaning-vat-close')).toBeDisabled();
    fireEvent.click(yes);
    fireEvent.click(screen.getByTestId('cleaning-vat-answer-NotApplied'));
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(screen.getByTestId('cleaning-vat-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent(`cleaningVat=${REQUEST_ID}`);
    expect(posts()).toHaveLength(1);

    release();
    await waitFor(() => expect(screen.queryByTestId('cleaning-vat-dialog')).toBeNull());
    expect(posts()).toHaveLength(1);
    expect(toast.success).toHaveBeenCalledTimes(1);
  });
});

describe('the refusals and the failures of an answer (AC: told as such, never as success; data rule: each has its own result)', () => {
  it.each([
    ['403 cleaning_vat_remember_forbidden', 403, { code: 'cleaning_vat_remember_forbidden' }, 'rememberForbidden'],
    ['403 with no code', 403, '', 'forbidden'],
    ['404 service_request_not_found', 404, { code: 'service_request_not_found' }, 'notFound'],
    ['409 service_request_state_changed', 409, { code: 'service_request_state_changed' }, 'changed'],
    ['422 cleaning_vat_answer_invalid', 422, { code: 'cleaning_vat_answer_invalid' }, 'answerInvalid'],
    ['422 cleaning_vat_not_completed', 422, { code: 'cleaning_vat_not_completed' }, 'notCompleted'],
    ['422 cleaning_vat_rate_unknown', 422, { code: 'cleaning_vat_rate_unknown' }, 'rateUnknown'],
    ['422 cleaning_vat_remember_unknown', 422, { code: 'cleaning_vat_remember_unknown' }, 'rememberUnknown'],
    ['500', 500, { code: 'boom' }, 'failed'],
  ] as const)('CleaningVat_Answer%s_IsToldInItsOwnWords_NeverAsSuccess_AndNeverTheNoAccessPage', async (_name, status, body, kind) => {
    reply = (request) => (request.method === 'POST' ? { status, data: body } : serverInOrder(request));
    renderPage();

    fireEvent.click(await answerButton('Applied'));

    const problem = await screen.findByTestId('cleaning-vat-problem');
    expect(problem).toHaveAttribute('data-problem', kind);
    expect(problem).toHaveTextContent(problemText(kind));
    // Nothing says it was saved, the dialog is where it was, and the app is not sent to the page of no access.
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('cleaning-vat-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent(`cleaningVat=${REQUEST_ID}`);
    expect(onForbidden).not.toHaveBeenCalled();
    expect(posts()).toEqual([{ answer: 'Applied', remember: false }]);
    // What was refused for good cannot be asked again as it is: a request that is not there, a person who may not answer, a cleaning not completed. «Sì» alone is off with no rate for the day.
    const off = ['notFound', 'forbidden', 'notCompleted'].includes(kind);
    for (const id of ANSWER_IDS) expect(screen.getByTestId(id)).toHaveProperty('disabled', off || (kind === 'rateUnknown' && id === 'cleaning-vat-answer-Applied'));
  });

  it('CleaningVat_RememberRefusedWith403_TakesTheBoxAway_AndTheAnswerGoesAgainWithoutIt', async () => {
    let refused = true;
    reply = (request) => {
      if (request.method === 'POST' && refused) {
        refused = false;
        return { status: 403, data: { code: 'cleaning_vat_remember_forbidden' } };
      }
      return serverInOrder(request);
    };
    renderPage();

    await screen.findByTestId('cleaning-vat-form');
    fireEvent.click(rememberBox());
    fireEvent.click(await answerButton('NotApplied'));

    expect(await screen.findByTestId('cleaning-vat-problem')).toHaveAttribute('data-problem', 'rememberForbidden');
    // The box is gone (the caller may not tick it), the answers can be given again, and nothing was said to be saved.
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(toast.success).not.toHaveBeenCalled();
    fireEvent.click(await answerButton('NotApplied'));

    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()).toEqual([
      { answer: 'NotApplied', remember: true },
      { answer: 'NotApplied', remember: false },
    ]);
    await waitFor(() => expect(screen.queryByTestId('cleaning-vat-dialog')).toBeNull());
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it('CleaningVat_StateChanged409_ReadsTheQuestionAgain_AndTheAnswerCanBeGivenOnTheOneThatIsThereNow', async () => {
    let reads = 0;
    reply = (request) => {
      if (request.method === 'GET') {
        reads += 1;
        return { status: 200, data: reads === 1 ? question() : question({ standardRatePercent: 22, country: 'IT' }) };
      }
      return { status: 409, data: { code: 'service_request_state_changed' } };
    };
    renderPage();

    fireEvent.click(await answerButton('Applied'));

    const problem = await screen.findByTestId('cleaning-vat-problem');
    expect(problem).toHaveAttribute('data-problem', 'changed');
    expect(problem).toHaveAttribute('role', 'alert');
    // The question on screen is the one the server has now, and nothing is shown as saved.
    await waitFor(() => expect(screen.getByTestId('cleaning-vat-answer-Applied')).toHaveTextContent('Sì, 22%'));
    expect(calls('GET')).toHaveLength(2);
    expect(toast.success).not.toHaveBeenCalled();
    expect(await answerButton('Applied')).toBeEnabled();
  });

  it('CleaningVat_ACallThatFailed_SaysItHasNoConfirmation_AndRiprovaSendsTheSameAnswerAgain', async () => {
    let failing = true;
    reply = (request) => {
      if (request.method === 'POST' && failing) {
        failing = false;
        return { status: 500, data: '' };
      }
      return serverInOrder(request);
    };
    renderPage();

    await screen.findByTestId('cleaning-vat-form');
    fireEvent.click(rememberBox());
    fireEvent.click(await answerButton('NotApplied'));

    const problem = await screen.findByTestId('cleaning-vat-problem');
    expect(problem).toHaveAttribute('data-problem', 'failed');
    expect(toast.success).not.toHaveBeenCalled();
    const retry = within(problem).getByTestId('cleaning-vat-retry');
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);

    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts()).toEqual([
      { answer: 'NotApplied', remember: true },
      { answer: 'NotApplied', remember: true },
    ]);
    await waitFor(() => expect(screen.queryByTestId('cleaning-vat-dialog')).toBeNull());
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  // A data rule: a success is the 200 of the endpoint with the question and the answer that was sent. Anything else is a call whose outcome is not known.
  it.each([
    ['an empty body', { status: 200, data: '' }],
    ['the question with another answer in it', { status: 200, data: answered('NotApplied') }],
    ['a 204', { status: 204, data: '' }],
  ] as const)('CleaningVat_AnAnswerOf_%s_IsNotASuccess_ItIsToldAsNotConfirmed', async (_name, answer) => {
    reply = (request) => (request.method === 'POST' ? answer : serverInOrder(request));
    renderPage();

    fireEvent.click(await answerButton('Applied'));

    expect(await screen.findByTestId('cleaning-vat-problem')).toHaveAttribute('data-problem', 'failed');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByTestId('cleaning-vat-dialog')).toBeInTheDocument();
  });
});

describe('the question that cannot be read (data rule: a refusal or a failure of the read is told, never an empty form; never the page of no access)', () => {
  it('CleaningVat_Read403_SaysTheAccessIsNotThere_NoFormNoRedirectAndNothingToAnswer', async () => {
    reply = (request) => (request.method === 'GET' ? { status: 403, data: '' } : serverInOrder(request));
    renderPage();

    const problem = await screen.findByTestId('cleaning-vat-problem');
    expect(problem).toHaveAttribute('data-problem', 'forbidden');
    expect(problem).toHaveTextContent(problemText('forbidden'));
    // The shared handler of the 403 on a read is not called, and nothing of the question is drawn.
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cleaning-vat-form')).toBeNull();
    expect(screen.queryByTestId('cleaning-vat-answer-Applied')).toBeNull();
    expect(calls('POST')).toHaveLength(0);
  });

  // A data rule: a 404 is «not found» whatever the cache still holds (a query keeps the old data when a read fails).
  it('CleaningVat_Read404WithTheOldQuestionInTheCache_IsNotFound_NeverTheOldForm', async () => {
    reply = (request) => (request.method === 'GET' ? { status: 404, data: { code: 'service_request_not_found' } } : serverInOrder(request));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });
    client.setQueryData(cleaningVatKeys.question(REQUEST_ID), question());
    renderPage({ client });

    const problem = await screen.findByTestId('cleaning-vat-problem');
    expect(problem).toHaveAttribute('data-problem', 'notFound');
    expect(problem).toHaveTextContent(problemText('notFound'));
    expect(screen.queryByTestId('cleaning-vat-form')).toBeNull();
    expect(screen.queryByTestId('cleaning-vat-answer-Applied')).toBeNull();
    expect(onForbidden).not.toHaveBeenCalled();
  });

  it('CleaningVat_ReadThatFailed_SaysSoWithRiprova_AndRiprovaReadsAgain', async () => {
    let failing = true;
    reply = (request) => {
      if (request.method === 'GET' && failing) {
        failing = false;
        return { status: 500, data: '' };
      }
      return serverInOrder(request);
    };
    renderPage();

    const error = await screen.findByTestId('cleaning-vat-load-error');
    expect(error).toHaveTextContent(i18n.t('ownerAccounting.cleaningVat.loadError'));
    expect(screen.queryByTestId('cleaning-vat-form')).toBeNull();
    fireEvent.click(within(error).getByTestId('cleaning-vat-load-retry'));

    expect(await screen.findByTestId('cleaning-vat-form')).toBeInTheDocument();
    expect(calls('GET')).toHaveLength(2);
  });

  it.each([
    ['an empty body', ''],
    ['a question with an answer no member declares', question({ statedAnswer: 'Maybe' })],
  ] as const)('CleaningVat_ReadOf_%s_IsAFailedRead_NeverAForm', async (_name, data) => {
    reply = (request) => (request.method === 'GET' ? { status: 200, data } : serverInOrder(request));
    renderPage();

    expect(await screen.findByTestId('cleaning-vat-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('cleaning-vat-form')).toBeNull();
  });

  it('CleaningVat_Read403OfADeactivatedAccount_GoesToItsOwnPage_NeverToNoAccessNorAnEmptyForm', async () => {
    reply = (request) => (request.method === 'GET' ? { status: 403, data: { code: 'account_inactive' } } : serverInOrder(request));
    renderPage();

    expect(await screen.findByTestId('cleaning-vat-load-error')).toBeInTheDocument();
    expect(onAccountInactive).toHaveBeenCalledTimes(1);
    expect(onForbidden).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cleaning-vat-form')).toBeNull();
  });
});

describe('who is offered the question (permission rule, with the real role keys: it is answered with `property.write`)', () => {
  // The «Da fare» as the server sends it: the item is about the cleaning request.
  const todo: TodoActivity = {
    id: 'a-1',
    activityType: 'CleaningVatToState',
    action: 'StateCleaningVat',
    entityType: 'ServiceRequest',
    entityId: REQUEST_ID,
    propertyId: PROPERTY_ID,
    dueAt: null,
    urgency: 'Medium',
    reason: null,
    createdAt: '2026-11-20T08:00:00Z',
  };

  /** The list of the «Da fare» with its card, and the page of the interventions that the button leads to, as the router of the app has them. */
  function renderFromTheTodo() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
    const hasPermission = workspacePredicateOf(env.contexts);
    render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ['/app/short-rent/activities'] },
          createElement(
            Routes,
            null,
            createElement(Route, {
              path: '/app/short-rent/activities',
              element: createElement('ul', null, createElement(TodoActivityCard, { activity: todo, propertyNames: new Map([[PROPERTY_ID, 'Casa Lago']]), hasPermission })),
            }),
            createElement(Route, { path: '/app/short-rent/interventions/:id', element: createElement('div', null, createElement(CleaningVatQuestionHost), createElement(Probe)) }),
          ),
        ),
      ),
    );
  }

  it.each(SHORT_RENT_ROLE_KEYS)('CleaningVat_TheButtonOfTheTodoAndTheDialogAreForTheRole_%s_OnlyWhenItWritesTheProperties', async (roleKey) => {
    env.contexts = hostContextsOf(roleKey);
    const mayWrite = (SHORT_RENT_ROLE_PERMISSIONS[roleKey] as readonly string[]).includes('property.write');

    renderFromTheTodo();

    const card = await screen.findByTestId('todo-activity');
    expect(card).toHaveAttribute('data-action', 'StateCleaningVat');
    if (!mayWrite) {
      // A role that only reads the properties gets no button, and the question is never asked of the server.
      expect(screen.queryByTestId('todo-do-now')).toBeNull();
      expect(requests).toEqual([]);
      return;
    }
    const button = within(card).getByTestId('todo-do-now');
    expect(button).toHaveAttribute('href', pageOfTheRequest(`?cleaningVat=${REQUEST_ID}`));
    fireEvent.click(button);

    expect(await screen.findByRole('dialog', { name: i18n.t('ownerAccounting.cleaningVat.title') })).toBeInTheDocument();
    await screen.findByTestId('cleaning-vat-form');
    expect(calls('GET')).toHaveLength(1);
  });

  it('CleaningVat_AnAddressOfTheQuestionOpenedByARoleThatMayNotWriteTheProperties_OpensNothingAndAsksNothing', async () => {
    env.contexts = hostContextsOf('staff');

    renderPage();

    // The page is the page (the collaborator reads it), the dialog is not there and the server is not asked: a link or a bookmark gives no way in.
    expect(await screen.findByTestId('address')).toHaveTextContent(`cleaningVat=${REQUEST_ID}`);
    expect(screen.queryByTestId('cleaning-vat-dialog')).toBeNull();
    expect(requests).toEqual([]);
  });
});
