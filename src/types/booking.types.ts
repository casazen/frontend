import type { AlloggiatiWebStatus } from './alloggiati.types';
import type { PaymentMethod, PaymentRefund, PaymentRefundStatus } from './payment.types';
import type { OtaReviewReason } from './calendar.types';

// ✅ Fixed: Backend uses PascalCase enum values
export type BookingStatus = 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

/** Inline guest info embedded in booking (subset of the full Guest entity) */
export interface BookingGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
}

export interface Booking {
  id: string;
  /** The code the guest knows (`XXXXX-XXXXX`): the API sends it on every booking, the list and the detail alike. */
  bookingCode?: string;
  propertyId: string;
  propertyName?: string;
  userId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  /** Adults and minors among `numberOfGuests` (every guest an adult when the split is unknown). */
  numberOfAdults?: number;
  numberOfChildren?: number;
  totalPrice: number;
  /** Lodging plus `cleaningFee`, tourist tax excluded. */
  basePrice?: number;
  /** Cleaning fee included in `basePrice`: the lodging is `basePrice - cleaningFee`. */
  cleaningFee?: number;
  touristTax?: number;
  /** The host entered a total other than the quote's when they created the booking by hand (SR-06a); `touristTax` stays the quote's. */
  priceOverridden?: boolean;
  /** The host's note on that price (80 characters at most); null when there is none. */
  priceOverrideNote?: string | null;
  currency: string;
  status: BookingStatus;
  guest: BookingGuest;
  specialRequests?: string;
  source?: string;
  /** Reason written by the host when cancelling (host only). */
  cancellationNote?: string | null;
  /** Immediate, OnCancellationDeadline or OnSite. */
  paymentOption?: string;
  /** Open "pay at the property" request (BK-06): waiting for the guest's email or for the host's answer. */
  onSiteRequestState?: OnSiteRequestState | null;
  /** Deadline of an open "pay at the property" request (the host's answer once the email is confirmed). */
  requestExpiresAt?: string | null;
  /** OTA stay created from an iCal block (CO-21): the feed it came from, kept after the calendar is disconnected. */
  icalFeedId?: string | null;
  /** Label of that feed ("camera 2"), shown next to the source. */
  channelLabel?: string | null;
  /** OTA stay "da verificare" (CO-21); null when there is nothing to check. */
  otaReviewReason?: OtaReviewReason | null;
  otaReviewRaisedAt?: string | null;
  /** Booking detail only: the linked iCal block with its dates on the channel (check-out day excluded). */
  channelBlock?: OtaChannelBlock | null;
  createdAt: string;
  updatedAt: string;
  /** When the booking became confirmed (UTC); null while it is not, and for one confirmed before the time was kept (SR-05a). */
  confirmedAt?: string | null;
  /** When the booking was cancelled (UTC); null while it is not, and for one cancelled before the time was kept. */
  cancelledAt?: string | null;
  /** When the host registered the arrival (UTC); null before, and when it was registered after the check-in day. */
  arrivedAt?: string | null;
  /** When the host checked the stay out (UTC); null before, and for a stay checked out before the time was kept. */
  checkedOutAt?: string | null;
  /** Whether the host may change the dates and the guests, and if not why: the rule of `PUT /bookings/:id`, never guessed here. */
  canEdit?: BookingEditability;
  /**
   * What the host may do with the booking, to change it and to cancel it, and when not why and how to ask for it (E08/F03/US02, NF-75, NF-76): the answer of
   * the API for every booking, the lists included, so no screen works it out. For a booking that came from a channel it carries the rule of that channel.
   */
  changeOptions?: BookingChangeOptions;
  /** Booking detail only (`GET /bookings/:id`): how much of the total came in. Missing on the booking an action answers with. */
  paymentState?: BookingPaymentState;
  /** Booking detail only: the money that came in; missing for who may not read payments (the collaborator). */
  paidAmount?: number | null;
  /**
   * The channel an imported booking comes from (the exact source: `Airbnb`, `Expedia`...); null for any other booking. The list and
   * the facts mark such a booking with the "OTA" badge (ADR-033-R9). It is not an amount: whoever may not read payments gets it too.
   */
  otaSource?: string | null;
  /**
   * Booking detail only: the amounts the channel reported for an imported booking (ADR-033-R2). Missing for a booking that does not
   * come from a channel and for who may not read payments, who gets the state without any amount.
   */
  otaAmounts?: BookingOtaAmounts | null;
  /** Booking detail only, with `otaAmounts`: who collects the money of the booking. */
  collection?: BookingCollection | null;
  /** Booking detail only: where each figure comes from; a figure with no value has no entry. Missing for who may not read payments. */
  amountSources?: BookingAmountSources | null;
  /**
   * Booking detail only (`GET /bookings/:id`): the mirror of the booking on the channel manager, where the last operation CasaZen sent for it stands
   * (NF-74); `null` when the booking is not mirrored there. Missing on the booking an action answers with, the creation included: the result of
   * the new-booking wizard reads the detail to know it.
   */
  octorateSync?: BookingOctorateSync | null;
}

