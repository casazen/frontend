import { useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { otaReviewsApi } from '@/api/ota-reviews.api';
import { parseReviewKey, reasonText, reviewProblemMessage } from '@/features/messages/lib/review-model';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { isTransientRequestError } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';
import { invalidateQueue } from '@/queries/approvalQueue';
import { MESSAGE_HUB_POLL_MS, MESSAGE_HUB_QUERY, invalidateMessageHubLists, useRefetchOnNotificationsChange } from '@/queries/use-message-hub';
import { newIdempotencyKey } from '@/queries/use-thread-send';
import type { HostReviewCommand, OtaReviewActionState } from '@/types';

/** Root of the queries of the reviews of a booking: what each booking says about the reviews of its stay. */
export const OTA_REVIEWS_QUERY = 'ota-reviews';

/** The cache entry of one review of the hub (under the hub, so the live refresh of the hub reads it again). */
const reviewThreadKeyOf = (threadKey: string) => [MESSAGE_HUB_QUERY, 'review-thread', threadKey] as const;

/** The cache entry of the reviews of one booking. */
const bookingReviewsKeyOf = (bookingId: string) => [OTA_REVIEWS_QUERY, 'booking', bookingId] as const;

/**
 * What a review that appeared, a reply or the host's own review changes, wherever it is given or told (the page of a review, the section of a booking, the approval of a draft, the bell):
 * the reviews of the bookings, the reviews that are open, and the list of the hub, which holds the reviews under their own filter. They are marked stale and, where a page shows them,
 * read again at once.
 */
export function invalidateReviews(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [OTA_REVIEWS_QUERY] });
  void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'review-thread'] });
  invalidateMessageHubLists(queryClient);
}

/**
 * One review of the hub (`GET /api/messages/reviews/{threadKey}`, NF-69): the stars and the categories, the words of the guest, the reply and the host's own review with where they
 * stand, the booking card and what the channel allows. A review arrives, and a reply is confirmed or lost, from outside: it is read again when the page opens, on return to the
 * window, every minute while it is visible, and when the in-app notifications change.
 */
export function useReviewThread(threadKey: string, enabled: boolean = true) {
  useRefetchOnNotificationsChange(enabled);
  return useQuery({
    queryKey: reviewThreadKeyOf(threadKey),
    queryFn: () => otaReviewsApi.getReviewThread(threadKey),
    enabled: enabled && Boolean(threadKey),
    refetchInterval: MESSAGE_HUB_POLL_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: retryTransientErrors(1),
  });
}

/**
 * The reviews of a booking (`GET /api/bookings/{id}/reviews`, NF-69): the one of the site and the one of the channel, and what the channel of the booking allows when there is none. Read
 * again at every visit, on return to the window, when a review is told by the bell and every minute while the page is visible (never while the tab is hidden): that a reply which
 * «waits for the check» is on the channel now (or has turned into an error) is written by the job that reads the channel and no push tells it, so an open page has to ask. Nothing is
 * asked while `enabled` is false.
 */
export function useBookingReviews(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: bookingReviewsKeyOf(bookingId),
    queryFn: () => otaReviewsApi.getBookingReviews(bookingId),
    enabled: enabled && Boolean(bookingId),
    refetchInterval: MESSAGE_HUB_POLL_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    retry: retryTransientErrors(1),
  });
}

/**
 * «Aggiorna»: reads the booking from the channel manager now (`POST /api/bookings/{id}/reviews/refresh`, at most once every ten minutes). The answer is the reviews as they are after the
 * read and goes in place of what the section showed. A read that did not work is an error with its code (429 with the time to wait, 409, 422, 502): no toast, the section says why, in
 * its place. The answer holds the first words of the guests' reviews: it is dropped as soon as nothing observes it (`gcTime: 0`) and a refusal is kept without the request.
 */
export function useRefreshBookingReviews(bookingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        return await otaReviewsApi.refreshBookingReviews(bookingId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (reviews) => {
      queryClient.setQueryData(bookingReviewsKeyOf(bookingId), reviews);
      toast.success(i18n.t('reviews.booking.refreshed'));
      // The reviews of the hub may have changed with the read: the open ones and the list are read again (the section just got its own answer).
      void queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'review-thread'] });
      invalidateMessageHubLists(queryClient);
    },
  });
}

/** How a reply or the host's own review ended, as the page tells it. */
export interface ReviewSendResult {
  state: OtaReviewActionState;
  /** The code of a refusal (`Error`). */
  errorCode: string | null;
  /** The same key had been seen: what is shown is what was stored, and nothing was sent again. */
  replayed: boolean;
}

/**
 * One `Idempotency-Key` for each attempt, kept in a ref while the outcome of the attempt is not known (the pattern of `use-thread-send.ts`): a second click, or a retry after an answer that
 * was lost, sends the same text with the same key and the server answers what it stored, so a public reply never goes out twice; another text is another attempt with a key of its own.
 * `settle` forgets the key once the server has given an answer: a refusal (`Error`) is stored under its key and would be replayed for ever, so the next attempt needs a new one.
 */
