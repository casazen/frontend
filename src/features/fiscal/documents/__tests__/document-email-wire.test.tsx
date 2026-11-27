import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import axiosInstance, { setApiAuthHandlers, setApiForbiddenHandler } from '@/lib/axios';
import { DocumentActionBar } from '../document-actions';
import { document } from './document-fixtures';

// E12/F01/US02/T01: the button «Invia al cliente» of an issued guest document. These tests use the real client of the app, with its interceptors and its handler of the 403, and the real API of the fiscal
// documents: only the transport is replaced. What they prove is what the button does with what the server answers: each refusal in its own words, a failed call with «Riprova» that calls again, a 403 told
// in the dialog and not by the no-access page, and never «in coda» for an answer the server did not give.
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

type Reply = { status: number; data?: unknown } | 'no-answer';
let reply: () => Reply;
let requests: string[];
let hold: Promise<void> | null;
const onForbidden = vi.fn();
const realAdapter = axiosInstance.defaults.adapter;

/** The transport judges the status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise; «no answer» is a network error. */
const transport: AxiosAdapter = async (config) => {
  requests.push(`${(config.method ?? 'get').toUpperCase()} ${config.url ?? ''}`);
  if (hold) await hold;
  const outcome = reply();
  if (outcome === 'no-answer') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
  const { status, data } = outcome;
  const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
  if (config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300) return response;
  throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
};

const ISSUED = document();
const SEND = `POST /fiscal/documents/${ISSUED.id}/send-email`;
const QUEUED = { documentId: ISSUED.id, queued: true, linkExpiresAt: '2026-12-19T10:00:00Z' };
const CONFIRM = () => i18n.t('fiscalDocuments.email.sendConfirm');
const RETRY = () => i18n.t('shared.errorState.retry');

function renderBar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DocumentActionBar, { document: ISSUED, flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true }, canWrite: true }),
    ),
  );
}

async function askToSend() {
  fireEvent.click(screen.getByTestId('fiscal-document-email'));
  const dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: CONFIRM() }));
  return dialog;
}