/** Where the last operation CasaZen sent to the channel manager for a booking stands (`octorateSync.state`). `NotAllowedByChannel` is a change the channel does not allow. */
export type OctorateSyncState = 'Pending' | 'Synced' | 'Failed' | 'Conflict' | 'NotAllowedByChannel';

/** The last operation sent to the channel manager for a booking. */
export type OctorateSyncOperation = 'Create' | 'Update' | 'Cancel' | 'Payment';

/** The stay as the channel manager holds it after it refused a change (`Conflict` only); a member that was not kept is `null`. */
export interface OctorateVersion {
  checkIn: string | null;
  checkOut: string | null;
  guests: number | null;
}

/**
 * The mirror of a booking on the channel manager (`octorateSync` of the booking detail, NF-74): a state, a stable code of CasaZen for a failure (never a text
 * of the channel manager) and whether the caller may ask for the push again. No personal data.
 */
export interface BookingOctorateSync {
  state: OctorateSyncState;
  lastOperation: OctorateSyncOperation;
  /** When the channel manager last confirmed an operation (UTC); null until it did. */
  lastSyncedAt: string | null;
  /** Why the last operation failed: `octorate_dates_unavailable`, `octorate_unavailable`...; null otherwise. */
  errorCode: string | null;
  /** The state is `Failed` or `Conflict` and the caller may write the booking: `POST /bookings/:id/octorate-sync/retry` is open to them. */
  canRetry: boolean;
  octorateVersion?: OctorateVersion | null;
}

/** The answer of `POST /bookings/:id/octorate-sync/retry` (202): the push is queued, the state `Pending`. */
export interface OctorateSyncRetryResult {
  bookingId: string;
  state: OctorateSyncState;
}

/**
 * The amounts a channel reported for an imported booking (ADR-033-R2). A figure the channel did not send is `null`, never 0: the
 * commission, the net and the balance often are, until the channel fills the price breakdown.
 */
export interface BookingOtaAmounts {
  commission: number | null;
  /** What the host receives. */
  net: number | null;
  paid: number | null;
  balance: number | null;
  currency: string;
}

/** Who collects the money of a channel booking (NF-77); either flag is `null` when the channel did not say. */
export interface BookingCollection {
  /** True: the channel collects the payment. False: the host does. */
  companyCollect: boolean | null;
  /** True: the commission is already in the payments. */
  commissionIncludedInPayments: boolean | null;
}

/**
 * Where a figure of a booking comes from: Stripe for a direct booking, the channel manager for a channel booking, the host's own
 * entry (cash and bank transfer) for a payment recorded by hand.
 */
export const BOOKING_AMOUNT_SOURCES = ['Stripe', 'ChannelManager', 'Manual'] as const;
export type BookingAmountSource = (typeof BOOKING_AMOUNT_SOURCES)[number];

