/**
 * The reviews of the guests in the hub of messages and on the booking (E05/F06, NF-69): the ones of the booking site and the ones of the
 * channels (Airbnb only: the channel manager gives no review of the other portals). The shapes are the ones of `OtaReviewDtos.cs`,
 * `MessageHubDtos.cs` and `ReviewDraftDtos.cs`; the enums travel as their names. The words of a review, of a reply and of the host's own
 * review are personal data: they are shown as text, kept in the memory of the page only and never put in an address.
 */
import type { MessageBookingCard, MessageCustomer, MessageHubChannel } from './message-hub.types';

/** Where the host's reply or the host's own review stands: nothing asked of the channel, taken, refused with a code, or sent and not confirmed. */
export type OtaReviewActionState = 'None' | 'Sent' | 'Error' | 'ManualVerify';

/** Whether the host may still write its own review of the guest on the channel, as the channel manager says it. */
type HostReviewWindow = 'Unknown' | 'Open' | 'Sent' | 'Closed';

/** Where a review is kept: the booking site (`Review`, key `review:…`) or a channel (`OtaReview`, key `otareview:…`). */
export type ReviewThreadSource = 'Review' | 'OtaReview';

/** One rating of a review: the category as the channel names it (`cleanliness`, `communication`…) and its value, 1 to 5. */
interface ReviewCategoryRating {
  category: string;
  value: number;
}

/** The host's reply: `state` is `None`, `Sent`, `Error` (with its `errorCode`) or `ManualVerify` (the outcome is checked on the channel, never sent again by a second click). */
export interface ReviewReply {
  state: OtaReviewActionState;
  text?: string | null;
  /** UTC instant. */
  sentAt?: string | null;
  errorCode?: string | null;
}

/** The host's own review of the guest (a review of a channel only): its window, where the send stands, and what the host sent. */
export interface OtaHostReview {
  window: HostReviewWindow;
  state: OtaReviewActionState;
  ratings: ReviewCategoryRating[];
  text?: string | null;
  /** Shown to the guest only. */
  privateText?: string | null;
  sentAt?: string | null;
  errorCode?: string | null;
}

/**
 * What a review allows its host now. `reason` is why nothing is allowed (`channel_not_integrated`, `mapping_not_confirmed`, `octorate_not_connected`, `no_reviews_for_booking_source`)
 * and is absent while the channel allows; `replyReason` and `hostReviewReason` say why one action is closed while the other may be open (`ota_review_reply_already_sent`,
 * `ota_review_window_closed`, `ota_review_action_unconfirmed`, `ota_review_not_published`…).
 */
interface OtaReviewCapabilities {
  canRead: boolean;
  canReply: boolean;
  canHostReview: boolean;
  reason?: string | null;
  replyReason?: string | null;
  hostReviewReason?: string | null;
}

/**
 * One review of the hub (`GET /api/messages/reviews/{threadKey}`): the stars and the categories, the words of the guest, the host's reply and where it stands, the host's own
 * review (`null` for a review of the booking site, which has none), the booking card and what the host may do now. `lastSyncError` is the code of the last read of the channel
 * manager that did not work.
 */
export interface ReviewThread {
  threadKey: string;
  source: ReviewThreadSource;
  channel: MessageHubChannel;
  propertyId: string;
  propertyName?: string | null;
  bookingId: string;
  guestName?: string | null;
  /** UTC instant. */
  publishedAt?: string | null;
  rating?: number | null;
  categoryRatings: ReviewCategoryRating[];
  text?: string | null;
  reply: ReviewReply;
  hostReview?: OtaHostReview | null;
  booking?: MessageBookingCard | null;
  customer?: MessageCustomer | null;
  capabilities: OtaReviewCapabilities;
  /** UTC instant of the last read of the channel manager. */
  lastSyncedAt?: string | null;
  lastSyncError?: string | null;
}

/** One review in the list of a booking: where it is kept, the stars, the first words (for the host only) and what the host may do with it. */
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

/** The host's own review as the request carries it: at least one whole rating from 1 to 5, the public text and, when there is one, the private text. */
export interface HostReviewCommand {
  ratings: ReviewCategoryRating[];
  text: string;
  privateText?: string;
}

/** What a request for a draft of the reply did (`POST /api/reviews/{reviewKey}/draft`): `Drafted` (the draft waits in the approval queue) or `NotDrafted` with its `reason`, a stable code. Never a text. */
export interface ReviewDraftOutcome {
  /** `Drafted`, `NotDrafted` or a value a later version adds. */
  status: string;
  approvalItemId?: string | null;
  reason?: string | null;
}