function useAttemptKey() {
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const keyFor = useCallback((fingerprint: string): string => {
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: newIdempotencyKey() };
    return attempt.current.key;
  }, []);
  const settle = useCallback(() => {
    attempt.current = null;
  }, []);
  return { keyFor, settle };
}

/**
 * What a send says in a toast. A send is never told as done before the channel says so: `Sent` is the only success, `ManualVerify` is a warning (it is checked on the channel and never sent
 * again by a second click) and `Error` says why, in words.
 */
function toastSend(result: ReviewSendResult, texts: { sent: string; verify: string; refused: string }): void {
  if (result.state === 'Sent') toast.success(texts.sent);
  else if (result.state === 'Error') toast.error(reasonText(result.errorCode, i18n.t) ?? texts.refused);
  else toast.warning(texts.verify);
}

/**
 * The host's public reply to a review, once (NF-69). A review of a channel goes through the channel manager with the key of the attempt (`POST api/reviews/ota/{id}/reply`: 200, or 202
 * when the outcome is not known); the one of the booking site through the endpoint that was always there (a second one is a 409). The text is the host's own words about a guest: the
 * mutation is dropped as soon as nothing observes it (`gcTime: 0`) and a refusal is kept without the request that carried it. The review, the lists and the booking are read again
 * whatever came of it.
 */
export function useReplyToReview(threadKey: string) {
  const queryClient = useQueryClient();
  const attempts = useAttemptKey();
  return useMutation({
    gcTime: 0,
    mutationFn: async (text: string): Promise<ReviewSendResult> => {
      const target = parseReviewKey(threadKey);
      if (target === null) throw new Error('The key is not the one of a review');
      try {
        if (target.source === 'Review') {
          await otaReviewsApi.replyToDirectReview(target.id, text);
          return { state: 'Sent', errorCode: null, replayed: false };
        }
        const answer = await otaReviewsApi.replyToOtaReview(target.id, text, attempts.keyFor(text));
        attempts.settle();
        return { state: answer.state, errorCode: answer.errorCode ?? null, replayed: answer.replayed };
      } catch (error) {
        // An answer of the server settles the attempt; no answer, or a 5xx, leaves it open: the same text goes again with the same key.
        if (!isTransientRequestError(error)) attempts.settle();
        throw withoutRequest(error);
      }
    },
    onSuccess: (result) =>
      toastSend(result, {
        sent: i18n.t('reviews.thread.toast.replySent'),
        verify: i18n.t('reviews.thread.toast.replyVerify'),
        refused: i18n.t('reviews.thread.toast.replyRefused'),
      }),
    onError: (error) => toast.error(reviewProblemMessage(error, i18n.t) ?? i18n.t('reviews.thread.toast.replyFailed')),
    onSettled: () => invalidateReviews(queryClient),
  });
}

/**
 * The host's own review of the guest, once, while the window of the channel is open (`POST api/reviews/ota/{id}/host-review`, NF-69): the same key per attempt, answers and care as
 * {@link useReplyToReview}. Only a review of a channel has one.
 */
export function useSendHostReview(threadKey: string) {
  const queryClient = useQueryClient();
  const attempts = useAttemptKey();
  return useMutation({
    gcTime: 0,
    mutationFn: async (command: HostReviewCommand): Promise<ReviewSendResult> => {
      const target = parseReviewKey(threadKey);
      if (target?.source !== 'OtaReview') throw new Error('Only the review of a channel has a review of the host');
      try {
        const answer = await otaReviewsApi.sendHostReview(target.id, command, attempts.keyFor(JSON.stringify(command)));
        attempts.settle();
        return { state: answer.state, errorCode: answer.errorCode ?? null, replayed: answer.replayed };
      } catch (error) {
        if (!isTransientRequestError(error)) attempts.settle();
        throw withoutRequest(error);
      }
    },
    onSuccess: (result) =>
      toastSend(result, {
        sent: i18n.t('reviews.hostReview.toast.sent'),
        verify: i18n.t('reviews.hostReview.toast.verify'),
        refused: i18n.t('reviews.hostReview.toast.refused'),
      }),
    onError: (error) => toast.error(reviewProblemMessage(error, i18n.t) ?? i18n.t('reviews.hostReview.toast.failed')),
    onSettled: () => invalidateReviews(queryClient),
  });
}

/**
 * «Chiedi una bozza all'assistente»: asks for a draft of the reply to a review now (`POST api/reviews/{reviewKey}/draft`, NF-69). The answer says whether a draft was written (`Drafted`,
 * and it waits in the approval queue) or why not; it never carries a text, and nothing is sent. So the approval queue and the review are read again, and the mutation settles when they have
 * been: the button stays busy until the draft is on the screen. No toast: the panel says what happened.
 */
export function useRequestReviewDraft(threadKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        return await otaReviewsApi.requestReviewDraft(threadKey);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: async () => {
      await Promise.all([invalidateQueue(queryClient), queryClient.invalidateQueries({ queryKey: reviewThreadKeyOf(threadKey) })]);
    },
  });
}