/**
 * `amountSources` of a booking: the source of the total, of what was paid, of the balance, of the commission and of the net; a figure
 * that has no value has no entry (the API leaves it out), and a figure with no entry is drawn with no tag.
 */
export interface BookingAmountSources {
  total?: BookingAmountSource;
  commission?: BookingAmountSource;
  net?: BookingAmountSource;
  paid?: BookingAmountSource;
  balance?: BookingAmountSource;
}

/**
 * Why the dates and guests of a booking cannot be changed: it is `Cancelled`, the stay has `Started` (arrived or over), or it comes
 * from the booking site or a channel (`SourceLocked`: price and payment are settled there, so it is cancelled or made again, SR-D5).
 */
export type BookingEditLock = 'Cancelled' | 'Started' | 'SourceLocked';

/** `canEdit` of a booking (SR-05a): `reason` is null when `allowed`. */
export interface BookingEditability {
  allowed: boolean;
  reason: BookingEditLock | null;
}

/**
 * `changeOptions` of a booking (E08/F03/US02): what the host may do with it. `reasonCode` and `guidanceKey` explain the first thing that is not allowed (the
 * change, else the cancellation), `cancelReasonCode` and `cancelGuidanceKey` the cancellation whatever the change. A booking that came from a channel through
 * the channel manager has a `channel` (`BookingCom`); the others have none. A code is one of the API (`ota_booking_change_not_allowed`,
 * `ota_booking_cancel_not_allowed`, `booking_stay_locked`...); a key is one of its own sentences, which this client does not read: it says the same in its own words.
 */
export interface BookingChangeOptions {
  /** The host may change the dates and the guests: what `PUT /bookings/:id` accepts. */
  canEdit: boolean;
  /** The host may cancel the booking from CasaZen. */
  canCancel: boolean;
  reasonCode?: string | null;
  guidanceKey?: string | null;
  /** The channel of a booking that came from one (`Airbnb`, `BookingCom`, `Expedia`, `Vrbo`, `TripAdvisor`, `Agoda`, `OtherChannel`); null otherwise. */
  channel?: string | null;
  cancelReasonCode?: string | null;
  cancelGuidanceKey?: string | null;
}

/** The chip of the list of bookings, which is the `view` of `GET /api/bookings/search`: what the host is doing with them. */
export type BookingListView = 'all' | 'toConfirm' | 'upcoming' | 'inProgress' | 'completed' | 'cancelled';

/**
 * Where a booking came from, in the words of the channel filter of the list; the exact source stays in `source`. The four portals
 * after `BookingCom` have a value of their own (they used to be `Other`), and `Other` is what no value names.
 */
export type BookingChannel = 'Direct' | 'Manual' | 'Airbnb' | 'BookingCom' | 'Expedia' | 'Vrbo' | 'TripAdvisor' | 'Agoda' | 'Other';

/** How much of the total of a booking has come in. */
export type BookingPaymentState = 'None' | 'Partial' | 'Paid' | 'Refunded';

/** A row of `GET /api/bookings/search` (SR-03b): the booking and what a list says besides it. */
export interface BookingListItem extends Booking {
  /** The code the guest knows (`XXXXX-XXXXX`). */
  bookingCode: string;
  channel: BookingChannel;
  paymentState: BookingPaymentState;
  /** The money that came in; missing for who may not read payments (the collaborator). */
  paidAmount?: number | null;
  /** Until when the host may answer a "pay at the property" request (UTC); null for any other booking. */
  respondBy?: string | null;
}

