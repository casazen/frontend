import type { AlloggiatiWebStatus } from './alloggiati.types';
import type { PaymentMethod, PaymentRefund, PaymentRefundStatus } from './payment.types';
import type { OtaReviewReason } from './calendar.types';

export type BookingStatus = 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

interface BookingGuest {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
}

export interface Booking {
  id: string;
  bookingCode?: string;
  propertyId: string;
  propertyName?: string;
  userId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfAdults?: number;
  numberOfChildren?: number;
  totalPrice: number;
  basePrice?: number;
  cleaningFee?: number;
  touristTax?: number;
  priceOverridden?: boolean;
  priceOverrideNote?: string | null;
  currency: string;
  status: BookingStatus;
  guest: BookingGuest;
  specialRequests?: string;
  source?: string;
  cancellationNote?: string | null;
  paymentOption?: string;
  onSiteRequestState?: OnSiteRequestState | null;
  requestExpiresAt?: string | null;
  icalFeedId?: string | null;
  channelLabel?: string | null;
  otaReviewReason?: OtaReviewReason | null;
  otaReviewRaisedAt?: string | null;
  channelBlock?: OtaChannelBlock | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  arrivedAt?: string | null;
  checkedOutAt?: string | null;
  canEdit?: BookingEditability;
  changeOptions?: BookingChangeOptions;
  paymentState?: BookingPaymentState;
  paidAmount?: number | null;
  otaSource?: string | null;
  origin?: BookingOrigin;
  originChannel?: string | null;
  otaAmounts?: BookingOtaAmounts | null;
  collection?: BookingCollection | null;
  amountSources?: BookingAmountSources | null;
  octorateSync?: BookingOctorateSync | null;
}

type OctorateSyncState = 'Pending' | 'Synced' | 'Failed' | 'Conflict' | 'NotAllowedByChannel';

type OctorateSyncOperation = 'Create' | 'Update' | 'Cancel' | 'Payment';

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

export interface BookingOtaAmounts {
  commission: number | null;
  net: number | null;
  paid: number | null;
  balance: number | null;
  currency: string;
}

interface BookingCollection {
  companyCollect: boolean | null;
  commissionIncludedInPayments: boolean | null;
}

export const BOOKING_AMOUNT_SOURCES = ['Stripe', 'ChannelManager', 'Manual'] as const;
export type BookingAmountSource = (typeof BOOKING_AMOUNT_SOURCES)[number];

export interface BookingAmountSources {
  total?: BookingAmountSource;
  commission?: BookingAmountSource;
  net?: BookingAmountSource;
  paid?: BookingAmountSource;
  balance?: BookingAmountSource;
}

export type BookingEditLock = 'Cancelled' | 'Started' | 'SourceLocked';

interface BookingEditability {
  allowed: boolean;
  reason: BookingEditLock | null;
}

export interface BookingChangeOptions {
  canEdit: boolean;
  canCancel: boolean;
  reasonCode?: string | null;
  guidanceKey?: string | null;
  /** The channel of a booking that came from one (`Airbnb`, `BookingCom`, `Expedia`, `Vrbo`, `TripAdvisor`, `Agoda`, `OtherChannel`); null otherwise. */
  channel?: string | null;
  cancelReasonCode?: string | null;
  cancelGuidanceKey?: string | null;
}

export type BookingListView = 'all' | 'toConfirm' | 'upcoming' | 'inProgress' | 'completed' | 'cancelled';

export type BookingChannel = 'Direct' | 'Manual' | 'Airbnb' | 'BookingCom' | 'Expedia' | 'Vrbo' | 'TripAdvisor' | 'Agoda' | 'Other';

export const BOOKING_ORIGINS = ['Portal', 'AgencySite', 'CasaZenSite', 'Manual'] as const;
export type BookingOrigin = (typeof BOOKING_ORIGINS)[number];

type BookingPaymentState = 'None' | 'Partial' | 'Paid' | 'Refunded';

export interface BookingListItem extends Booking {
  bookingCode: string;
  channel: BookingChannel;
  paymentState: BookingPaymentState;
  paidAmount?: number | null;
  respondBy?: string | null;
}

export interface BookingCounts {
  all: number;
  toConfirm: number;
  upcoming: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface BookingFilterParams {
  q?: string;
  propertyId?: string;
  channel?: string;
  origin?: string;
  checkInStatus?: string;
  arrivalFrom?: string;
  arrivalTo?: string;
}

export interface BookingListParams extends BookingFilterParams {
  view?: BookingListView;
  sort?: string;
  page?: number;
  pageSize?: number;
}

interface OtaChannelBlock {
  id: string;
  startDate: string;
  endDate: string;
}

export const OTA_STAY_SOURCES = ['Airbnb', 'BookingCom', 'Expedia', 'Vrbo', 'TripAdvisor', 'Agoda'] as const;
export type OtaStaySource = (typeof OTA_STAY_SOURCES)[number];

export interface CreateOtaStayDto {
  firstName: string;
  lastName: string;
  email: string;
  numberOfGuests?: number;
  totalPrice?: number;
  source?: OtaStaySource;
}

export interface ResolveOtaReviewDto {
  applyChannelDates?: boolean;
}

type OnSiteRequestState = 'AwaitingGuestEmail' | 'AwaitingHostApproval';

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
  respondBy: string | null;
}

export interface DeclineBookingRequestDto {
  message?: string;
}

export interface CreateBookingDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
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

