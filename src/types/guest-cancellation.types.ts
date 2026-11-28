/**
 * What a guest sees before cancelling their booking, and what the cancellation answers (DB-08a, DB-08b). Every figure comes from the
 * backend (`GET /api/public/guest/bookings/{code}/cancellation` in the guest area, `GET /api/public/bookings/{id}/cancellation?token=`
 * on the page of the link the host sent): the browser formats them and never works one out.
 */

type GuestCancellationKind = 'cancel' | 'withdrawRequest' | 'deferredNoCharge';

type GuestCancellationReason = 'already_cancelled' | 'stay_started' | 'not_cancellable_status' | 'payment_in_progress';

/** Where a refund stands: never `confirmed` before the bank/Stripe says so. */
export type GuestRefundStatus = 'none' | 'pending' | 'confirmed' | 'failed';

interface GuestCancellationPolicy {
  slug: string;
  name: string;
  description: string | null;
}

interface GuestCancellationStay {
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
}

interface GuestCancellationOutcome {
  refundAmount: number;
  refundStatus: GuestRefundStatus;
}

export interface GuestCancellationPreview {
  cancellable: boolean;
  reason: GuestCancellationReason | null;
  kind: GuestCancellationKind;
  currency: string;
  paidAmount: number;
  alreadyRefundedAmount: number;
  refundPercent: number;
  refundAmount: number;
  retainedAmount: number;
  retainedBecause: 'policy' | null;
  policy: GuestCancellationPolicy | null;
  fullRefundUntil: string | null;
  partialRefundPercent: number | null;
  partialRefundUntil: string | null;
  stay: GuestCancellationStay;
  outcome: GuestCancellationOutcome | null;
  generatedAt: string;
}

export interface GuestCancelResult {
  status: string;
  refundAmount: number;
  refundStatus: GuestRefundStatus;
}

export interface GuestLinkCancelResult extends GuestCancelResult {
  bookingId: string;
}
