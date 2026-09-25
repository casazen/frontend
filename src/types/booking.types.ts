import type { PaymentRefund } from './payment.types';

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
  createdAt: string;
  updatedAt: string;
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

/** POST /bookings/:id/cancel */
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
