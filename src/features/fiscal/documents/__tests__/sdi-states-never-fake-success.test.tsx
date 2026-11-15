import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import * as api from '@/api/fiscal-documents.api';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import type { FiscalDocumentSdiState, SdiSubmitResult } from '@/types';
import { DocumentSdiPanel } from '../document-sdi-panel';
import { submitVerdictOf } from '../document-model';
import { document } from './document-fixtures';

vi.mock('@/api/fiscal-documents.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/fiscal-documents.api')>();
  return { ...actual, getDocumentSdi: vi.fn(), submitDocumentSdi: vi.fn(), declareDocumentSdi: vi.fn() };
});
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [] }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

vi.setConfig({ testTimeout: 30_000 });

const flags: Partial<FeatureFlags> = { ...DEFAULT_FEATURE_FLAGS, sdiSubmission: true, fiscalDocumentIssuance: true };
const DOCUMENT = document();

const state = (overrides: Partial<FiscalDocumentSdiState> = {}): FiscalDocumentSdiState => ({
  documentId: DOCUMENT.id,
  status: 'to_send',
  errorCode: null,
  reason: null,
  statusUpdatedAt: null,
  providerConfigured: true,
  canSubmit: true,
  canDeclare: true,
  canCorrect: false,
  ...overrides,
});

const answer = (outcome: string, now: Partial<FiscalDocumentSdiState>): SdiSubmitResult => ({ outcome, state: state(now) });

function failure(status: number | undefined, body?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', status === undefined ? AxiosError.ERR_NETWORK : AxiosError.ERR_BAD_REQUEST, config, {}, status === undefined ? undefined : { status, data: body, statusText: '', headers: {}, config });
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(createElement(QueryClientProvider, { client }, createElement(DocumentSdiPanel, { document: DOCUMENT, flags, canWrite: true, onCorrect: vi.fn() })));
}

const read = vi.mocked(api.getDocumentSdi);
const submit = vi.mocked(api.submitDocumentSdi);
const declare = vi.mocked(api.declareDocumentSdi);

/** The state the pill of the panel shows: the code at the end of the key of its words, `submitted` being «Inviata allo SDI» and `toSend` «da inviare». */
const pill = async () => within(await screen.findByTestId('fiscal-document-sdi')).findByTestId('fiscal-document-sdi-state');

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  read.mockResolvedValue(state());
});

afterEach(() => cleanup());

