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

export const publicReviewsApi = {
  list: (orgSlug: string, propertyId: string, page: number, pageSize: number) =>
    ApiClient.get<PublicReviewPage>(
      `/public/orgs/${encodeURIComponent(orgSlug)}/properties/${encodeURIComponent(propertyId)}/reviews`,
      { page, pageSize },
      { public: true },
    ),

  lookupLink: (bookingId: string, token: string) =>
    ApiClient.post<ReviewLinkInfo>(`/public/bookings/${encodeURIComponent(bookingId)}/review/lookup`, { token }, { public: true }),

  submit: (bookingId: string, payload: SubmitReviewPayload) =>
    ApiClient.post<PublicReview>(`/public/bookings/${encodeURIComponent(bookingId)}/review`, payload, { public: true }),
};

export const hostReviewsApi = {
  list: (page: number, pageSize: number, propertyId?: string) =>
    ApiClient.get<HostReviewPage>('/reviews', { page, pageSize, propertyId }),

  reply: (reviewId: string, text: string) => ApiClient.post<HostReview>(`/reviews/${encodeURIComponent(reviewId)}/reply`, { text }),

  report: (reviewId: string, payload: ReportReviewPayload) =>
    ApiClient.post<HostReview>(`/reviews/${encodeURIComponent(reviewId)}/report`, payload),

  getInviteStatus: (bookingId: string) => ApiClient.get<ReviewInviteStatus>(`/bookings/${encodeURIComponent(bookingId)}/review-invite`),

  sendInvite: (bookingId: string) =>
    ApiClient.post<ReviewInviteStatus>(`/bookings/${encodeURIComponent(bookingId)}/review-invite`),
};
