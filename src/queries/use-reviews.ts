import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hostReviewsApi, publicReviewsApi } from '@/api/reviews.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';
import type { ReportReviewPayload, ReviewInviteStatus, SubmitReviewPayload } from '@/types';

/** Reviews per page, on the public page and in the host's list: "Carica altre" asks for the next page. */
export const REVIEWS_PAGE_SIZE = 10;

const PUBLIC_REVIEWS_KEY = 'public-reviews';
const REVIEW_LINK_KEY = 'review-link';
const HOST_REVIEWS_KEY = 'host-reviews';
const REVIEW_INVITE_KEY = 'review-invite';

/** The next page number of a page of reviews, or `undefined` once the last one was read. */
function nextPageOf(page: { page: number; pageSize: number; totalCount: number }): number | undefined {
  return page.page * page.pageSize < page.totalCount ? page.page + 1 : undefined;
}

/** The public reviews of a property of the booking site, newest first, a page at a time. */
export function usePublicReviews(orgSlug: string | undefined, propertyId: string | undefined) {
  return useInfiniteQuery({
    queryKey: [PUBLIC_REVIEWS_KEY, orgSlug, propertyId],
    queryFn: ({ pageParam }) => publicReviewsApi.list(orgSlug!, propertyId!, pageParam, REVIEWS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPageOf,
    enabled: Boolean(orgSlug && propertyId),
    retry: retryTransientErrors(1),
  });
}

/** What the page of the review link shows. A link error is a state of the page, not something to retry. */
export function useReviewLink(bookingId: string | undefined, token: string | undefined) {
  return useQuery({
    queryKey: [REVIEW_LINK_KEY, bookingId, token],
    queryFn: () => publicReviewsApi.lookupLink(bookingId!, token!),
    enabled: Boolean(bookingId && token),
    retry: retryTransientErrors(1),
    refetchOnWindowFocus: false,
  });
}

/** The guest's review. No toast: the page shows the outcome (the review published, or what went wrong) itself. */
export function useSubmitReview(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SubmitReviewPayload) => publicReviewsApi.submit(bookingId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [REVIEW_LINK_KEY, bookingId] });
      void queryClient.invalidateQueries({ queryKey: [PUBLIC_REVIEWS_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['public-org-property'] });
    },
  });
}

/** The reviews of the host's properties, newest first. They change from outside (a guest writes), so the list is read again on every visit. */
export function useHostReviews() {
  return useInfiniteQuery({
    queryKey: [HOST_REVIEWS_KEY],
    queryFn: ({ pageParam }) => hostReviewsApi.list(pageParam, REVIEWS_PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: nextPageOf,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/** The one answer of the host to a review. */
export function useReplyToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, text }: { reviewId: string; text: string }) => hostReviewsApi.reply(reviewId, text),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [HOST_REVIEWS_KEY] });
      toast.success(i18n.t('hostReviews.toast.replied'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('hostReviews.toast.replyFailed')),
  });
}

/** The report of a review to CasaZen. */
export function useReportReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, payload }: { reviewId: string; payload: ReportReviewPayload }) => hostReviewsApi.report(reviewId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [HOST_REVIEWS_KEY] });
      toast.success(i18n.t('hostReviews.toast.reported'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('hostReviews.toast.reportFailed')),
  });
}

/** Whether the host can ask the guest of a booking for a review, and what already happened; nothing is read while `enabled` is false. */
export function useReviewInviteStatus(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: [REVIEW_INVITE_KEY, bookingId],
    queryFn: () => hostReviewsApi.getInviteStatus(bookingId),
    enabled: enabled && Boolean(bookingId),
    retry: retryTransientErrors(1),
    // The guest may write the review meanwhile: the state is read again each time the booking is opened.
    refetchOnMount: 'always',
  });
}

/** Asks the guest for the review: the one email, sent by this call only. */
export function useSendReviewInvite(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => hostReviewsApi.sendInvite(bookingId),
    onSuccess: (status: ReviewInviteStatus) => {
      queryClient.setQueryData([REVIEW_INVITE_KEY, bookingId], status);
      toast.success(i18n.t('hostReviews.toast.inviteSent'));
    },
    onError: (error) => {
      // A second ask, or a review that arrived meanwhile: the panel shows the real state.
      void queryClient.invalidateQueries({ queryKey: [REVIEW_INVITE_KEY, bookingId] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('hostReviews.toast.inviteFailed'));
    },
  });
}
