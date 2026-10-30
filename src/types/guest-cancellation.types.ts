/**
 * What a guest sees before cancelling their booking, and what the cancellation answers (DB-08a, DB-08b). Every figure comes from the
 * backend (`GET /api/public/guest/bookings/{code}/cancellation` in the guest area, `GET /api/public/bookings/{id}/cancellation?token=`
 * on the page of the link the host sent): the browser formats them and never works one out.
 */

/** What cancelling means: the plain cancellation, withdrawing a request to pay at the property, or releasing a saved card never charged. */
export type GuestCancellationKind = 'cancel' | 'withdrawRequest' | 'deferredNoCharge';

/** Why the guest cannot cancel from where they are. */
export type GuestCancellationReason = 'already_cancelled' | 'stay_started' | 'not_cancellable_status' | 'payment_in_progress';

/** Where a refund stands: never `confirmed` before the bank/Stripe says so. */
export type GuestRefundStatus = 'none' | 'pending' | 'confirmed' | 'failed';

export interface GuestCancellationPolicy {
  slug: string;
  name: string;
  /** The text of the catalog policy; `null` when the host changed its windows (the text would say something else). */
  description: string | null;
}

export interface GuestCancellationStay {
  propertyName: string;
  /** `YYYY-MM-DD` */
  checkInDate: string;
  /** `YYYY-MM-DD` */
  checkOutDate: string;
}

/** The refund of a cancellation that already happened. */
export interface GuestCancellationOutcome {
  refundAmount: number;
  refundStatus: GuestRefundStatus;
}

/** What cancelling would do now. */
export interface GuestCancellationPreview {
  cancellable: boolean;
  reason: GuestCancellationReason | null;
  kind: GuestCancellationKind;
  currency: string;
  /** Collected so far through the payment provider. */
  paidAmount: number;
  alreadyRefundedAmount: number;
  /** The share of the price of the stay the policy grants now, 0-100 (the tourist tax comes back in full besides). */
  refundPercent: number;
  /** What the guest gets back if they cancel now. */
  refundAmount: number;
  /** What the host keeps. */
  retainedAmount: number;
  retainedBecause: 'policy' | null;
  /** `null` when the property has no cancellation policy. */
  policy: GuestCancellationPolicy | null;
  /** Last day (included) with the full refund, `YYYY-MM-DD`; `null` when the policy has no such window. */
  fullRefundUntil: string | null;
  partialRefundPercent: number | null;
  /** Last day (included) with the partial refund, `YYYY-MM-DD`. */
  partialRefundUntil: string | null;
  stay: GuestCancellationStay;
  /** Only for a booking that is already cancelled. */
  outcome: GuestCancellationOutcome | null;
  /** UTC instant. */
  generatedAt: string;
}

/** The answer to the cancellation from the guest area: the refund starts `pending` until the bank confirms it. */
export interface GuestCancelResult {
  status: string;
  refundAmount: number;
  refundStatus: GuestRefundStatus;
}

/** The answer to the cancellation from the page of the host's link. */
export interface GuestLinkCancelResult extends GuestCancelResult {
  bookingId: string;
}
