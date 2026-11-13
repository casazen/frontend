import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { approvalQueueApi } from '@/api/approvalQueue.api';
import { approvalOutcome, originActionErrorOf, originErrorMessage } from '@/features/approvals/lib/approval-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { BOOKING_THREAD_QUERY, HOST_THREADS_QUERY, UNREAD_MESSAGES_QUERY } from '@/queries/use-booking-messages';
import { MESSAGE_HUB_QUERY, invalidateMessageHubLists } from '@/queries/use-message-hub';
import { NOTIFICATIONS_QUERY } from '@/queries/use-notifications';
import type { ApprovalQueueItem, RejectApprovalRequest } from '@/types/approval-queue.types';

const APPROVAL_QUEUE_KEY = 'approval-queue';
const PENDING_KEY = [APPROVAL_QUEUE_KEY, 'pending'] as const;

/** How often the queue is read again while its page is visible (AC-NF68-4): an item that has just been put in it shows up within this time. */
export const APPROVAL_QUEUE_POLL_MS = 60_000;

/** The queue and its items are stale after any decision: they are read again where a page shows them. */
export function invalidateQueue(queryClient: QueryClient): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: [APPROVAL_QUEUE_KEY] });
}

/**
 * Approving the draft of a message sends it to the guest, so the conversation that is open, the lists of the conversations and the counters of what waits for an
 * answer are stale too: a thread open in front of the host shows the message that went out without a reload.
 */
export function invalidateConversations(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'thread'] });
  invalidateMessageHubLists(queryClient);
  void queryClient.invalidateQueries({ queryKey: [HOST_THREADS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [UNREAD_MESSAGES_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [BOOKING_THREAD_QUERY] });
}

/** Puts the item the API answered (an edit) in the list that is shown, so the new text is on the screen before the list is read again. */
function replaceInPendingList(queryClient: QueryClient, item: ApprovalQueueItem): void {
  queryClient.setQueryData<ApprovalQueueItem[]>(PENDING_KEY, (list) => list?.map((candidate) => (candidate.id === item.id ? item : candidate)));
}

/**
 * A new item raises an alert for the people who may decide (the bell, the pop-up), so the in-app notifications change when one is put in
 * the queue: the queue is then read again at once, instead of at the next minute. Called with `cancelRefetch: false`, so that two
 * hooks on one page do not restart each other's reading.
 */
function useRefetchOnNotificationsChange(): void {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type === 'updated' && event.action.type === 'success' && event.query.queryKey[0] === NOTIFICATIONS_QUERY) {
          void queryClient.invalidateQueries({ queryKey: PENDING_KEY }, { cancelRefetch: false });
        }
      }),
    [queryClient],
  );
}

/** What an approval did, in a toast: the message that went out, the campaign that was scheduled, nothing linked; a warning when the host has something to check. */
function toastApproved(item: ApprovalQueueItem): void {
  const outcome = approvalOutcome(item);
  const message = i18n.t(outcome.key);
  if (outcome.tone === 'warning') toast.warning(message);
  else toast.success(message);
}

/**
 * Why an approval did not go through. When the action the item was waiting for failed (409 `approval_origin_action_failed`) the item stays in
 * the queue: the toast says so and gives the reason in plain words; the page keeps the item open with the same reason and a retry.
 */
function toastApproveFailed(error: unknown): void {
  const originCode = originActionErrorOf(error);
  if (originCode !== undefined) {
    toast.error(i18n.t('approval.action.originFailed'), { description: originErrorMessage(originCode, i18n.t) });
    return;
  }
  toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('approval.action.approveFailed'));
}

/**
 * How long a reading of the queue counts as fresh. The app keeps the data of a query fresh for five minutes, which would show the list of the last visit
 * without the item put in the queue meanwhile (the notifications are listened to only while the queue is on the screen): here a reading is fresh for half a
 * minute, like the ones of the hub of messages, so that the window coming back to the front reads again when it matters.
 */
export const APPROVAL_QUEUE_STALE_MS = 30_000;