/** `GET /api/bookings/counts`: how many bookings are in each chip, for the filters of the list. */
export interface BookingCounts {
  all: number;
  toConfirm: number;
  upcoming: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

/** The filters of the list as the API takes them, for the rows and for the counters (several values are comma-separated). */
export interface BookingFilterParams {
  q?: string;
  propertyId?: string;
  /** `Direct,Airbnb`: names of `BookingChannel`. */
  channel?: string;
  /** `Sent,InProgress`: the state of the online check-in link. */
  checkInStatus?: string;
  /** First and last arrival day (`yyyy-MM-dd`, both included). */
  arrivalFrom?: string;
  arrivalTo?: string;
}

/** What `GET /api/bookings/search` takes: the filters, the chip, the order (`checkIn:asc`) and the page. */
export interface BookingListParams extends BookingFilterParams {
  view?: BookingListView;
  sort?: string;
  page?: number;
  pageSize?: number;
}

/** The iCal block of an OTA stay (CO-21). */
export interface OtaChannelBlock {
  id: string;
  startDate: string;
  endDate: string;
}

/** OTA sources a stay created from an iCal block of an "other" feed can have (backend `BookingSource`). */
export const OTA_STAY_SOURCES = ['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda'] as const;
export type OtaStaySource = (typeof OTA_STAY_SOURCES)[number];

/** POST /ical-blocks/:blockId/ota-stay — "Crea soggiorno OTA" (CO-21, decision D7). */
export interface CreateOtaStayDto {
  firstName: string;
  lastName: string;
  email: string;
  /** 1 when omitted. */
  numberOfGuests?: number;
  /** Amount shown by the channel, optional: CasaZen never computes one for an OTA stay. */
  totalPrice?: number;
  /** Only for a feed of channel "Other". */
  source?: OtaStaySource;
}

/** POST /bookings/:id/ota-review/resolve (CO-21). */
export interface ResolveOtaReviewDto {
  /** Give the stay the dates its block now has on the channel first. */
  applyChannelDates?: boolean;
}

/** Where an open "pay at the property" request stands (BK-06, decision D5). */
export type OnSiteRequestState = 'AwaitingGuestEmail' | 'AwaitingHostApproval';

/** A "pay at the property" request waiting for the host (`GET /api/bookings/approval-requests`). */
export interface BookingApprovalRequest {
  id: string;
  propertyId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  numberOfGuests: number;
  numberOfAdults: number;
  numberOfChildren: number;
  totalPrice: number;
  currency: string;
  specialRequests: string;
  guest: BookingGuest;
  emailConfirmedAt: string | null;
  /** The request expires (and its dates are released) if the host does not answer by then. */
  respondBy: string | null;
}

export interface DeclineBookingRequestDto {
  /** Optional message written in the email to the guest (max 500 characters). */
  message?: string;
}

/** POST /bookings: booking entered by the host (Confirmed, source Manual). */
export interface CreateBookingDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  /** All guests, minors included. */
  numberOfGuests: number;
  /** Minors among `numberOfGuests`: asked when the tourist tax of the comune depends on their age. */
  numberOfChildren?: number;
  childrenAges?: number[];
  guest: BookingGuest;
  specialRequests?: string;
}

/**
 * How the guest of a booking the host enters is to pay it (NF-74): `paymentLink` (the guest is e-mailed a secure link to pay the balance online, on the
 * host's Stripe account), `onSite` or `bankTransfer` (recorded only: the host records the income by hand with "Registra incasso", nothing is sent). The API
 * also knows `none`, which the client never sends: the choice decides money, so it is always an explicit one.
 */
export const HOST_PAYMENT_ARRANGEMENTS = ['paymentLink', 'onSite', 'bankTransfer'] as const;
export type HostPaymentArrangement = (typeof HOST_PAYMENT_ARRANGEMENTS)[number];

/**
 * POST /bookings/manual: a booking entered by hand with only what it needs (SR-06a). Prices and tourist tax are never sent
 * (the API prices the stay); `totalPrice` is the total the host agreed when it is not the quote's.
 */
