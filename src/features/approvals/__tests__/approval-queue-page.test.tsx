import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { approvalQueueApi } from '@/api/approvalQueue.api';
import i18n from '@/i18n/config';
import { ApprovalQueuePage } from '@/pages/ApprovalQueuePage';
import { expectNoAxeViolations } from '@/test/axe';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

vi.mock('@/api/approvalQueue.api', () => ({ approvalQueueApi: { getPending: vi.fn(), edit: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const THREAD = 'ota:6f1c9a52-1111-4222-8333-944455556666';

function item(overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return {
    id: 'draft-1',
    itemType: 'MessageDraft',
    itemId: 'm-1',
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
    threadKey: THREAD,
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

const CAMPAIGN = item({
  id: 'campaign-1',
  itemType: 'Campaign',
  contentText: 'Offerta di dicembre\n\nSconto del 10% per chi prenota presto.',
  originAction: 'ApproveCampaign',
  confidenceScore: null,
  situationCode: null,
  threadKey: null,
});

const ROUTINE = item({
  id: 'routine-1',
  itemType: 'Routine',
  contentText: 'Promemoria di prova della routine.',
  isAiGenerated: false,
  originAction: 'None',
  originActionStatus: 'NotRequired',
  confidenceScore: null,
  situationCode: null,
  threadKey: null,
});

function approved(of: ApprovalQueueItem, overrides: Partial<ApprovalQueueItem> = {}): ApprovalQueueItem {
  return { ...of, status: 'Approved', originActionStatus: 'Executed', approvedByUserId: 'auth0|me', approvedAt: '2026-11-10T09:00:00Z', ...overrides };
}

function httpError(status: number, data: Record<string, unknown>): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/app/short-rent/approval-queue']}>
        <ApprovalQueuePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const cards = () => screen.getAllByTestId('approval-item');
const cardOf = (id: string) => cards().find((card) => card.getAttribute('data-item-id') === id) as HTMLElement;

describe('ApprovalQueuePage (NF-68, NF-18)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item(), CAMPAIGN, ROUTINE]);
    await i18n.changeLanguage('it');
  });

  afterEach(() => cleanup());

  describe('what the page shows', () => {
    it('ApprovalQueuePage_PendingItems_ShowsTypeSituationConfidenceTextAndTheLinkToTheConversation', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item(), item({ id: 'draft-2', confidenceScore: 0.6, situationCode: 'complaint', contentText: 'Mi dispiace per il disagio.', threadKey: 'direct:0c9d2a10-aaaa-4bbb-8ccc-123456789abc' }), CAMPAIGN, ROUTINE]);
      renderPage();

      await screen.findAllByTestId('approval-item');
      expect(cards()).toHaveLength(4);

      const first = within(cards()[0]);
      expect(first.getByText('Bozza di messaggio')).toBeInTheDocument();
      expect(first.getByText('Orario di check-in')).toBeInTheDocument();
      // A clear label, with the number next to it, not only a number.
      expect(first.getByTestId('approval-item-confidence')).toHaveTextContent('Affidabilità: alta (92%)');
      expect(first.getByTestId('approval-item-confidence')).toHaveAttribute('data-level', 'high');
      expect(first.getByTestId('approval-item-text')).toHaveTextContent('Il check-in è dalle 15.');
      expect(first.getByRole('link', { name: 'Apri la conversazione' })).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent(THREAD)}`);
      expect(first.getByRole('button', { name: 'Approva e invia' })).toBeInTheDocument();
      expect(first.getByRole('button', { name: 'Modifica' })).toBeInTheDocument();
      expect(first.getByRole('button', { name: 'Rifiuta' })).toBeInTheDocument();

      const second = within(cards()[1]);
      expect(second.getByText('Reclamo')).toBeInTheDocument();
      expect(second.getByTestId('approval-item-confidence')).toHaveTextContent('Affidabilità: bassa, controllala bene (60%)');
      expect(second.getByTestId('approval-item-confidence')).toHaveAttribute('data-level', 'low');
      expect(second.getByRole('link', { name: 'Apri la conversazione' })).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent('direct:0c9d2a10-aaaa-4bbb-8ccc-123456789abc')}`);

      // A campaign is not a draft of a message: no situation, no score, no conversation.
      const campaign = within(cards()[2]);
      expect(campaign.getByText('Campagna')).toBeInTheDocument();
      expect(campaign.getByText('Offerta di dicembre')).toBeInTheDocument();
      expect(campaign.getByText('Sconto del 10% per chi prenota presto.')).toBeInTheDocument();
      expect(campaign.queryByTestId('approval-item-confidence')).toBeNull();
      expect(campaign.queryByRole('link', { name: 'Apri la conversazione' })).toBeNull();
      expect(campaign.getByRole('button', { name: 'Approva' })).toBeInTheDocument();

      expect(within(cards()[3]).getByText('Routine')).toBeInTheDocument();
    });

    it('ApprovalQueuePage_EditedItem_MarksTheEditShowsItAsTheTextAndKeepsTheOriginalWithinReach', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item({ editedContentText: 'Il check-in è dalle 16.', editedAt: '2026-11-10T08:30:00Z' })]);
      renderPage();

      const card = within(await screen.findByTestId('approval-item'));
      expect(card.getByTestId('approval-item-edited')).toHaveTextContent('Modificato');
      expect(card.getByTestId('approval-item-text')).toHaveTextContent('Il check-in è dalle 16.');
      expect(card.getByTestId('approval-item-original')).toHaveTextContent('Il check-in è dalle 15.');
    });

    it('ApprovalQueuePage_TypeFilter_IncludesMessageDraftsAndNarrowsTheList', async () => {
      renderPage();
      await screen.findAllByTestId('approval-item');

      const filter = screen.getByLabelText('Tipo');
      expect(within(filter).getByRole('option', { name: 'Bozza di messaggio' })).toBeInTheDocument();
      expect(within(filter).getByRole('option', { name: 'Campagna' })).toBeInTheDocument();

      fireEvent.change(filter, { target: { value: 'MessageDraft' } });
      expect(cards()).toHaveLength(1);
      expect(cards()[0]).toHaveAttribute('data-item-type', 'MessageDraft');

      fireEvent.change(filter, { target: { value: 'AiText' } });
      expect(screen.queryAllByTestId('approval-item')).toHaveLength(0);
      expect(screen.getByText('Nessun elemento corrisponde ai filtri selezionati')).toBeInTheDocument();
    });

    it('ApprovalQueuePage_EmptyQueue_SaysNothingWaits', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
      renderPage();

      expect(await screen.findByText('Non ci sono elementi in attesa di approvazione')).toBeInTheDocument();
    });

    it('ApprovalQueuePage_ReadingFailsWithNothingToShow_SaysSoAndKeepsItsTitle', async () => {
      vi.mocked(approvalQueueApi.getPending).mockRejectedValue(httpError(500, {}));
      renderPage();

      expect(await screen.findByText('Impossibile caricare la coda di approvazione')).toBeInTheDocument();
      // The page keeps its head (and with it its tabs): the other queue of decisions is still one click away.
      expect(screen.getByRole('heading', { level: 1, name: 'Coda di approvazione' })).toBeInTheDocument();
      expect(screen.queryByTestId('approval-item')).toBeNull();
    });

    it('ApprovalQueuePage_WithItems_HasNoAccessibilityViolationAndNamesItsActions', async () => {
      const { container } = renderPage();
      await screen.findAllByTestId('approval-item');

      await expectNoAxeViolations(container);
    });
  });

  describe('approve (AC-NF68-1)', () => {
    it('ApprovalQueuePage_Approve_SaysWhatItDidAndKeepsTheDecisionBelowWhileTheItemLeavesTheQueue', async () => {
      const draft = item();
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([draft, CAMPAIGN]).mockResolvedValue([CAMPAIGN]);
      vi.mocked(approvalQueueApi.approve).mockResolvedValue(approved(draft, { originActionResult: 'Sent' }));
      renderPage();
      await screen.findAllByTestId('approval-item');

      fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Approva e invia' }));

      await waitFor(() => expect(approvalQueueApi.approve).toHaveBeenCalledWith('draft-1'));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Messaggio inviato all'ospite."));
      // The item left the queue; what was decided stays on the page, with the outcome.
      await waitFor(() => expect(screen.getAllByTestId('approval-item')).toHaveLength(1));
      const decided = within(screen.getByTestId('approval-decided'));
      expect(decided.getByTestId('approval-decided-outcome')).toHaveTextContent("Messaggio inviato all'ospite.");
      expect(decided.getByText('Approvato')).toBeInTheDocument();
    });

    it('ApprovalQueuePage_ApproveCampaignAndItemWithNoAction_EachSaysWhatItDid', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([CAMPAIGN, ROUTINE]);
      vi.mocked(approvalQueueApi.approve)
        .mockResolvedValueOnce(approved(CAMPAIGN, { originActionResult: 'Scheduled' }))
        .mockResolvedValueOnce(approved(ROUTINE, { originActionStatus: 'NotRequired' }));
      renderPage();
      await screen.findAllByTestId('approval-item');

      fireEvent.click(within(cardOf('campaign-1')).getByRole('button', { name: 'Approva' }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Campagna approvata e programmata.'));

      fireEvent.click(within(cardOf('routine-1')).getByRole('button', { name: 'Approva' }));
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Approvato. Non c'era nessuna azione collegata da eseguire."));
    });

    it('ApprovalQueuePage_ActionFails_KeepsTheItemOpenWithTheReasonInPlainWordsAndARetry', async () => {
      const draft = item();
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([draft]);
      vi.mocked(approvalQueueApi.approve)
        .mockRejectedValueOnce(httpError(409, { code: 'approval_origin_action_failed', originActionError: 'thread_closed' }))
        .mockResolvedValueOnce(approved(draft, { originActionResult: 'Sent' }));
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Approva e invia' }));

      // The item stays open: the reason in plain words (not a code), what it means and a way to try again.
      const failure = await screen.findByTestId('approval-item-failure');
      expect(failure).toHaveTextContent("Non è stato possibile completare l'approvazione: l'elemento resta in attesa.");
      expect(failure).toHaveTextContent('Questa conversazione è chiusa: non si possono più scrivere messaggi.');
      expect(failure).not.toHaveTextContent('thread_closed');
      expect(screen.getByTestId('approval-item')).toBeInTheDocument();
      expect(screen.queryByTestId('approval-decided')).toBeNull();
      expect(toast.error).toHaveBeenCalledWith("Non è stato possibile completare l'approvazione: l'elemento resta in attesa.", {
        description: 'Questa conversazione è chiusa: non si possono più scrivere messaggi.',
      });

      // «Riprova» approves again: the answer is the same call, and the second time it goes through.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([]);
      fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
      await waitFor(() => expect(approvalQueueApi.approve).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(screen.queryByTestId('approval-item-failure')).toBeNull());
      expect(await screen.findByTestId('approval-decided-outcome')).toHaveTextContent("Messaggio inviato all'ospite.");
    });

    it('ApprovalQueuePage_ItemWhoseLastActionFailed_ShowsTheFailureTheServerSavedWithARetry', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item({ originActionStatus: 'Failed', originActionError: 'mapping_not_confirmed' })]);
      renderPage();

      const failure = await screen.findByTestId('approval-item-failure');
      expect(failure).toHaveTextContent("L'annuncio non è ancora collegato a un tuo immobile: il messaggio non è stato inviato.");
      expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Approva e invia' })).toBeNull();
    });

    it('ApprovalQueuePage_SendWhoseOutcomeIsNotKnown_AsksToCheckTheConversation', async () => {
      const draft = item();
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([draft]).mockResolvedValue([]);
      vi.mocked(approvalQueueApi.approve).mockResolvedValue(approved(draft, { originActionResult: 'ManualVerify' }));
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Approva e invia' }));

      await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('controllalo nella conversazione')));
      expect(toast.success).not.toHaveBeenCalled();
      const decided = await screen.findByTestId('approval-decided');
      // The way to check it is right there.
      expect(within(decided).getByRole('link', { name: 'Apri la conversazione' })).toHaveAttribute('href', `/app/short-rent/messages/${encodeURIComponent(THREAD)}`);
    });

    it('ApprovalQueuePage_ItemDecidedByAnotherPerson_SaysSoAndReadsTheQueueAgain', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([item()]).mockResolvedValue([]);
      vi.mocked(approvalQueueApi.approve).mockRejectedValue(httpError(409, { code: 'approval_item_not_pending' }));
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Approva e invia' }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Questo elemento è già stato deciso o è scaduto. L'elenco si aggiorna da solo."));
      await waitFor(() => expect(screen.queryByTestId('approval-item')).toBeNull());
      expect(screen.queryByTestId('approval-item-failure')).toBeNull();
    });
  });

  describe('edit (AC-NF68-2)', () => {
    it('ApprovalQueuePage_Edit_ShowsTheOriginalAndSaveAndApproveApprovesTheEditedVersion', async () => {
      const draft = item();
      const order: string[] = [];
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([draft]).mockResolvedValue([]);
      vi.mocked(approvalQueueApi.edit).mockImplementation(async () => {
        order.push('edit');
        return { ...draft, editedContentText: 'Il check-in è dalle 16.' };
      });
      vi.mocked(approvalQueueApi.approve).mockImplementation(async () => {
        order.push('approve');
        return approved({ ...draft, editedContentText: 'Il check-in è dalle 16.' }, { originActionResult: 'Sent' });
      });
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));

      const dialog = within(await screen.findByTestId('approval-edit-dialog'));
      // The dialog keeps the original visible while the host writes.
      expect(dialog.getByTestId('approval-edit-original')).toHaveTextContent('Il check-in è dalle 15.');
      const field = dialog.getByLabelText('Testo');
      expect(field).toHaveValue('Il check-in è dalle 15.');
      fireEvent.change(field, { target: { value: 'Il check-in è dalle 16.' } });

      fireEvent.click(dialog.getByRole('button', { name: 'Salva e approva' }));

      await waitFor(() => expect(approvalQueueApi.approve).toHaveBeenCalledWith('draft-1'));
      expect(approvalQueueApi.edit).toHaveBeenCalledWith('draft-1', 'Il check-in è dalle 16.');
      expect(order).toEqual(['edit', 'approve']);
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Messaggio inviato all'ospite."));
      await waitFor(() => expect(screen.queryByTestId('approval-edit-dialog')).toBeNull());
      expect(await screen.findByTestId('approval-decided-outcome')).toBeInTheDocument();
    });

    it('ApprovalQueuePage_EditAndSave_KeepsTheEditForLaterWithoutApproving', async () => {
      const draft = item();
      vi.mocked(approvalQueueApi.edit).mockResolvedValue({ ...draft, editedContentText: 'Dalle 16.', editedAt: '2026-11-10T09:30:00Z' });
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([draft]).mockResolvedValue([{ ...draft, editedContentText: 'Dalle 16.', editedAt: '2026-11-10T09:30:00Z' }]);
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));
      // Nothing changed yet: there is nothing to save.
      expect(dialog.getByRole('button', { name: 'Salva' })).toBeDisabled();
      fireEvent.change(dialog.getByLabelText('Testo'), { target: { value: 'Dalle 16.' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Salva' }));

      await waitFor(() => expect(approvalQueueApi.edit).toHaveBeenCalledWith('draft-1', 'Dalle 16.'));
      expect(approvalQueueApi.approve).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByTestId('approval-edit-dialog')).toBeNull());
      // The card shows the edit, marked, with the original behind it.
      expect(await screen.findByTestId('approval-item-edited')).toBeInTheDocument();
      expect(screen.getByTestId('approval-item-text')).toHaveTextContent('Dalle 16.');
    });

    it('ApprovalQueuePage_EditedItem_OpensTheDialogOnTheEditAndCanPutTheOriginalBack', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item({ editedContentText: 'Dalle 16.' })]);
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));
      const field = dialog.getByLabelText('Testo');
      expect(field).toHaveValue('Dalle 16.');

      fireEvent.click(dialog.getByRole('button', { name: "Ripristina l'originale" }));
      expect(field).toHaveValue('Il check-in è dalle 15.');
    });

    it('ApprovalQueuePage_MessageLongerThanTheLimit_SaysSoAndSendsNothing', async () => {
      renderPage();
      await screen.findAllByTestId('approval-item');
      fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));

      fireEvent.change(dialog.getByLabelText('Testo'), { target: { value: 'x'.repeat(2001) } });
      fireEvent.click(dialog.getByRole('button', { name: 'Salva e approva' }));

      expect(await dialog.findByText('Il testo è troppo lungo: al massimo 2000 caratteri.')).toBeInTheDocument();
      expect(approvalQueueApi.edit).not.toHaveBeenCalled();
      expect(approvalQueueApi.approve).not.toHaveBeenCalled();
    });

    it('ApprovalQueuePage_EmptyText_SaysSoAndSendsNothing', async () => {
      renderPage();
      await screen.findAllByTestId('approval-item');
      fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));

      fireEvent.change(dialog.getByLabelText('Testo'), { target: { value: '   ' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Salva e approva' }));

      expect(await dialog.findByText('Scrivi il testo.')).toBeInTheDocument();
      expect(approvalQueueApi.edit).not.toHaveBeenCalled();
    });

    it('ApprovalQueuePage_EditCampaign_KeepsTheSubjectLineABlankLineAndTheBody', async () => {
      vi.mocked(approvalQueueApi.edit).mockResolvedValue({ ...CAMPAIGN, editedContentText: 'Nuova offerta\n\nSconto del 10% per chi prenota presto.' });
      renderPage();
      await screen.findAllByTestId('approval-item');
      fireEvent.click(within(cardOf('campaign-1')).getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));

      // Two fields: the subject line (on one line) and the body.
      const subject = dialog.getByLabelText('Oggetto');
      expect(subject).toHaveValue('Offerta di dicembre');
      expect(dialog.getByLabelText('Testo della campagna')).toHaveValue('Sconto del 10% per chi prenota presto.');
      fireEvent.change(subject, { target: { value: 'Nuova offerta' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Salva' }));

      await waitFor(() => expect(approvalQueueApi.edit).toHaveBeenCalledWith('campaign-1', 'Nuova offerta\n\nSconto del 10% per chi prenota presto.'));
    });

    it('ApprovalQueuePage_CampaignWithoutASubject_SaysSoAndSendsNothing', async () => {
      renderPage();
      await screen.findAllByTestId('approval-item');
      fireEvent.click(within(cardOf('campaign-1')).getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));

      fireEvent.change(dialog.getByLabelText('Oggetto'), { target: { value: '  ' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Salva e approva' }));

      expect(await dialog.findByText("Scrivi l'oggetto della campagna.")).toBeInTheDocument();
      expect(approvalQueueApi.edit).not.toHaveBeenCalled();
    });

    it('ApprovalQueuePage_EditRefusedByTheApi_StaysOpenWithTheReason', async () => {
      vi.mocked(approvalQueueApi.edit).mockRejectedValue(httpError(422, { code: 'approval_edit_invalid' }));
      renderPage();
      await screen.findAllByTestId('approval-item');
      fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));

      fireEvent.change(dialog.getByLabelText('Testo'), { target: { value: 'Va bene così' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Salva e approva' }));

      expect(await dialog.findByText(/Il testo non è valido/)).toBeInTheDocument();
      expect(approvalQueueApi.approve).not.toHaveBeenCalled();
      expect(screen.getByTestId('approval-edit-dialog')).toBeInTheDocument();
    });

    it('ApprovalQueuePage_SaveAndApproveFailsAfterTheEditIsSaved_KeepsTheItemOpenOnThePageWithTheFailure', async () => {
      const draft = item();
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([{ ...draft, editedContentText: 'Dalle 16.', originActionStatus: 'Failed', originActionError: 'octorate_request_rejected' }]);
      vi.mocked(approvalQueueApi.edit).mockResolvedValue({ ...draft, editedContentText: 'Dalle 16.' });
      vi.mocked(approvalQueueApi.approve).mockRejectedValue(httpError(409, { code: 'approval_origin_action_failed', originActionError: 'octorate_request_rejected' }));
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Modifica' }));
      const dialog = within(await screen.findByTestId('approval-edit-dialog'));
      fireEvent.change(dialog.getByLabelText('Testo'), { target: { value: 'Dalle 16.' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Salva e approva' }));

      await waitFor(() => expect(screen.queryByTestId('approval-edit-dialog')).toBeNull());
      expect(await screen.findByTestId('approval-item-failure')).toHaveTextContent('Il tuo channel manager non ha accettato il messaggio.');
      expect(screen.getByTestId('approval-item-text')).toHaveTextContent('Dalle 16.');
      expect(screen.getByRole('button', { name: 'Riprova' })).toBeInTheDocument();
      expect(screen.queryByTestId('approval-decided')).toBeNull();
    });
  });

  describe('reject (AC-NF68-3)', () => {
    it('ApprovalQueuePage_RejectWithoutAReason_AsksForItAndSendsNothing', async () => {
      renderPage();
      await screen.findAllByTestId('approval-item');

      fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Rifiuta' }));
      const dialog = within(await screen.findByTestId('approval-reject-dialog'));
      fireEvent.click(dialog.getByRole('button', { name: 'Rifiuta' }));

      expect(await dialog.findByText('Scrivi il motivo del rifiuto.')).toBeInTheDocument();
      expect(approvalQueueApi.reject).not.toHaveBeenCalled();

      // A reason of blanks is no reason.
      fireEvent.change(dialog.getByLabelText('Motivo del rifiuto'), { target: { value: '   ' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Rifiuta' }));
      expect(approvalQueueApi.reject).not.toHaveBeenCalled();
    });

    it('ApprovalQueuePage_RejectWithAReason_SavesItAndShowsItAfterwardsOnTheRejectedItem', async () => {
      const draft = item();
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([draft, CAMPAIGN]).mockResolvedValue([CAMPAIGN]);
      vi.mocked(approvalQueueApi.reject).mockResolvedValue({ ...draft, status: 'Rejected', rejectionReason: 'Non è il tono giusto.' });
      renderPage();
      await screen.findAllByTestId('approval-item');

      fireEvent.click(within(cards()[0]).getByRole('button', { name: 'Rifiuta' }));
      const dialog = within(await screen.findByTestId('approval-reject-dialog'));
      fireEvent.change(dialog.getByLabelText('Motivo del rifiuto'), { target: { value: '  Non è il tono giusto.  ' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Rifiuta' }));

      await waitFor(() => expect(approvalQueueApi.reject).toHaveBeenCalledWith('draft-1', { reason: 'Non è il tono giusto.' }));
      await waitFor(() => expect(screen.queryByTestId('approval-reject-dialog')).toBeNull());
      await waitFor(() => expect(screen.getAllByTestId('approval-item')).toHaveLength(1));

      // The queue lists only what waits: the reason stays on the page, on the item that was rejected.
      const rejected = within(screen.getByTestId('approval-decided-item'));
      expect(rejected.getByText('Rifiutato')).toBeInTheDocument();
      expect(rejected.getByTestId('approval-decided-reason')).toHaveTextContent('Non è il tono giusto.');
      expect(toast.success).toHaveBeenCalledWith('Elemento rifiutato');
    });

    it('ApprovalQueuePage_RejectOfAnItemAlreadyDecided_ClosesTheDialogAndSaysSo', async () => {
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([item()]).mockResolvedValue([]);
      vi.mocked(approvalQueueApi.reject).mockRejectedValue(httpError(409, { code: 'approval_item_not_pending' }));
      renderPage();
      await screen.findByTestId('approval-item');

      fireEvent.click(screen.getByRole('button', { name: 'Rifiuta' }));
      const dialog = within(await screen.findByTestId('approval-reject-dialog'));
      fireEvent.change(dialog.getByLabelText('Motivo del rifiuto'), { target: { value: 'Non serve.' } });
      fireEvent.click(dialog.getByRole('button', { name: 'Rifiuta' }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Questo elemento è già stato deciso o è scaduto. L'elenco si aggiorna da solo."));
      await waitFor(() => expect(screen.queryByTestId('approval-reject-dialog')).toBeNull());
      expect(screen.queryByTestId('approval-decided')).toBeNull();
    });
  });
});