describe('the states towards the SDI are the server\'s: «inviata» only after the server says so (E17/F03/US01/T02, NF-116)', () => {
  it('submitVerdictOf_OnlyASubmissionThatTheServerConfirmsIsASuccess', () => {
    expect(submitVerdictOf(answer('Submitted', { status: 'submitted' }))).toBe('submitted');
    // The outcome says «took it» but the state the server answers does not: nothing is claimed.
    expect(submitVerdictOf(answer('Submitted', { status: 'to_send' }))).toBe('unconfirmed');
    expect(submitVerdictOf(answer('Refused', { status: 'to_send', errorCode: 'sdi_provider_refused' }))).toBe('refused');
    expect(submitVerdictOf(answer('NotConfigured', { status: 'to_send' }))).toBe('notConfigured');
    expect(submitVerdictOf(answer('AlreadySubmitted', { status: 'submitted' }))).toBe('alreadySubmitted');
    // An outcome this client does not know (the server is newer) is never read as a success.
    expect(submitVerdictOf(answer('SomethingNew', { status: 'submitted' }))).toBe('unconfirmed');
  });

  it('SdiPanel_BeforeTheServerSaysAnythingMore_TheDocumentIsToSendAndNotSent', async () => {
    renderPanel();

    expect(await pill()).toHaveAttribute('data-state', 'toSend');
    expect(screen.queryByText(i18n.t('fiscalDocuments.list.state.submitted'))).toBeNull();
  });

  it('SdiPanel_WhenTheChannelTakesTheFile_ItSaysSubmittedOnlyBecauseTheAnswerSaysIt', async () => {
    const submitted = { status: 'submitted', canSubmit: false, canDeclare: false };
    submit.mockResolvedValue(answer('Submitted', submitted));
    // The server holds the state it answered: the read that follows the write says the same.
    read.mockResolvedValueOnce(state()).mockResolvedValue(state(submitted));
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-submit'));

    expect(await screen.findByTestId('fiscal-document-sdi-verdict')).toHaveAttribute('data-verdict', 'submitted');
    await waitFor(async () => expect(await pill()).toHaveAttribute('data-state', 'submitted'));
  });

  it('SdiPanel_WhenTheAnswerDoesNotConfirmIt_SaysSoAndTheDocumentStaysToSend', async () => {
    submit.mockResolvedValue(answer('Submitted', { status: 'to_send' }));
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-submit'));

    expect(await screen.findByTestId('fiscal-document-sdi-verdict')).toHaveAttribute('data-verdict', 'unconfirmed');
    expect(await pill()).toHaveAttribute('data-state', 'toSend');
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('SdiPanel_WhenTheChannelRefusesTheFile_TheDocumentStaysToSendWithTheReasonInPlainWords', async () => {
    submit.mockResolvedValue(answer('Refused', { status: 'to_send', errorCode: 'sdi_provider_refused', reason: 'Il canale non ha accettato il file: controlla i dati.' }));
    read.mockResolvedValueOnce(state()).mockResolvedValue(state({ errorCode: 'sdi_provider_refused', reason: 'Il canale non ha accettato il file: controlla i dati.' }));
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-submit'));

    const verdict = await screen.findByTestId('fiscal-document-sdi-verdict');
    expect(verdict).toHaveAttribute('data-verdict', 'refused');
    expect(verdict).toHaveTextContent('Il canale non ha accettato il file: controlla i dati.');
    expect(await pill()).toHaveAttribute('data-state', 'toSend');
  });

  it('SdiPanel_WithNoChannelConnected_SaysNothingWasSentAndTheDocumentStaysToSend', async () => {
    read.mockResolvedValue(state({ providerConfigured: false }));
    submit.mockResolvedValue(answer('NotConfigured', { status: 'to_send', providerConfigured: false }));
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-submit'));

    expect(await screen.findByTestId('fiscal-document-sdi-verdict')).toHaveAttribute('data-verdict', 'notConfigured');
    expect(await pill()).toHaveAttribute('data-state', 'toSend');
  });

  it('SdiPanel_WhenTheCallGetsNoAnswer_NothingIsClaimedAndTheStateIsReadAgain', async () => {
    submit.mockRejectedValue(failure(undefined));
    renderPanel();
    await screen.findByTestId('fiscal-document-sdi-submit');
    const readsBefore = read.mock.calls.length;

    fireEvent.click(screen.getByTestId('fiscal-document-sdi-submit'));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByTestId('fiscal-document-sdi-verdict')).toBeNull();
    expect(await pill()).toHaveAttribute('data-state', 'toSend');
    // A call that got lost may have reached the channel: the state is asked again, never guessed.
    await waitFor(() => expect(read.mock.calls.length).toBeGreaterThan(readsBefore));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('SdiPanel_ADeclaredSending_IsDeclaredAndNeverSubmittedByTheChannel', async () => {
    const declared = state({ status: 'manual_declared', canSubmit: false, canDeclare: true, statusUpdatedAt: '2026-11-14T00:00:00Z' });
    declare.mockResolvedValue(declared);
    read.mockResolvedValueOnce(state()).mockResolvedValue(declared);
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-declare'));
    const dialog = await screen.findByTestId('fiscal-sdi-declare-dialog');
    fireEvent.change(within(dialog).getByTestId('fiscal-sdi-declare-reference'), { target: { value: 'IT01234567890_00001.xml' } });
    fireEvent.click(within(dialog).getByTestId('fiscal-sdi-declare-submit'));

    await waitFor(() => expect(declare).toHaveBeenCalledTimes(1));
    expect(declare.mock.calls[0][2]).toMatchObject({ kind: 'Sent', reference: 'IT01234567890_00001.xml' });
    // The words are the ones of a declaration, never «Inviata allo SDI» (the channel took nothing).
    await waitFor(async () => expect(await pill()).toHaveAttribute('data-state', 'manualDeclared'));
    expect(screen.queryByText(i18n.t('fiscalDocuments.list.state.submitted'))).toBeNull();
  });

  it('SdiPanel_WhenTheSdiAnswersAfterTheSending_TheBannerOfTheSendingDoesNotStayUnderTheRejection', async () => {
    submit.mockResolvedValue(answer('Submitted', { status: 'submitted', canSubmit: false, canDeclare: false }));
    // The first read has the document to send; the SDI answers while the panel is open: the read that follows the sending says it rejected the file.
    read
      .mockResolvedValueOnce(state())
      .mockResolvedValue(state({ status: 'rejected', errorCode: '00404', reason: 'Il codice fiscale del destinatario non è valido.', canSubmit: false, canDeclare: false, canCorrect: true }));
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-submit'));

    await waitFor(async () => expect(await pill()).toHaveAttribute('data-state', 'rejected'));
    // «Preso in carico dal canale» was what the server said when it was said: it is not what the document is now, and it is not told next to the rejection.
    expect(screen.queryByTestId('fiscal-document-sdi-verdict')).toBeNull();
    expect(screen.getByTestId('fiscal-document-sdi-reason')).toHaveTextContent('Il codice fiscale del destinatario non è valido.');
  });

  it('SdiPanel_AfterTheHandDeclaration_NoBannerKeepsTellingToDeclare', async () => {
    const declared = state({ status: 'manual_declared', canSubmit: false, canDeclare: true, statusUpdatedAt: '2026-11-14T00:00:00Z' });
    const noChannel = state({ providerConfigured: false });
    // The reads: the panel opens, the sending is answered (nothing changed), the declaration is answered.
    read.mockResolvedValueOnce(noChannel).mockResolvedValueOnce(noChannel).mockResolvedValue(declared);
    submit.mockResolvedValue(answer('NotConfigured', { status: 'to_send', providerConfigured: false }));
    declare.mockResolvedValue(declared);
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-submit'));
    expect(await screen.findByTestId('fiscal-document-sdi-verdict')).toHaveAttribute('data-verdict', 'notConfigured');
    await waitFor(() => expect(screen.getByTestId('fiscal-document-sdi-declare')).toBeEnabled());
    fireEvent.click(screen.getByTestId('fiscal-document-sdi-declare'));
    const dialog = await screen.findByTestId('fiscal-sdi-declare-dialog');
    fireEvent.change(within(dialog).getByTestId('fiscal-sdi-declare-reference'), { target: { value: 'IT01234567890_00001.xml' } });
    fireEvent.click(within(dialog).getByTestId('fiscal-sdi-declare-submit'));

    await waitFor(async () => expect(await pill()).toHaveAttribute('data-state', 'manualDeclared'));
    // The sentence that said «declare it by hand» is gone: the document is declared.
    expect(screen.queryByTestId('fiscal-document-sdi-verdict')).toBeNull();
  });

  it('SdiPanel_WhenTheStateIsReadAgainAndTheServerSaysNotFound_NothingOfTheOldStateStaysOnScreen', async () => {
    submit.mockResolvedValue(answer('Submitted', { status: 'submitted', canSubmit: false, canDeclare: false }));
    // The first read has the document; the read that follows the write finds it gone: a 404 is «not found» even though the cache still holds the old answer.
    read.mockResolvedValueOnce(state()).mockRejectedValue(failure(404));
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-submit'));

    expect(await screen.findByTestId('fiscal-document-sdi-gone')).toBeInTheDocument();
    expect(screen.queryByTestId('fiscal-document-sdi-state')).toBeNull();
    expect(screen.queryByTestId('fiscal-document-sdi-submit')).toBeNull();
  });

  it('SdiPanel_ADeclarationThatIsNotComplete_IsNotSent', async () => {
    renderPanel();

    fireEvent.click(await screen.findByTestId('fiscal-document-sdi-declare'));
    const dialog = await screen.findByTestId('fiscal-sdi-declare-dialog');
    // No reference: the server would refuse it with 422, so the dialog says what is missing and sends nothing.
    fireEvent.click(within(dialog).getByTestId('fiscal-sdi-declare-submit'));

    expect(await within(dialog).findByText(i18n.t('fiscalDocuments.sdi.declare.reference.error'))).toBeInTheDocument();
    expect(declare).not.toHaveBeenCalled();
  });
});