export interface CreateManualBookingDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  /** Age at check-in of each minor, asked when the tourist tax of the comune depends on it. */
  childrenAges?: number[];
  /** The first name and the email are all the host must give; the guest completes the rest with the online check-in. */
  guest: { firstName: string; lastName?: string; email: string; phone?: string };
  note?: string;
  /** The total the host agreed with the guest; with `blockId`, the amount the portal shows. */
  totalPrice?: number;
  /** A short note on that price (80 characters at most); not used with `blockId`. */
  priceNote?: string;
  /** The block of a portal's calendar this booking completes (`linkableBlockId` of the availability). */
  blockId?: string;
  /**
   * How the guest pays (the payment step of the wizard, NF-74). `paymentLink` needs `payment.write` and a Stripe account ready (422 `payment_link_unavailable`
   * otherwise). Never with `blockId`: the portal collects.
   */
  paymentArrangement?: HostPaymentArrangement;
}

/** The answer of POST /bookings/manual: the booking and what the host should know about it. */
export interface ManualBooking extends Booking {
  /** The stay is shorter than the minimum stay of the property: created all the same. */
  belowMinimum: boolean;
  minNights: number | null;
  /** False: the guest gives the documents and the rest of the data with the online check-in. */
  guestDataComplete: boolean;
  /**
   * With `paymentArrangement: 'paymentLink'`: the link e-mailed to the guest, given this once for the host to copy (a credential: the token in it is never stored
   * by the API, so it is shown on the result of the wizard only and kept nowhere). `null` for the other arrangements and when the link could not be made.
   */
  paymentLinkUrl?: string | null;
  /** Why the link is missing although the booking was created (`payment_link_unavailable`, `payment_provider_error`): the host sends it again. `null` otherwise. */
  paymentLinkError?: string | null;
}

/** The answer of POST /bookings/:id/payment-link: a new link of the balance, e-mailed to the guest; the previous link stops working. */
export interface BookingPaymentLink {
  bookingId: string;
  /** The link, given this once for the host to copy (a credential). */
  paymentLinkUrl: string;
  /** The balance the guest pays. */
  amount: number;
  currency: string;
  sentAt: string;
  /** The e-mail to the guest was queued; false when the guest has no address (then the host sends the link another way). */
  emailSent: boolean;
}

/** `state` of GET /properties/:id/availability (SR-06a). */
export type StayAvailabilityState = 'ok' | 'belowMinimum' | 'occupied' | 'linkableBlock' | 'invalid';

/** Why a stay is `invalid`. */
export type StayAvailabilityInvalidReason = 'checkOutNotAfterCheckIn' | 'checkInInPast' | 'stayTooLong';

/**
 * A stay of CasaZen (`booking`), a portal's reservation that arrived as a block of its calendar (`ical`), the host's own block (`block`) or the channel
 * manager saying the nights cannot be booked (`channelManager`: no id of its own, the dates are the ones asked for).
 */
export type StayAvailabilityConflictType = 'booking' | 'ical' | 'block' | 'channelManager';

/** Something that takes a night of the dates asked for. */
export interface StayAvailabilityConflict {
  id: string;
  type: StayAvailabilityConflictType;
  /** The guest's name (booking), the name of the calendar (portal), the host's note (block) or the channel the channel manager names; null when there is none. */
  title: string | null;
  /** Where a booking came from or whose calendar the block is; null for the host's own block and for the channel manager. */
  channel: BookingChannel | null;
  /** Arrival day and departure day (`YYYY-MM-DD`). */
  from: string;
  to: string;
}

/** A free stay of the same number of nights as the one asked for. */
export interface StayAvailabilityWindow {
  from: string;
  to: string;
}

/** What GET /properties/:id/availability says about a stay: free, taken (and the nearest free dates) or a portal's block to complete. */
export interface StayAvailability {
  propertyId: string;
  from: string;
  to: string;
  state: StayAvailabilityState;
  invalidReason: StayAvailabilityInvalidReason | null;
  nights: number;
  /** The minimum stay of the property, when it has one. */
  minNights: number | null;
  conflicts: StayAvailabilityConflict[];
  nearestFreeWindow: StayAvailabilityWindow | null;
  /** With `linkableBlock`: the block to complete with POST /bookings/manual (`blockId`). */
  linkableBlockId: string | null;
  /**
   * Whether the channel manager was asked (NF-74, NF-80): `null` for a property that is not mirrored there (nothing to ask), `true` when it answered (its
   * "not available" is `occupied` with a `channelManager` conflict), `false` when it could not be asked. `false` is advice only: it never blocks the host,
   * the API asks again when the booking is created. Missing in the answer of an older API: read as `null`.
   */
  channelManagerChecked?: boolean | null;
}

