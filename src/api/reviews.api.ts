import { ApiClient } from './client';
import type {
  HostReview,
  HostReviewPage,
  PublicReview,
  PublicReviewPage,
  ReportReviewPayload,
  ReviewInviteStatus,
  ReviewLinkInfo,
  SubmitReviewPayload,
} from '@/types';

/** The verified reviews on the public booking site (DB-12a). All anonymous: the guest's link token goes in the body, never in the URL. */
export const publicReviewsApi = {
  /** The public reviews of a property, newest first. `propertyId` may also be the slug of the property. */
  list: (orgSlug: string, propertyId: string, page: number, pageSize: number) =>
    ApiClient.get<PublicReviewPage>(
      `/public/orgs/${encodeURIComponent(orgSlug)}/properties/${encodeURIComponent(propertyId)}/reviews`,
      { page, pageSize },
      { public: true },
    ),

  /**
   * What the page of the link shows. 422 `review_link_invalid` for a link that is not ours, is expired or is for another booking;
   * 409 `review_not_available` when the stay can no longer be reviewed.
   */
  lookupLink: (bookingId: string, token: string) =>
    ApiClient.post<ReviewLinkInfo>(`/public/bookings/${encodeURIComponent(bookingId)}/review/lookup`, { token }, { public: true }),

  /** The guest's review, published at once. 409 `review_already_submitted` for the second one; 429 `rate_limited`. */
  submit: (bookingId: string, payload: SubmitReviewPayload) =>
    ApiClient.post<PublicReview>(`/public/bookings/${encodeURIComponent(bookingId)}/review`, payload, { public: true }),
};

/** The reviews of the host's properties, the one answer to each, the report to CasaZen and the invitation of the guests (DB-12a). */
export const hostReviewsApi = {
  list: (page: number, pageSize: number, propertyId?: string) =>
    ApiClient.get<HostReviewPage>('/reviews', { page, pageSize, propertyId }),

  /** The one answer of the host: 409 `review_reply_already_sent` if it already answered. */
  reply: (reviewId: string, text: string) => ApiClient.post<HostReview>(`/reviews/${encodeURIComponent(reviewId)}/reply`, { text }),

  /** The report to CasaZen; the review stays public until the staff decides. 409 `review_already_reported`. */
  report: (reviewId: string, payload: ReportReviewPayload) =>
    ApiClient.post<HostReview>(`/reviews/${encodeURIComponent(reviewId)}/report`, payload),

  getInviteStatus: (bookingId: string) => ApiClient.get<ReviewInviteStatus>(`/bookings/${encodeURIComponent(bookingId)}/review-invite`),

  /** Sends the guest the one email with the link to write the review. It leaves from this call only, once per booking. */
  sendInvite: (bookingId: string) =>
    ApiClient.post<ReviewInviteStatus>(`/bookings/${encodeURIComponent(bookingId)}/review-invite`),
};
