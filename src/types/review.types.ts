/** Longest review text, reply and report note the backend takes (`ReviewRules`, DB-12a). */
export const REVIEW_TEXT_MAX_LENGTH = 1500;
export const REVIEW_REPLY_MAX_LENGTH = 800;
export const REVIEW_REPORT_NOTE_MAX_LENGTH = 500;

/** The stars of a review go from 1 to 5. */
export const REVIEW_MAX_RATING = 5;

/**
 * Count and average (one decimal) of the public reviews of a property (DB-12a). The backend leaves `ratingSummary` out of the
 * property while there is no review: the page never shows stars or a «0».
 */
export interface RatingSummary {
  count: number;
  average: number;
}

/** A review as the public reads it: the first name of the guest (or «Ospite»), never a surname, an email or a date of the stay. */
export interface PublicReview {
  id: string;
  rating: number;
  text?: string | null;
  authorName: string;
  /** The month of the stay, `yyyy-MM`. */
  stayMonth: string;
  publishedAt: string;
  hostReply?: string | null;
  hostRepliedAt?: string | null;
  /** What the backend declares: a direct, confirmed booking whose stay is over. The page never decides it. */
  verified: boolean;
}

export interface PublicReviewPage {
  items: PublicReview[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** What the page of the review link shows; `review` is set when the guest already wrote it. */
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
  /** False shows «Ospite» in place of the first name. */
  showName: boolean;
}

/** `Published`, `Reported` (reported by the host, still public until the staff decides) or `Removed` (taken down by the staff). */
export type HostReviewStatus = 'Published' | 'Reported' | 'Removed';

/** A review as its host sees it. */
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

/** The reasons a host can give when it reports a review (backend `ReviewReportReason`). */
export const REVIEW_REPORT_REASONS = ['Offensive', 'Spam', 'NotAboutTheStay', 'PersonalData', 'NotAGuest', 'Other'] as const;
export type ReviewReportReason = (typeof REVIEW_REPORT_REASONS)[number];

export interface ReportReviewPayload {
  reason: ReviewReportReason;
  note?: string;
}

/** Why the host cannot ask for a review of a booking (backend `ReviewInviteStatusDto.reason`). */
export type ReviewInviteBlock =
  | 'not_direct_booking'
  | 'booking_not_confirmed'
  | 'stay_not_ended'
  | 'window_closed'
  | 'no_guest_address';

/** Whether the host can ask a guest for a review now and what already happened. */
export interface ReviewInviteStatus {
  canInvite: boolean;
  reason?: ReviewInviteBlock | null;
  inviteSentAt?: string | null;
  reviewed: boolean;
}