/** The stay GET /properties/:id/availability is asked about. */
export interface StayAvailabilityParams {
  propertyId: string;
  from: string;
  to: string;
}

/**
 * PUT /bookings/:id — only what the host may change (PC-07). Status, prices and guest are never sent: the status
 * changes through its own actions and the price is computed by the backend.
 */
export interface UpdateBookingDto {
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfChildren?: number;
  childrenAges?: number[];
  specialRequests?: string;
}

/** What an edit does with the difference between the new price and what the guest has paid. */
export type BookingSettlementAction = 'refund' | 'chargeSavedCard' | 'paymentLink' | 'none';

/** Where the money of a saved edit stands: `done` (confirmed by Stripe, or the link sent), `pending` (Stripe has not confirmed it yet) or `none`. */
export type BookingSettlementState = 'done' | 'pending' | 'none';

/**
 * The money of an edit that was saved (`settlement` of `PUT /bookings/:id`, E08/F02/US01/T01, NF-75): what was done with the difference. `offlineRefundDue` is
 * what the host still has to give back outside CasaZen (paid in cash or by transfer).
 */
export interface BookingEditSettlement {
  action: BookingSettlementAction;
  state: BookingSettlementState;
  amount: number;
  offlineRefundDue: number;
  currency: string;
}

/**
 * `POST /bookings/:id/edit-quote`: what the same edit would do with the money, worked out and not done. `difference` is `newTotal` minus `paidSoFar`; `amount` is
 * the money that moves online (the refund, the charge or the payment link), zero for `none`. Needs `payment.read`.
 */
export interface BookingEditQuote {
  currency: string;
  previousTotal: number;
  newTotal: number;
  paidSoFar: number;
  difference: number;
  action: BookingSettlementAction;
  amount: number;
  offlineRefundDue: number;
}

/** The answer of `PUT /bookings/:id`: the booking as the edit left it, and what happened to the money. */
export interface UpdatedBooking extends Booking {
  settlement?: BookingEditSettlement;
}

/** POST /bookings/quote — price of a stay the host is entering or changing (tourist tax of BK-03 included). */
export interface HostBookingQuotePayload {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfChildren?: number;
  childrenAges?: number[];
}

/**
 * Answer of `POST /bookings/:id/check-in` ("Registra arrivo", CO-08): the booking, now checked in, and whether the guest
 * data of the stay are complete for Alloggiati Web. Incomplete data never block the arrival.
 */
export interface ArrivalRegisteredBooking extends Booking {
  guestDataComplete: boolean;
}

/** Rule of the model that sets the minimum refund of a cancellation (BK-02). */
export type CancellationRefundRule = 'None' | 'FreeCancellationDeadline' | 'PropertyCancellationPolicy';

/** GET /bookings/:id/cancellation */
export interface BookingCancellationQuote {
  bookingId: string;
  status: BookingStatus;
  cancellable: boolean;
  currency: string;
  /** Paid through Stripe. */
  paidAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  /** Maximum refund now. */
  refundableAmount: number;
  /** Minimum refund now under `rule` (0 without a rule). */
  minimumRefundAmount: number;
  rule: CancellationRefundRule;
  freeCancellationUntil?: string | null;
  cancellationPolicyName?: string | null;
  /** Paid outside Stripe (cash, bank transfer): CasaZen cannot refund it. */
  offlinePaidAmount: number;
  /** An unpaid PaymentIntent or a saved card will be canceled on Stripe. */
  hasUncollectedIntent: boolean;
  /** Something paid through Stripe can still be refunded: `refundAmount` is required. */
  requiresRefundDecision: boolean;
}

