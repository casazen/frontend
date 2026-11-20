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

/** The path of one review of the hub: its key goes escaped (`otareview:…` is `otareview%3A…`). */
function reviewThreadPath(threadKey: string): string {
  return `/messages/reviews/${encodeURIComponent(threadKey)}`;
}

function bookingReviewsPath(bookingId: string): string {
  return `/bookings/${encodeURIComponent(bookingId)}/reviews`;
}

/** The one key of a send: asking the channel manager again with the same key never sends it twice. */
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
  /**
   * `GET /api/messages/reviews/{threadKey}`: one review (`otareview:{id}` of a channel, `review:{id}` of the booking site) with its categories, the reply, the host's own review, the booking
   * card and what the host may do. 404 `review_not_found` (not there, of another organization, out of the reach, or never published), 400 `thread_key_invalid`.
   */
  getReviewThread: async (threadKey: string) => {
    const review = await ApiClient.get<ReviewThread>(reviewThreadPath(threadKey));
    // A page served in place of the answer (a rewrite that does not reach the API) is a load error, never a review.
    if (!isRecord(review) || !isRecord(review.reply) || !isRecord(review.capabilities) || typeof review.threadKey !== 'string') {
      throw new UnexpectedApiResponseError('/messages/reviews');
    }
    return review;
  },

  /**
   * `GET /api/bookings/{id}/reviews`: the reviews of the booking, the one of the site and the one of the channel, and what the channel of the booking allows even with no review yet.
   * It sits in a section of the page of the booking, which has other things on it: a 403 stays on the section (`localAuthRecovery`). 404 `booking_not_found`.
   */
  getBookingReviews: async (bookingId: string) => {
    const reviews = await ApiClient.get<BookingReviews>(bookingReviewsPath(bookingId), undefined, { localAuthRecovery: true });
    if (!isRecord(reviews) || !Array.isArray(reviews.items) || !isRecord(reviews.channelCapabilities)) {
      throw new UnexpectedApiResponseError('/bookings/reviews');
    }
    return reviews;
  },

  /**
   * `POST /api/bookings/{id}/reviews/refresh`: reads the booking from the channel manager now, at most once every ten minutes. Anything that is not a 200 says why: 429
   * `ota_review_refresh_too_soon` with `retryAfterSeconds`, 409 `octorate_not_connected`, `mapping_not_confirmed` or `review_not_available`, 422 `channel_not_integrated` or
   * `ota_review_booking_not_reviewable`, 502 `octorate_unavailable`.
   */
  refreshBookingReviews: (bookingId: string) => ApiClient.post<BookingReviews>(`${bookingReviewsPath(bookingId)}/refresh`),

  /**
   * `POST /api/reviews/ota/{id}/reply`: the host's public reply to the review of a channel, once, with the `Idempotency-Key` of the attempt. 200, or 202 when the outcome is not known
   * (`ManualVerify`: it is checked on the channel and never sent again by this call); 409 `ota_review_reply_already_sent`, `ota_review_action_unconfirmed`, `mapping_not_confirmed`;
   * 422 `ota_review_channel_not_supported`, `ota_review_not_published`, `review_reply_invalid`.
   */
  replyToOtaReview: (id: string, text: string, idempotencyKey: string) =>
    ApiClient.post<OtaReviewActionAnswer>(`/reviews/ota/${encodeURIComponent(id)}/reply`, { text }, idempotent(idempotencyKey)),

  /**
   * `POST /api/reviews/ota/{id}/host-review`: the host's own review of the guest, once, while the window of the channel is open. The same key, answers and rules as the reply; 409
   * `ota_review_window_closed`, 422 `ota_review_host_review_invalid` (no rating, a value that is not a whole number from 1 to 5, or no text).
   */
  sendHostReview: (id: string, command: HostReviewCommand, idempotencyKey: string) =>
    ApiClient.post<OtaReviewActionAnswer>(`/reviews/ota/${encodeURIComponent(id)}/host-review`, command, idempotent(idempotencyKey)),

  /** `POST /api/reviews/{id}/reply`: the host's one reply to a review of the booking site (the endpoint that was always there). 409 `review_reply_already_sent` for a second one. */
  replyToDirectReview: (id: string, text: string): Promise<HostReview> => hostReviewsApi.reply(id, text),

  /**
   * `POST /api/reviews/{reviewKey}/draft`: asks the assistant for a draft of the reply now. Nothing is sent: the draft waits in the approval queue, where the host reads it and decides. It
   * answers 404 while the assistant is off (`MessageAssistant`) and when the review is not there; 429 `rate_limited`.
   */
  requestReviewDraft: async (reviewKey: string) => {
    const outcome = await ApiClient.post<ReviewDraftOutcome>(`/reviews/${encodeURIComponent(reviewKey)}/draft`);
    if (!isRecord(outcome) || typeof outcome.status !== 'string') throw new UnexpectedApiResponseError('/reviews/draft');
    return outcome;
  },
};
