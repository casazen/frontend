/**
 * The reviews of the guests in the hub of messages and on the booking (E05/F06, NF-69): the ones of the booking site and the ones of the
 * channels (Airbnb only: the channel manager gives no review of the other portals). The shapes are the ones of `OtaReviewDtos.cs`,
 * `MessageHubDtos.cs` and `ReviewDraftDtos.cs`; the enums travel as their names. The words of a review, of a reply and of the host's own
 * review are personal data: they are shown as text, kept in the memory of the page only and never put in an address.
 */
import type { MessageBookingCard, MessageCustomer, MessageHubChannel } from './message-hub.types';

export type OtaReviewActionState = 'None' | 'Sent' | 'Error' | 'ManualVerify';

type HostReviewWindow = 'Unknown' | 'Open' | 'Sent' | 'Closed';

export type ReviewThreadSource = 'Review' | 'OtaReview';

interface ReviewCategoryRating {
  category: string;
  value: number;
}

export interface ReviewReply {
  state: OtaReviewActionState;
  text?: string | null;
  sentAt?: string | null;
  errorCode?: string | null;
}

export interface OtaHostReview {
  window: HostReviewWindow;
  state: OtaReviewActionState;
  ratings: ReviewCategoryRating[];
  text?: string | null;
  privateText?: string | null;
  sentAt?: string | null;
  errorCode?: string | null;
}

interface OtaReviewCapabilities {
  canRead: boolean;
  canReply: boolean;
  canHostReview: boolean;
  reason?: string | null;
  replyReason?: string | null;
  hostReviewReason?: string | null;
}

export interface ReviewThread {
  threadKey: string;
  source: ReviewThreadSource;
  channel: MessageHubChannel;
  propertyId: string;
  propertyName?: string | null;
  bookingId: string;
  guestName?: string | null;
  publishedAt?: string | null;
  rating?: number | null;
  categoryRatings: ReviewCategoryRating[];
  text?: string | null;
  reply: ReviewReply;
  hostReview?: OtaHostReview | null;
  booking?: MessageBookingCard | null;
  customer?: MessageCustomer | null;
  capabilities: OtaReviewCapabilities;
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
}

export interface BookingReviewItem {
  threadKey: string;
  source: ReviewThreadSource;
  channel: MessageHubChannel;
  rating?: number | null;
  preview?: string | null;
  publishedAt?: string | null;
  replyState: OtaReviewActionState;
  capabilities: OtaReviewCapabilities;
}

/**
 * The reviews of a booking (`GET /api/bookings/{id}/reviews`): what the channel of the booking allows even when there is no review yet (`channelCapabilities`: Booking.com,
 * Vrbo and Expedia answer `channel_not_integrated`, and no review of theirs is ever simulated), the reviews there are, and how the last read of the channel went. `canRefreshAt`
 * is when the booking may be read again from the channel manager (absent: now).
 */
export interface BookingReviews {
  bookingId: string;
  channel: MessageHubChannel;
  channelCapabilities: OtaReviewCapabilities;
  items: BookingReviewItem[];
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
  canRefreshAt?: string | null;
}

/**
 * How a reply or a host's review ended (`POST /api/reviews/ota/{id}/reply` and `/host-review`: 200, or 202 when the state is `ManualVerify`): the `state` of the action, `replayed`
 * when the same `Idempotency-Key` had been seen and nothing was sent again, and the `errorCode` of a refusal. The review as it is now is read again from the hub.
 */
export interface OtaReviewActionAnswer {
  state: OtaReviewActionState;
  replayed: boolean;
  errorCode?: string | null;
}

export interface HostReviewCommand {
  ratings: ReviewCategoryRating[];
  text: string;
  privateText?: string;
}

export interface ReviewDraftOutcome {
  status: string;
  approvalItemId?: string | null;
  reason?: string | null;
}