/** POST /bookings/:id/cancel. For a booking of a channel only `reason` is read: no money moves from CasaZen. */
export interface CancelBookingDto {
  refundAmount?: number;
  reason?: string;
}

/**
 * The answer of POST /bookings/:id/cancel. A booking of a channel answers 200 only after the channel manager confirmed the cancellation, with no refund and
 * no cancelled intent; a refusal (422 `octorate_cancel_failed`, 422 `ota_booking_cancel_not_allowed`, 503 `octorate_unavailable`) leaves the booking as it was.
 */
export interface CancelBookingResult {
  bookingId: string;
  status: BookingStatus;
  refunds: PaymentRefund[];
  canceledIntents: number;
}

/** What an entry of the timeline of a booking is about (SR-05a): the title is this key, the words are the client's. */
export type BookingTimelineKind =
  | 'Created'
  | 'RequestReceived'
  | 'GuestEmailPending'
  | 'ApprovalPending'
  | 'PaymentPending'
  | 'HostConfirmationPending'
  | 'PaymentReceived'
  | 'Confirmed'
  | 'CheckInLinkSent'
  | 'GuestDocumentsReceived'
  | 'Arrived'
  | 'Alloggiati'
  | 'CheckedOut'
  | 'Cancelled'
  | 'Refund';

/** `Done` happened; `Current` waits for the host, the guest or the bank. */
export type BookingTimelineState = 'Done' | 'Current';

/**
 * Why the system cancelled a booking (or the host declined the request), or that the guest cancelled it themselves (DB-08a);
 * null in the entry when the host cancelled it.
 */
export type BookingCancellationReason =
  | 'CheckoutHoldExpired'
  | 'DatesUnavailableAtPayment'
  | 'OnSiteRequestDeclined'
  | 'OnSiteRequestExpired'
  | 'OnSiteEmailNotConfirmed'
  | 'DeferredPaymentNotCompleted'
  | 'GuestRequested';

/** Where the link of the online check-in stands. */
export type BookingCheckInLinkState = 'Sent' | 'InProgress' | 'Expired' | 'Completed';

/** What an entry says besides its kind: each field belongs to a few kinds and is null for the others. Never a name or an email. */
export interface BookingTimelineData {
  /** Where the booking came from (`Created`, `RequestReceived`): `Direct`, `Manual`, `Airbnb`… */
  source: string | null;
  /** Euros (`PaymentReceived`, `Refund`); null for who may not read payments: the entry is there without the figure. */
  amount: number | null;
  /** How it was paid (`PaymentReceived`). */
  method: PaymentMethod | null;
  /** The term of a request that waits (`GuestEmailPending`, `ApprovalPending`), UTC. */
  expiresAt: string | null;
  /** Why the system cancelled it (`Cancelled`). */
  reason: BookingCancellationReason | null;
  /** What the host wrote when cancelling (`Cancelled`): the host's own note, never sent to the guest. */
  note: string | null;
  /** Where the link of the online check-in stands (`CheckInLinkSent`). */
  linkState: BookingCheckInLinkState | null;
  /** The Alloggiati Web communication as the Alloggiati page tells it (`Alloggiati`). */
  alloggiatiStatus: AlloggiatiWebStatus | null;
  /** The legal term of the Alloggiati communication while it is not sent (`Alloggiati`), UTC. */
  deadlineAt: string | null;
  /** Where the refund stands (`Refund`). */
  refundStatus: PaymentRefundStatus | null;
}

/** An entry of the timeline. */
export interface BookingTimelineEvent {
  kind: BookingTimelineKind;
  /** When it happened (UTC); null for a step that happened before the time was kept, and for a wait with no instant of its own. */
  at: string | null;
  state: BookingTimelineState;
  data: BookingTimelineData;
}

/** `GET /bookings/:id/timeline` (SR-05a): the past steps and the waits, already in order. */
export interface BookingTimeline {
  bookingId: string;
  events: BookingTimelineEvent[];
}
