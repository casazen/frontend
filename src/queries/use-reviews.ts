import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { hostReviewsApi, publicReviewsApi } from '@/api/reviews.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { retryTransientErrors } from '@/lib/query-client';
import type { ReportReviewPayload, ReviewInviteStatus, SubmitReviewPayload } from '@/types';

const REVIEWS_PAGE_SIZE = 10;

const PUBLIC_REVIEWS_KEY = 'public-reviews';
const REVIEW_LINK_KEY = 'review-link';
const HOST_REVIEWS_KEY = 'host-reviews';
const REVIEW_INVITE_KEY = 'review-invite';

function nextPageOf(page: { page: number; pageSize: number; totalCount: number }): number | undefined {
  return page.page * page.pageSize < page.totalCount ? page.page + 1 : undefined;
}

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

export function useReviewInviteStatus(bookingId: string, enabled: boolean) {
  return useQuery({
    queryKey: [REVIEW_INVITE_KEY, bookingId],
    queryFn: () => hostReviewsApi.getInviteStatus(bookingId),
    enabled: enabled && Boolean(bookingId),
    retry: retryTransientErrors(1),
    refetchOnMount: 'always',
  });
}

export function useSendReviewInvite(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => hostReviewsApi.sendInvite(bookingId),
    onSuccess: (status: ReviewInviteStatus) => {
      queryClient.setQueryData([REVIEW_INVITE_KEY, bookingId], status);
      toast.success(i18n.t('hostReviews.toast.inviteSent'));
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: [REVIEW_INVITE_KEY, bookingId] });
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('hostReviews.toast.inviteFailed'));
    },
  });
}