export interface CreateManualBookingDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  childrenAges?: number[];
  guest: { firstName: string; lastName?: string; email: string; phone?: string };
  note?: string;
  totalPrice?: number;
  priceNote?: string;
  blockId?: string;
  /**
   * How the guest pays (the payment step of the wizard, NF-74). `paymentLink` needs `payment.write` and a Stripe account ready (422 `payment_link_unavailable`
   * otherwise). Never with `blockId`: the portal collects.
   */
  paymentArrangement?: HostPaymentArrangement;
}

export interface ManualBooking extends Booking {
  belowMinimum: boolean;
  minNights: number | null;
  guestDataComplete: boolean;
  /**
   * With `paymentArrangement: 'paymentLink'`: the link e-mailed to the guest, given this once for the host to copy (a credential: the token in it is never stored
   * by the API, so it is shown on the result of the wizard only and kept nowhere). `null` for the other arrangements and when the link could not be made.
   */
  paymentLinkUrl?: string | null;
  /** Why the link is missing although the booking was created (`payment_link_unavailable`, `payment_provider_error`): the host sends it again. `null` otherwise. */
  paymentLinkError?: string | null;
}

export interface BookingPaymentLink {
  bookingId: string;
  paymentLinkUrl: string;
  amount: number;
  currency: string;
  sentAt: string;
  emailSent: boolean;
}

type StayAvailabilityState = 'ok' | 'belowMinimum' | 'occupied' | 'linkableBlock' | 'invalid';

type StayAvailabilityInvalidReason = 'checkOutNotAfterCheckIn' | 'checkInInPast' | 'stayTooLong';

type StayAvailabilityConflictType = 'booking' | 'ical' | 'block' | 'channelManager';

export interface StayAvailabilityConflict {
  id: string;
  type: StayAvailabilityConflictType;
  title: string | null;
  channel: BookingChannel | null;
  from: string;
  to: string;
}

export interface StayAvailabilityWindow {
  from: string;
  to: string;
}

export interface StayAvailability {
  propertyId: string;
  from: string;
  to: string;
  state: StayAvailabilityState;
  invalidReason: StayAvailabilityInvalidReason | null;
  nights: number;
  minNights: number | null;
  conflicts: StayAvailabilityConflict[];
  nearestFreeWindow: StayAvailabilityWindow | null;
  linkableBlockId: string | null;
  /**
   * Whether the channel manager was asked (NF-74, NF-80): `null` for a property that is not mirrored there (nothing to ask), `true` when it answered (its
   * "not available" is `occupied` with a `channelManager` conflict), `false` when it could not be asked. `false` is advice only: it never blocks the host,
   * the API asks again when the booking is created. Missing in the answer of an older API: read as `null`.
   */
  channelManagerChecked?: boolean | null;
}

export interface StayAvailabilityParams {
  propertyId: string;
  from: string;
  to: string;
}

export interface UpdateBookingDto {
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  numberOfChildren?: number;
  childrenAges?: number[];
  specialRequests?: string;
}

type BookingSettlementAction = 'refund' | 'chargeSavedCard' | 'paymentLink' | 'none';

type BookingSettlementState = 'done' | 'pending' | 'none';

export interface BookingEditSettlement {
  action: BookingSettlementAction;
  state: BookingSettlementState;
  amount: number;
  offlineRefundDue: number;
  currency: string;
}

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

export interface UpdatedBooking extends Booking {
  settlement?: BookingEditSettlement;
}

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

type CancellationRefundRule = 'None' | 'FreeCancellationDeadline' | 'PropertyCancellationPolicy';

export interface BookingCancellationQuote {
  bookingId: string;
  status: BookingStatus;
  cancellable: boolean;
  currency: string;
  paidAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  refundableAmount: number;
  minimumRefundAmount: number;
  rule: CancellationRefundRule;
  freeCancellationUntil?: string | null;
  cancellationPolicyName?: string | null;
  offlinePaidAmount: number;
  hasUncollectedIntent: boolean;
  requiresRefundDecision: boolean;
}

export interface CancelBookingDto {
  refundAmount?: number;
  reason?: string;
}

export interface CancelBookingResult {
  bookingId: string;
  status: BookingStatus;
  refunds: PaymentRefund[];
  canceledIntents: number;
}

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

type BookingTimelineState = 'Done' | 'Current';

type BookingCancellationReason =
  | 'CheckoutHoldExpired'
  | 'DatesUnavailableAtPayment'
  | 'OnSiteRequestDeclined'
  | 'OnSiteRequestExpired'
  | 'OnSiteEmailNotConfirmed'
  | 'DeferredPaymentNotCompleted'
  | 'GuestRequested';

type BookingCheckInLinkState = 'Sent' | 'InProgress' | 'Expired' | 'Completed';

interface BookingTimelineData {
  source: string | null;
  amount: number | null;
  method: PaymentMethod | null;
  expiresAt: string | null;
  reason: BookingCancellationReason | null;
  note: string | null;
  linkState: BookingCheckInLinkState | null;
  alloggiatiStatus: AlloggiatiWebStatus | null;
  /** The legal term of the Alloggiati communication while it is not sent (`Alloggiati`), UTC. */
  deadlineAt: string | null;
  refundStatus: PaymentRefundStatus | null;
}

export interface BookingTimelineEvent {
  kind: BookingTimelineKind;
  at: string | null;
  state: BookingTimelineState;
  data: BookingTimelineData;
}

export interface BookingTimeline {
  bookingId: string;
  events: BookingTimelineEvent[];
}
