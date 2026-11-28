export const REVIEW_TEXT_MAX_LENGTH = 1500;
export const REVIEW_REPLY_MAX_LENGTH = 800;
export const REVIEW_REPORT_NOTE_MAX_LENGTH = 500;

export const REVIEW_MAX_RATING = 5;

export interface RatingSummary {
  count: number;
  average: number;
}

export interface PublicReview {
  id: string;
  rating: number;
  text?: string | null;
  authorName: string;
  stayMonth: string;
  publishedAt: string;
  hostReply?: string | null;
  hostRepliedAt?: string | null;
  verified: boolean;
}

export interface PublicReviewPage {
  items: PublicReview[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface ReviewLinkInfo {
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  review?: PublicReview | null;
}

export interface SubmitReviewPayload {
  token: string;
  rating: number;
  text?: string;
  showName: boolean;
}

type HostReviewStatus = 'Published' | 'Reported' | 'Removed';

export interface HostReview {
  id: string;
  propertyId: string;
  propertyName: string;
  bookingId: string;
  rating: number;
  text?: string | null;
  authorName: string;
  stayMonth: string;
  publishedAt: string;
  status: HostReviewStatus;
  hostReply?: string | null;
  hostRepliedAt?: string | null;
  reportedAt?: string | null;
}

export interface HostReviewPage {
  items: HostReview[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const REVIEW_REPORT_REASONS = ['Offensive', 'Spam', 'NotAboutTheStay', 'PersonalData', 'NotAGuest', 'Other'] as const;
export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

export interface ReportReviewPayload {
  reason: ReviewReportReason;
  note?: string;
}

export type ReviewInviteBlock =
  | 'not_direct_booking'
  | 'reviews_disabled'
  | 'no_show'
  | 'booking_not_confirmed'
  | 'stay_not_ended'
  | 'window_closed'
  | 'no_guest_address';

export interface ReviewInviteStatus {
  canInvite: boolean;
  reason?: ReviewInviteBlock | null;
  inviteSentAt?: string | null;
  reviewed: boolean;
}
