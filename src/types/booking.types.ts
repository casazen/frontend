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
  totalPrice: number;
  currency: string;
  status: BookingStatus;
  guest: BookingGuest;
  specialRequests?: string;
  source?: string;
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

export interface CreateBookingDto {
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfGuests: number;
  guest: BookingGuest;
  specialRequests?: string;
}

export interface UpdateBookingDto extends Partial<CreateBookingDto> {
  status?: BookingStatus;
}

export interface BookingCalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource?: Booking;
  eventType?: 'booking' | 'ical-block';
}

export interface CheckInDto {
  actualCheckInTime?: string;
  notes?: string;
}

export interface CheckOutDto {
  actualCheckOutTime?: string;
  notes?: string;
  damages?: string;
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
