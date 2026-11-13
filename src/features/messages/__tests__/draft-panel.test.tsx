import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { approvalQueueApi } from '@/api/approvalQueue.api';
import { assistantDraftsApi } from '@/api/assistant-drafts.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import i18n from '@/i18n/config';
import { expectNoAxeViolations } from '@/test/axe';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import type { AssistantDraftOutcome } from '@/types/assistant-drafts.types';
import { DraftPanel } from '../components/draft-panel';

const grants = vi.hoisted(() => ({ permissions: new Set<string>() }));

vi.mock('@/api/approvalQueue.api', () => ({ approvalQueueApi: { getPending: vi.fn(), edit: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock('@/api/assistant-drafts.api', () => ({ assistantDraftsApi: { requestDraft: vi.fn() } }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => grants.permissions.has(permission) }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const KEY = 'ota:6f1c9a52-1111-4222-8333-944455556666';
const OTHER_KEY = 'ota:aaaaaaaa-1111-4222-8333-944455556666';

function item(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: 'a1',
    itemType: 'MessageDraft',
    itemId: 'i1',
    contentText: 'Il check-in è dalle 15.',
    contentVersion: null,
    isAiGenerated: true,
    status: 'Pending',
    approvedByUserId: null,
    approvedAt: null,
    createdAt: '2026-11-10T08:00:00Z',
    expiresAt: '2026-11-17T08:00:00Z',
    propertyId: 'p1',
    originAction: 'SendGuestMessage',
    originActionStatus: 'Pending',
    originActionError: null,
    originActionExecutedAt: null,
    originActionResult: null,
    confidenceScore: 0.92,
    situationCode: 'check_in_time',
    threadKey: KEY,
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

function outcome(overrides: Partial<AssistantDraftOutcome> = {}): AssistantDraftOutcome {
  return {
    inboundMessageId: 'm1',
    decision: 'Drafted',
    reason: null,
    situation: 'CheckInTime',
    situationCode: 'check_in_time',
    urgency: 'Normal',
    confidenceScore: 0.9,
    approvalItemId: 'a1',
    activityId: null,
    ...overrides,
  };
}

function httpError(status: number, data: Record<string, unknown>): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderPanel(options: { flag?: boolean; canAsk?: boolean } = {}) {
  const { flag = true, canAsk = true } = options;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, messageAssistant: flag }, isLoading: false }}>
        <MemoryRouter>{children}</MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>
  );
  const view = render(<DraftPanel threadKey={KEY} canAsk={canAsk} />, { wrapper });
  return { ...view, client, invalidate };
}

describe('the draft of the assistant in the conversation (E05/F05/US04/T01)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    grants.permissions = new Set(['approval.decide', 'booking.write', 'property.write']);
    vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item()]);
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  describe('the flag and the permission', () => {
    it('draftPanel_FlagOff_RendersNothingAndAsksNothing', async () => {
      const { container } = renderPanel({ flag: false });

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(container).toBeEmptyDOMElement();
      expect(approvalQueueApi.getPending).not.toHaveBeenCalled();
    });

    it('draftPanel_WithoutTheRightToDecideApprovals_RendersNothingAndAsksNothing', async () => {
      grants.permissions = new Set(['booking.write', 'property.write']);
      const { container } = renderPanel();

      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(container).toBeEmptyDOMElement();
      expect(approvalQueueApi.getPending).not.toHaveBeenCalled();
    });
  });

  describe('a draft that waits', () => {
    it('draftPanel_PendingDraftOfTheConversation_ShowsItsTextTheSituationAndTheConfidenceInWords', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([
        item(),
        item({ id: 'other', threadKey: OTHER_KEY, contentText: 'Una bozza di un’altra conversazione.' }),
        item({ id: 'direct', itemType: 'Campaign', contentText: 'Una campagna.', threadKey: null }),
      ]);
      renderPanel();

      expect(await screen.findByTestId('assistant-draft-text')).toHaveTextContent('Il check-in è dalle 15.');
      expect(screen.queryByText(/altra conversazione/)).not.toBeInTheDocument();
      expect(screen.queryByText('Una campagna.')).not.toBeInTheDocument();
      expect(screen.getByTestId('assistant-draft-meta')).toHaveTextContent('Orario di check-in');
      // The words say how sure the assistant is; the number is only in the tip.
      expect(screen.getByTestId('assistant-draft-confidence')).toHaveTextContent('Alta affidabilità');
      expect(screen.getByTestId('assistant-draft-confidence')).toHaveAttribute('data-level', 'high');
      expect(screen.queryByText(/92\s*%/)).not.toBeInTheDocument();
      // Nothing is sent without the approval, and the guest is not told: the notice is on the panel.
      expect(screen.getByTestId('assistant-draft-transparency')).toHaveTextContent('Non parte nulla senza la tua approvazione');
      expect(screen.getByRole('button', { name: 'Approva e invia' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Modifica' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Rifiuta' })).toBeEnabled();
    });

    it('draftPanel_LowConfidence_AsksToCheckItCarefully', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item({ confidenceScore: 0.4 })]);
      renderPanel();

      expect(await screen.findByTestId('assistant-draft-confidence')).toHaveTextContent('Controllala con attenzione');
      expect(screen.getByTestId('assistant-draft-confidence')).toHaveAttribute('data-level', 'low');
    });

    it('draftPanel_TwoDraftsOfTheConversation_ShowsTheNewestOnly', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([
        item({ id: 'old', contentText: 'La bozza vecchia.', createdAt: '2026-11-10T08:00:00Z' }),
        item({ id: 'new', contentText: 'La bozza nuova.', createdAt: '2026-11-10T09:00:00Z' }),
      ]);
      renderPanel();

      expect(await screen.findByTestId('assistant-draft-text')).toHaveTextContent('La bozza nuova.');
      expect(screen.queryByText('La bozza vecchia.')).not.toBeInTheDocument();
    });

    it('draftPanel_HasNoAccessibilityViolation', async () => {
      const { container } = renderPanel();

      await screen.findByTestId('assistant-draft-text');
      await expectNoAxeViolations(container);
    });
  });

  describe('approving', () => {
    it('draftPanel_Approve_SendsOnceAndEveryButtonWaitsWhileItGoesOn', async () => {
      const pending = deferred<ApprovalQueueItem>();
      vi.mocked(approvalQueueApi.approve).mockReturnValue(pending.promise);
      const { invalidate } = renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Approva e invia' }));

      // Any request of the card in flight: no button takes a second click.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Modifica' })).toBeDisabled());
      expect(screen.getByRole('button', { name: 'Rifiuta' })).toBeDisabled();
      // The button that started it says it is busy (a loading button is not `disabled`: it keeps the focus) and takes no second click.
      expect(screen.getByRole('button', { name: /Approva e invia/ })).toHaveAttribute('aria-busy', 'true');
      fireEvent.click(screen.getByRole('button', { name: /Approva e invia/ }));
      expect(approvalQueueApi.approve).toHaveBeenCalledTimes(1);
      expect(approvalQueueApi.approve).toHaveBeenCalledWith('a1');

      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
      pending.resolve(item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'Sent' }));

      // What went out is said, and the conversation that is open and the lists of the hub are read again.
      expect(await screen.findByTestId('assistant-draft-notice')).toHaveTextContent('Messaggio inviato all\'ospite.');
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['message-hub', 'thread'] }));
    });

    it('draftPanel_ApproveThatTheChannelHasNotConfirmed_IsToldAsToCheckNeverAsSent', async () => {
      vi.mocked(approvalQueueApi.approve).mockResolvedValue(item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'ManualVerify' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Approva e invia' }));

      const notice = await screen.findByTestId('assistant-draft-notice');
      expect(notice).toHaveTextContent('Non sappiamo se il canale ha ricevuto il messaggio');
      expect(notice).not.toHaveTextContent('Messaggio inviato all\'ospite');
    });

    it('draftPanel_ApproveWhoseActionFailed_KeepsTheDraftWithTheReasonAndARetry', async () => {
      vi.mocked(approvalQueueApi.approve).mockRejectedValue(httpError(409, { code: 'approval_origin_action_failed', originActionError: 'thread_closed' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Approva e invia' }));

      expect(await screen.findByTestId('assistant-draft-failure')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-draft-text')).toHaveTextContent('Il check-in è dalle 15.');
      expect(screen.getByRole('button', { name: 'Riprova' })).toBeEnabled();
      expect(screen.queryByTestId('assistant-draft-notice')).not.toBeInTheDocument();
    });
  });

  describe('editing', () => {
    it('draftPanel_SaveAndApprove_SavesTheEditedTextAndThenApprovesIt', async () => {
      const calls: string[] = [];
      vi.mocked(approvalQueueApi.edit).mockImplementation(async (id, text) => {
        calls.push(`edit:${id}:${text}`);
        return item({ editedContentText: text });
      });
      vi.mocked(approvalQueueApi.approve).mockImplementation(async (id) => {
        calls.push(`approve:${id}`);
        return item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'Sent', editedContentText: 'Il check-in è dalle 16.' });
      });
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }));
      const box = within(screen.getByTestId('assistant-draft-editor')).getByRole('textbox');
      expect(box).toHaveValue('Il check-in è dalle 15.');
      fireEvent.change(box, { target: { value: 'Il check-in è dalle 16.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salva e approva' }));

      expect(await screen.findByTestId('assistant-draft-notice')).toBeInTheDocument();
      expect(calls).toEqual(['edit:a1:Il check-in è dalle 16.', 'approve:a1']);
    });

    it('draftPanel_EmptyEdit_IsNotSentAndSaysWhy', async () => {
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }));
      fireEvent.change(within(screen.getByTestId('assistant-draft-editor')).getByRole('textbox'), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salva e approva' }));

      expect(await screen.findByText('Scrivi il testo.')).toBeInTheDocument();
      expect(approvalQueueApi.edit).not.toHaveBeenCalled();
      expect(approvalQueueApi.approve).not.toHaveBeenCalled();
    });

    it('draftPanel_Save_KeepsTheEditForLaterWithoutApproving', async () => {
      vi.mocked(approvalQueueApi.edit).mockResolvedValue(item({ editedContentText: 'Dalle 14.', editedAt: '2026-11-10T09:00:00Z' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Modifica' }));
      fireEvent.change(within(screen.getByTestId('assistant-draft-editor')).getByRole('textbox'), { target: { value: 'Dalle 14.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salva' }));

      await waitFor(() => expect(approvalQueueApi.edit).toHaveBeenCalledWith('a1', 'Dalle 14.'));
      expect(approvalQueueApi.approve).not.toHaveBeenCalled();
    });
  });

  describe('rejecting', () => {
    it('draftPanel_Reject_NeedsAReasonAndSaysNothingWasSent', async () => {
      vi.mocked(approvalQueueApi.reject).mockResolvedValue(item({ status: 'Rejected', rejectionReason: 'Troppo lunga' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: 'Rifiuta' }));
      const dialog = await screen.findByTestId('approval-reject-dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Rifiuta' }));
      expect(await within(dialog).findByText('Scrivi il motivo del rifiuto.')).toBeInTheDocument();
      expect(approvalQueueApi.reject).not.toHaveBeenCalled();

      fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Troppo lunga' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Rifiuta' }));

      await waitFor(() => expect(approvalQueueApi.reject).toHaveBeenCalledWith('a1', { reason: 'Troppo lunga' }));
      expect(await screen.findByTestId('assistant-draft-notice')).toHaveTextContent('Non è stato inviato nulla.');
    });
  });

  describe('no draft yet', () => {
    beforeEach(() => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
    });

    it('draftPanel_NoPendingDraft_OffersToAskTheAssistantForOne', async () => {
      renderPanel();

      expect(await screen.findByTestId('assistant-draft-none')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: "Chiedi una bozza all'assistente" })).toBeEnabled();
    });

    it('draftPanel_CannotAsk_OffersNoButton', async () => {
      renderPanel({ canAsk: false });

      expect(await screen.findByTestId('assistant-draft-none')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: "Chiedi una bozza all'assistente" })).not.toBeInTheDocument();
    });

    it('draftPanel_Ask_RequestsTheDraftOfThisConversationAndReadsTheQueueAgain', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockResolvedValue(outcome());
      const { invalidate } = renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));

      await waitFor(() => expect(assistantDraftsApi.requestDraft).toHaveBeenCalledWith(KEY));
      await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: ['approval-queue'] }));
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['message-hub', 'thread', KEY] });
    });

    it('draftPanel_AskThatTheAssistantDidNotHandle_IsToldAsNotDoneWithItsReasonNeverAsADraft', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockResolvedValue(outcome({ decision: 'NotHandled', reason: 'assistant_disabled', approvalItemId: null }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));

      const result = await screen.findByTestId('assistant-draft-outcome');
      expect(result).toHaveTextContent("L'assistente è spento per la tua organizzazione o per questo immobile");
      expect(within(result).getByRole('link', { name: "Apri le impostazioni dell'assistente" })).toHaveAttribute('href', '/app/short-rent/settings/assistant');
      expect(screen.queryByTestId('assistant-draft-notice')).not.toBeInTheDocument();
    });

    it('draftPanel_AskThatNeedsThePermissionToWriteTheProperties_OffersNoLinkToTheSettings', async () => {
      grants.permissions = new Set(['approval.decide', 'booking.write']);
      vi.mocked(assistantDraftsApi.requestDraft).mockResolvedValue(outcome({ decision: 'NotHandled', reason: 'assistant_disabled', approvalItemId: null }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));

      const result = await screen.findByTestId('assistant-draft-outcome');
      expect(within(result).queryByRole('link')).not.toBeInTheDocument();
    });

    it('draftPanel_AskThatBecameAToDo_SaysNoDraftWasWrittenAndLinksTheList', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockResolvedValue(outcome({ decision: 'Escalated', reason: 'mode_escalate', approvalItemId: null, activityId: 'act1' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));

      const result = await screen.findByTestId('assistant-draft-outcome');
      expect(result).toHaveTextContent('non ha scritto una bozza');
      expect(within(result).getByRole('link', { name: 'Apri le attività da fare' })).toHaveAttribute('href', '/app/short-rent/activities');
    });

    it('draftPanel_AskWithADecisionThisVersionDoesNotKnow_IsToldAsNotDone', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockResolvedValue(outcome({ decision: 'SomethingNew' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));

      expect(await screen.findByTestId('assistant-draft-outcome')).toHaveTextContent('L’assistente non ha completato la richiesta');
    });

    it('draftPanel_OutcomeOfAnEarlierAsk_IsNotShownAgainAfterTheHostDecidedALaterDraft', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockResolvedValue(outcome({ decision: 'NotHandled', reason: 'thread_closed', approvalItemId: null }));
      vi.mocked(approvalQueueApi.approve).mockResolvedValue(item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'Sent' }));
      const { client } = renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));
      expect(await screen.findByTestId('assistant-draft-outcome')).toBeInTheDocument();

      // A draft arrives later (the job of the assistant) and the host approves it: once it is gone the old sentence is not the state of the panel.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item()]);
      await client.invalidateQueries({ queryKey: ['approval-queue'] });
      const approveButton = await screen.findByRole('button', { name: 'Approva e invia' });
      expect(screen.queryByTestId('assistant-draft-outcome')).not.toBeInTheDocument();

      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
      fireEvent.click(approveButton);

      expect(await screen.findByTestId('assistant-draft-notice')).toHaveTextContent("Messaggio inviato all'ospite.");
      await screen.findByTestId('assistant-draft-none');
      expect(screen.queryByTestId('assistant-draft-outcome')).not.toBeInTheDocument();
    });

    it('draftPanel_AskForAConversationThatIsGone_SaysItWasNotFoundWhateverTheCacheHolds', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockRejectedValue(httpError(404, { code: 'thread_not_found' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));

      expect(await screen.findByTestId('assistant-draft-request-error')).toHaveTextContent('Questa conversazione non è stata trovata.');
    });

    it('draftPanel_FailureOfAnEarlierAsk_IsNotShownOnceADraftIsThere', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockRejectedValue(httpError(404, { code: 'thread_not_found' }));
      const { client } = renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));
      expect(await screen.findByTestId('assistant-draft-request-error')).toBeInTheDocument();

      // The job of the assistant writes a draft meanwhile: it is the draft that counts, not the failure of the request.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item()]);
      await client.invalidateQueries({ queryKey: ['approval-queue'] });

      expect(await screen.findByTestId('assistant-draft-text')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-draft-request-error')).not.toBeInTheDocument();
    });

    it('draftPanel_AskWhenTheGuestWroteNothing_SaysSoInPlainWords', async () => {
      vi.mocked(assistantDraftsApi.requestDraft).mockRejectedValue(httpError(409, { code: 'assistant_no_guest_message' }));
      renderPanel();

      fireEvent.click(await screen.findByRole('button', { name: "Chiedi una bozza all'assistente" }));

      expect(await screen.findByTestId('assistant-draft-request-error')).toHaveTextContent("L’ospite non ha ancora scritto nulla");
    });
  });

  describe('when the queue cannot be read', () => {
    it('draftPanel_QueueThatFailedToLoad_IsAFailureNeverNoDraft', async () => {
      vi.mocked(approvalQueueApi.getPending).mockRejectedValue(httpError(500, {}));
      renderPanel();

      expect(await screen.findByTestId('assistant-draft-load-error')).toBeInTheDocument();
      expect(screen.queryByTestId('assistant-draft-none')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: "Chiedi una bozza all'assistente" })).not.toBeInTheDocument();
    });
  });
});
