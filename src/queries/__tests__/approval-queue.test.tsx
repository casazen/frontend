import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { approvalQueueApi } from '@/api/approvalQueue.api';
import i18n from '@/i18n/config';
import { queryClient as appQueryClient } from '@/lib/query-client';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';
import {
  APPROVAL_QUEUE_POLL_MS,
  APPROVAL_QUEUE_STALE_MS,
  useApproveItem,
  useEditItem,
  usePendingApprovals,
  useRejectItem,
  useSaveAndApproveItem,
} from '../approvalQueue';
import { NOTIFICATIONS_QUERY, UNREAD_COUNT_KEY } from '../use-notifications';

vi.mock('@/api/approvalQueue.api', () => ({ approvalQueueApi: { getPending: vi.fn(), edit: vi.fn(), approve: vi.fn(), reject: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

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
    threadKey: 'ota:6f1c9a52-1111-4222-8333-944455556666',
    editedContentText: null,
    editedAt: null,
    rejectionReason: null,
    ...overrides,
  };
}

function httpError(status: number, data: Record<string, unknown>): AxiosError {
  return new AxiosError('failed', String(status), undefined, undefined, { status, data, statusText: '', headers: {}, config: {} as never });
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('the hooks of the approval queue (NF-68)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item()]);
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('usePendingApprovals', () => {
    it('usePendingApprovals_WhileThePageIsVisible_ReadsAgainEveryMinuteOnEveryVisitAndOnReturnToTheWindow', async () => {
      const { client, wrapper } = setup();
      const { result } = renderHook(() => usePendingApprovals(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const options = client.getQueryCache().findAll({ queryKey: ['approval-queue', 'pending'] })[0].observers[0].options;
      expect(options.refetchInterval).toBe(APPROVAL_QUEUE_POLL_MS);
      expect(APPROVAL_QUEUE_POLL_MS).toBe(60_000);
      // Not while the tab is hidden: the poll pauses by itself.
      expect(options.refetchIntervalInBackground).toBeFalsy();
      // `true` would read on a visit only data that is stale, and the app keeps data fresh for five minutes: every visit reads, and a reading is fresh for half a minute.
      expect(options.refetchOnMount).toBe('always');
      expect(options.staleTime).toBe(APPROVAL_QUEUE_STALE_MS);
      expect(APPROVAL_QUEUE_STALE_MS).toBeLessThanOrEqual(30_000);
      expect(options.refetchOnWindowFocus).toBe(true);
    });

    it('usePendingApprovals_ReopenedWithinTheFiveMinutesTheAppKeepsDataFresh_ReadsTheQueueAgainAtOnceAndShowsTheNewItem', async () => {
      // The options of the real client of the app (five minutes of freshness, no read on mount unless asked): a client with no staleTime would hide the case.
      const client = new QueryClient({ defaultOptions: appQueryClient.getDefaultOptions() });
      expect(client.getDefaultOptions().queries?.staleTime).toBe(5 * 60 * 1000);
      const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

      const firstVisit = renderHook(() => usePendingApprovals(), { wrapper });
      await waitFor(() => expect(firstVisit.result.current.data?.map((queued) => queued.id)).toEqual(['a1']));
      firstVisit.unmount();

      // While the host was on another page an item was put in the queue: nobody was listening to the notifications, and the last reading is a minute old.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item(), item({ id: 'new-one' })]);
      const secondVisit = renderHook(() => usePendingApprovals(), { wrapper });

      // The visit reads the queue at once: it does not show the list of the last visit until the next minute.
      await waitFor(() => expect(secondVisit.result.current.data?.map((queued) => queued.id)).toEqual(['a1', 'new-one']));
      expect(approvalQueueApi.getPending).toHaveBeenCalledTimes(2);
    });

    it('usePendingApprovals_ANewItemIsPutInTheQueue_ShowsUpWithinAMinuteWithoutAReload', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.mocked(approvalQueueApi.getPending).mockResolvedValueOnce([]).mockResolvedValue([item({ id: 'new-one' })]);
      const { wrapper } = setup();
      const { result } = renderHook(() => usePendingApprovals(), { wrapper });
      await waitFor(() => expect(result.current.data).toEqual([]));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(APPROVAL_QUEUE_POLL_MS);
      });

      await waitFor(() => expect(result.current.data?.map((queued) => queued.id)).toEqual(['new-one']));
      expect(approvalQueueApi.getPending).toHaveBeenCalledTimes(2);
    });

    it('usePendingApprovals_InAppNotificationsChange_ReadsTheQueueAgainAtOnce', async () => {
      const { client, wrapper } = setup();
      const { result } = renderHook(() => usePendingApprovals(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(approvalQueueApi.getPending).toHaveBeenCalledTimes(1);

      // What the real-time channel does when an alert is raised for the host: it writes the count of the bell (the alert of an item waiting for approval).
      act(() => {
        client.setQueryData(UNREAD_COUNT_KEY, 3);
      });
      await waitFor(() => expect(approvalQueueApi.getPending).toHaveBeenCalledTimes(2));

      act(() => {
        client.setQueryData([NOTIFICATIONS_QUERY, 'list'], { pages: [], pageParams: [] });
      });
      await waitFor(() => expect(approvalQueueApi.getPending).toHaveBeenCalledTimes(3));
    });
  });

  describe('useApproveItem', () => {
    it('useApproveItem_MessageSent_SaysTheMessageWentOutAndReadsTheQueueAgain', async () => {
      vi.mocked(approvalQueueApi.approve).mockResolvedValue(item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'Sent' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => ({ queue: usePendingApprovals(), approve: useApproveItem() }), { wrapper });
      await waitFor(() => expect(result.current.queue.isSuccess).toBe(true));

      await act(async () => {
        await result.current.approve.mutateAsync('a1');
      });

      expect(approvalQueueApi.approve).toHaveBeenCalledWith('a1');
      expect(toast.success).toHaveBeenCalledWith("Messaggio inviato all'ospite.");
      await waitFor(() => expect(approvalQueueApi.getPending).toHaveBeenCalledTimes(2));
    });

    it('useApproveItem_CampaignScheduledNoActionAndAlreadyApproved_EachSaysWhatHappened', async () => {
      const { wrapper } = setup();
      const { result } = renderHook(() => useApproveItem(), { wrapper });

      vi.mocked(approvalQueueApi.approve).mockResolvedValueOnce(item({ itemType: 'Campaign', status: 'Approved', originActionStatus: 'Executed', originActionResult: 'Scheduled' }));
      await act(async () => {
        await result.current.mutateAsync('a1');
      });
      expect(toast.success).toHaveBeenLastCalledWith('Campagna approvata e programmata.');

      vi.mocked(approvalQueueApi.approve).mockResolvedValueOnce(item({ itemType: 'Routine', status: 'Approved', originAction: 'None', originActionStatus: 'NotRequired' }));
      await act(async () => {
        await result.current.mutateAsync('a2');
      });
      expect(toast.success).toHaveBeenLastCalledWith("Approvato. Non c'era nessuna azione collegata da eseguire.");

      vi.mocked(approvalQueueApi.approve).mockResolvedValueOnce(item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: null }));
      await act(async () => {
        await result.current.mutateAsync('a3');
      });
      expect(toast.success).toHaveBeenLastCalledWith('Era già approvato: non è stato inviato di nuovo.');
    });

    it('useApproveItem_SendWhoseOutcomeIsNotKnown_IsAWarningNotASuccess', async () => {
      vi.mocked(approvalQueueApi.approve).mockResolvedValue(item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'ManualVerify' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useApproveItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('a1');
      });

      expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining('controllalo nella conversazione'));
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('useApproveItem_ActionFailed409_SaysWhyInPlainWordsAndTheItemStaysInTheQueue', async () => {
      vi.mocked(approvalQueueApi.approve).mockRejectedValue(httpError(409, { code: 'approval_origin_action_failed', originActionError: 'thread_closed' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => ({ queue: usePendingApprovals(), approve: useApproveItem() }), { wrapper });
      await waitFor(() => expect(result.current.queue.isSuccess).toBe(true));

      await act(async () => {
        await result.current.approve.mutateAsync('a1').catch(() => undefined);
      });

      expect(toast.error).toHaveBeenCalledWith("Non è stato possibile completare l'approvazione: l'elemento resta in attesa.", {
        description: 'Questa conversazione è chiusa: non si possono più scrivere messaggi.',
      });
      expect(toast.success).not.toHaveBeenCalled();
      // The queue is read again: the item is still in it, with the failure the server saved.
      await waitFor(() => expect(approvalQueueApi.getPending).toHaveBeenCalledTimes(2));
      expect(result.current.queue.data?.map((queued) => queued.id)).toEqual(['a1']);
    });

    it('useApproveItem_ItemAlreadyDecidedByAnother409_SaysSoWithTheWordsOfTheCode', async () => {
      vi.mocked(approvalQueueApi.approve).mockRejectedValue(httpError(409, { code: 'approval_item_not_pending' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useApproveItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('a1').catch(() => undefined);
      });

      expect(toast.error).toHaveBeenCalledWith("Questo elemento è già stato deciso o è scaduto. L'elenco si aggiorna da solo.");
    });
  });

  describe('useEditItem and useSaveAndApproveItem', () => {
    it('useEditItem_Saved_PutsTheEditedItemInTheListAndTellsIt', async () => {
      const edited = item({ editedContentText: 'Il check-in è dalle 16.', editedAt: '2026-11-10T09:00:00Z' });
      vi.mocked(approvalQueueApi.edit).mockResolvedValue(edited);
      const { wrapper } = setup();
      const { result } = renderHook(() => ({ queue: usePendingApprovals(), edit: useEditItem() }), { wrapper });
      await waitFor(() => expect(result.current.queue.isSuccess).toBe(true));
      // The list as it is read again after the edit still has the old text: the edited item is what the screen has meanwhile.
      vi.mocked(approvalQueueApi.getPending).mockResolvedValue([item()]);

      await act(async () => {
        await result.current.edit.mutateAsync({ id: 'a1', text: 'Il check-in è dalle 16.' });
      });

      expect(approvalQueueApi.edit).toHaveBeenCalledWith('a1', 'Il check-in è dalle 16.');
      expect(toast.success).toHaveBeenCalledWith('Modifica salvata');
    });

    it('useEditItem_TextTheApiRefuses_SaysWhy', async () => {
      vi.mocked(approvalQueueApi.edit).mockRejectedValue(httpError(422, { code: 'approval_edit_invalid' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useEditItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'a1', text: ' ' }).catch(() => undefined);
      });

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Il testo non è valido'));
    });

    it('useSaveAndApproveItem_EditSavedThenApproved_ApprovesTheEditedVersionAfterTheEdit', async () => {
      const order: string[] = [];
      vi.mocked(approvalQueueApi.edit).mockImplementation(async () => {
        order.push('edit');
        return item({ editedContentText: 'Dalle 16.' });
      });
      vi.mocked(approvalQueueApi.approve).mockImplementation(async () => {
        order.push('approve');
        return item({ status: 'Approved', originActionStatus: 'Executed', originActionResult: 'Sent', editedContentText: 'Dalle 16.' });
      });
      const { wrapper } = setup();
      const { result } = renderHook(() => useSaveAndApproveItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'a1', text: 'Dalle 16.' });
      });

      expect(order).toEqual(['edit', 'approve']);
      expect(approvalQueueApi.edit).toHaveBeenCalledWith('a1', 'Dalle 16.');
      expect(toast.success).toHaveBeenCalledWith("Messaggio inviato all'ospite.");
    });

    it('useSaveAndApproveItem_EditRefused_NeverApproves', async () => {
      vi.mocked(approvalQueueApi.edit).mockRejectedValue(httpError(422, { code: 'approval_edit_invalid' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useSaveAndApproveItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'a1', text: ' ' }).catch(() => undefined);
      });

      expect(approvalQueueApi.approve).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('useSaveAndApproveItem_ActionFailsAfterTheEditIsSaved_ReportsTheFailureOfTheAction', async () => {
      vi.mocked(approvalQueueApi.edit).mockResolvedValue(item({ editedContentText: 'Dalle 16.' }));
      vi.mocked(approvalQueueApi.approve).mockRejectedValue(httpError(409, { code: 'approval_origin_action_failed', originActionError: 'octorate_request_rejected' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useSaveAndApproveItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'a1', text: 'Dalle 16.' }).catch(() => undefined);
      });

      expect(toast.error).toHaveBeenCalledWith("Non è stato possibile completare l'approvazione: l'elemento resta in attesa.", {
        description: 'Il tuo channel manager non ha accettato il messaggio.',
      });
    });
  });

  describe('useRejectItem', () => {
    it('useRejectItem_WithAReason_SendsItAndTellsItWasRejected', async () => {
      vi.mocked(approvalQueueApi.reject).mockResolvedValue(item({ status: 'Rejected', rejectionReason: 'Non è corretto.' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useRejectItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'a1', data: { reason: 'Non è corretto.' } });
      });

      expect(approvalQueueApi.reject).toHaveBeenCalledWith('a1', { reason: 'Non è corretto.' });
      expect(toast.success).toHaveBeenCalledWith('Elemento rifiutato');
    });

    it('useRejectItem_ReasonMissing422_SaysTheReasonIsNeeded', async () => {
      vi.mocked(approvalQueueApi.reject).mockRejectedValue(httpError(422, { code: 'approval_rejection_reason_required' }));
      const { wrapper } = setup();
      const { result } = renderHook(() => useRejectItem(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'a1', data: { reason: '' } }).catch(() => undefined);
      });

      expect(toast.error).toHaveBeenCalledWith('Scrivi il motivo del rifiuto (al massimo 500 caratteri).');
    });
  });
});