beforeEach(async () => {
  vi.clearAllMocks();
  requests = [];
  hold = null;
  reply = () => ({ status: 200, data: QUEUED });
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

describe('the e-mail of an issued document to its guest, through the real client (a queued e-mail is «in coda», never «consegnata»)', () => {
  it('SendEmail_TheServerQueuesIt_IsOneCallToTheEndpointOfTheDocument_SaidInCodaWithTheLastDayOfTheLink', async () => {
    renderBar();

    expect(screen.getByTestId('fiscal-document-email')).toHaveTextContent('Invia al cliente');
    const dialog = await askToSend();

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(requests).toEqual([SEND]);
    const told = String(vi.mocked(toast.success).mock.calls[0]?.[0]);
    expect(told).toContain('E-mail in coda');
    expect(told).toMatch(/19 dic/);
    expect(told).not.toMatch(/consegnat/i);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByTestId('fiscal-document-email-queued')).toHaveTextContent('E-mail in coda');
    expect(screen.getByTestId('fiscal-document-email')).toHaveTextContent('Rinvia e-mail');
  });

  it('SendEmail_WhileTheCallIsOnItsWay_EveryButtonOfTheDocumentWaits_AndASecondConfirmationSendsNoSecondEmail', async () => {
    let answer = () => {};
    hold = new Promise<void>((resolve) => {
      answer = resolve;
    });
    renderBar();
    fireEvent.click(screen.getByTestId('fiscal-document-email'));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: CONFIRM() }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: CONFIRM() })).toBeDisabled());
    fireEvent.click(within(dialog).getByRole('button', { name: CONFIRM() }));
    expect(screen.getByTestId('fiscal-document-email')).toBeDisabled();

    answer();
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(requests).toEqual([SEND]);
  });

  it.each([
    [404, 'fiscal_document_not_found', 'fiscalDocumentNotFound'],
    [422, 'document_not_issued', 'documentNotIssued'],
    [422, 'document_owner_invoice', 'documentOwnerInvoice'],
    [422, 'document_self_billing', 'documentSelfBilling'],
    [422, 'document_read_only', 'documentReadOnly'],
    [422, 'document_recipient_email_invalid', 'documentRecipientEmailInvalid'],
  ])('SendEmail_Refused%s_%s_IsToldInItsOwnWordsInTheDialog_NeverAsQueued_AndTheSameCallIsNotOffered', async (status, code, key) => {
    reply = () => ({ status, data: { code } });
    renderBar();

    const dialog = await askToSend();

    const problem = await within(dialog).findByTestId('fiscal-document-email-problem');
    expect(problem).toHaveTextContent(i18n.t(`apiErrors.codes.${key}`));
    expect(problem).toHaveAttribute('data-retry', 'false');
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fiscal-document-email-queued')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: RETRY() })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: CONFIRM() })).toBeDisabled();
    expect(requests).toEqual([SEND]);
  });

  it('SendEmail_ForbiddenWith403_IsTheNoPermissionMessageInTheDialog_TheAppIsNotSentToTheNoAccessPage', async () => {
    reply = () => ({ status: 403, data: '' });
    renderBar();

    const dialog = await askToSend();

    expect(await within(dialog).findByTestId('fiscal-document-email-problem')).toHaveTextContent(i18n.t('apiErrors.forbidden'));
    expect(onForbidden).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: CONFIRM() })).toBeDisabled();
  });

  it('SendEmail_TheQueueCouldNotTakeIt_422DocumentEmailNotSent_SaysNothingWasSentAndRiprovaCallsAgain', async () => {
    let failing = true;
    reply = () => (failing ? { status: 422, data: { code: 'document_email_not_sent' } } : { status: 200, data: QUEUED });
    renderBar();

    const dialog = await askToSend();

    const problem = await within(dialog).findByTestId('fiscal-document-email-problem');
    expect(problem).toHaveTextContent(i18n.t('apiErrors.codes.documentEmailNotSent'));
    expect(problem).toHaveAttribute('data-retry', 'true');
    expect(toast.success).not.toHaveBeenCalled();

    failing = false;
    fireEvent.click(within(dialog).getByRole('button', { name: RETRY() }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(requests).toEqual([SEND, SEND]);
  });

  it('SendEmail_ServerFailsWith500_IsAFailureWithRiprova_NeverQueued_AndRiprovaCallsAgain', async () => {
    let failing = true;
    reply = () => (failing ? { status: 500, data: 'Internal error' } : { status: 200, data: QUEUED });
    renderBar();

    const dialog = await askToSend();

    expect(await within(dialog).findByTestId('fiscal-document-email-problem')).toHaveTextContent(i18n.t('fiscalDocuments.email.failed'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fiscal-document-email-queued')).not.toBeInTheDocument();
    expect(screen.getByTestId('fiscal-document-email')).toHaveTextContent('Invia al cliente');

    failing = false;
    fireEvent.click(within(dialog).getByRole('button', { name: RETRY() }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));
    expect(requests).toEqual([SEND, SEND]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('fiscal-document-email')).toHaveTextContent('Rinvia e-mail');
  });

  it('SendEmail_NoAnswerAtAll_IsTheSentenceOfTheNetworkWithRiprova_NeverQueued', async () => {
    reply = () => 'no-answer';
    renderBar();

    const dialog = await askToSend();

    expect(await within(dialog).findByTestId('fiscal-document-email-problem')).toHaveTextContent(i18n.t('apiErrors.network'));
    expect(within(dialog).getByRole('button', { name: RETRY() })).toBeEnabled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it.each([
    ['an answer that does not say it was queued', { documentId: ISSUED.id, queued: false, linkExpiresAt: QUEUED.linkExpiresAt }],
    ['an answer with no day for the link', { documentId: ISSUED.id, queued: true }],
    ['an answer that is the page of the app', '<!doctype html><html></html>'],
    ['an empty answer', ''],
  ])('SendEmail_%s_IsAFailureNeverQueued', async (_case, data) => {
    reply = () => ({ status: 200, data });
    renderBar();

    const dialog = await askToSend();

    expect(await within(dialog).findByTestId('fiscal-document-email-problem')).toHaveTextContent(i18n.t('fiscalDocuments.email.failed'));
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByTestId('fiscal-document-email-queued')).not.toBeInTheDocument();
  });
});
