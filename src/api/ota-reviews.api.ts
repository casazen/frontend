import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type {
  BookingReviews,
  HostReview,
  HostReviewCommand,
  OtaReviewActionAnswer,
  ReviewDraftOutcome,
  ReviewThread,
} from '@/types';
import { ApiClient } from './client';
import { hostReviewsApi } from './reviews.api';

function reviewThreadPath(threadKey: string): string {
  return `/messages/reviews/${encodeURIComponent(threadKey)}`;
}

function bookingReviewsPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/reviews`;
}

function idempotent(idempotencyKey: string) {
  return { headers: { 'Idempotency-Key': idempotencyKey } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The reviews of the guests, of the booking site and of the channels (E05/F06/US02, NF-69, ADR-032). `booking.read` to read, `booking.write` to answer, to write the host's own
 * review and to ask for a draft; what a caller sees follows its reach on the properties (the server applies it), so a review of another organization, or out of the reach of a
 * collaborator «Solo alcuni», is a 404. Airbnb only on the side of the channel manager: for Booking.com, Vrbo and Expedia nothing is read or sent and the answer says why
 * (`capabilities.reason`). The words of the reviews are personal data: they go in the body, never in an address, and the answers are kept nowhere but in the memory of the page.
 */
export const otaReviewsApi = {
  getReviewThread: async (threadKey: string) => {
    const review = await ApiClient.get<ReviewThread>(reviewThreadPath(threadKey));
    if (!isRecord(review) || !isRecord(review.reply) || !isRecord(review.capabilities) || typeof review.threadKey !== 'string') {
      throw new UnexpectedApiResponseError('/messages/reviews');
    }
    return review;
  },

  getBookingReviews: async (bookingId: string) => {
    const reviews = await ApiClient.get<BookingReviews>(bookingReviewsPath(bookingId), undefined, { localAuthRecovery: true });
    if (!isRecord(reviews) || !Array.isArray(reviews.items) || !isRecord(reviews.channelCapabilities)) {
      throw new UnexpectedApiResponseError('/bookings/reviews');
    }
    return reviews;
  },

  refreshBookingReviews: (bookingId: string) => ApiClient.post<BookingReviews>(`${bookingReviewsPath(bookingId)}/refresh`),

  /**
   * `POST /api/reviews/ota/{id}/reply`: the host's public reply to the review of a channel, once, with the `Idempotency-Key` of the attempt. 200, or 202 when the outcome is not known
   * (`ManualVerify`: it is checked on the channel and never sent again by this call); 409 `ota_review_reply_already_sent`, `ota_review_action_unconfirmed`, `mapping_not_confirmed`;
   * 422 `ota_review_channel_not_supported`, `ota_review_not_published`, `review_reply_invalid`.
   */
  replyToOtaReview: (id: string, text: string, idempotencyKey: string) =>
    ApiClient.post<OtaReviewActionAnswer>(`/reviews/ota/${encodeURIComponent(id)}/reply`, { text }, idempotent(idempotencyKey)),

  sendHostReview: (id: string, command: HostReviewCommand, idempotencyKey: string) =>
    ApiClient.post<OtaReviewActionAnswer>(`/reviews/ota/${encodeURIComponent(id)}/host-review`, command, idempotent(idempotencyKey)),

  replyToDirectReview: (id: string, text: string): Promise<HostReview> => hostReviewsApi.reply(id, text),

  requestReviewDraft: async (reviewKey: string) => {
    const outcome = await ApiClient.post<ReviewDraftOutcome>(`/reviews/${encodeURIComponent(reviewKey)}/draft`);
    if (!isRecord(outcome) || typeof outcome.status !== 'string') throw new UnexpectedApiResponseError('/reviews/draft');
    return outcome;
  },
};