/**
 * Pending approval items within the caller's organization and the properties of its reach (AC-NF06-1), oldest first. The list changes when
 * operators work on it elsewhere and when the assistant puts a draft in it, so it is read again at every visit (`refetchOnMount: 'always'`: `true` would
 * read only data that is stale, and the list of the last visit, up to five minutes old, would be shown without the new item), every minute while the page
 * is visible (not while the tab is hidden), when the window comes back to the front and its reading is older than {@link APPROVAL_QUEUE_STALE_MS}, and
 * when the in-app notifications change (AC-NF68-4).
 *
 * The items carry the text of the drafts of messages to guests: the reading is dropped as soon as no page shows it (`gcTime: 0`, the app keeps unobserved data for ten
 * minutes otherwise); it is read again at every visit anyway.
 */
export function usePendingApprovals() {
  useRefetchOnNotificationsChange();
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: () => approvalQueueApi.getPending(),
    gcTime: 0,
    staleTime: APPROVAL_QUEUE_STALE_MS,
    refetchOnMount: 'always',
    refetchInterval: APPROVAL_QUEUE_POLL_MS,
    refetchOnWindowFocus: true,
  });
}

/**
 * Approve an approval queue item: the action it was waiting for runs and the answer says how far it went. The toast tells it (message sent,
 * campaign scheduled, no action linked); `mutate(id, { onSuccess })` receives the item as the API answered it, with `originActionResult`. A failed
 * action is a 409 `approval_origin_action_failed`: the item stays pending (AC-NF68-1, AC-NF06-2).
 *
 * The answer carries the text of a message to a guest: the mutation is dropped as soon as nothing observes it (`gcTime: 0`, the cache of the mutations keeps results
 * for five minutes otherwise) and a refusal is kept without the request that was sent (`withoutRequest`: the status and the body of the answer stay, which is what a
 * screen turns into words). A message that went out makes the conversations stale.
 */
export function useApproveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async (id: string) => {
      try {
        return await approvalQueueApi.approve(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (item) => {
      toastApproved(item);
      if (item.itemType === 'MessageDraft') invalidateConversations(queryClient);
    },
    onError: toastApproveFailed,
    onSettled: () => {
      void invalidateQueue(queryClient);
    },
  });
}

/**
 * Save the text the host edited, before deciding: the original stays on the item and the approval acts with the edit (AC-NF68-2). A text
 * the API refuses is a 422 `approval_edit_invalid`. The text is the host's edit of a message to a guest: it is not kept in the cache of the mutations (`gcTime: 0`)
 * and a refusal is kept without the request that carried it (`withoutRequest`).
 */
export function useEditItem() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      try {
        return await approvalQueueApi.edit(id, text);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (item) => {
      replaceInPendingList(queryClient, item);
      toast.success(i18n.t('approval.action.edited'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('approval.action.editFailed'));
    },
    onSettled: () => {
      void invalidateQueue(queryClient);
    },
  });
}

/**
 * «Save and approve» in one step: the edit is saved and then approved, so the message that goes out is the edited one (AC-NF68-2). When the edit
 * is saved and the approval fails (409 `approval_origin_action_failed`) the item stays open with its new text, ready to try again. Kept like the approval and the edit:
 * no text in the cache of the mutations (`gcTime: 0`), no request in a refusal (`withoutRequest`).
 */
export function useSaveAndApproveItem() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      try {
        await approvalQueueApi.edit(id, text);
        return await approvalQueueApi.approve(id);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (item) => {
      toastApproved(item);
      if (item.itemType === 'MessageDraft') invalidateConversations(queryClient);
    },
    onError: toastApproveFailed,
    onSettled: () => {
      void invalidateQueue(queryClient);
    },
  });
}

/**
 * Reject an approval queue item: the reason is mandatory and is saved on the item (AC-NF68-3, AC-NF06-2). The reason is the host's own words about a message of a
 * guest: it is not kept in the cache of the mutations (`gcTime: 0`) and a refusal is kept without the request that carried it (`withoutRequest`).
 */
export function useRejectItem() {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async ({ id, data }: { id: string; data: RejectApprovalRequest }) => {
      try {
        return await approvalQueueApi.reject(id, data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: () => {
      toast.success(i18n.t('approval.action.rejected'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('approval.action.rejectFailed'));
    },
    onSettled: () => {
      void invalidateQueue(queryClient);
    },
  });
}
