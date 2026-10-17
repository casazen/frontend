// ✅ Fixed: Backend uses PascalCase enum values
export type PaymentStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Refunded'
  | 'PartiallyRefunded'
  /** Never collected: the PaymentIntent or SetupIntent was canceled with the booking (BK-02). */
  | 'Canceled';

// ✅ Fixed: Backend uses PascalCase enum values
export type PaymentMethod =
  | 'CreditCard'
  | 'BankTransfer'
  | 'PayPal'
  | 'ApplePay'
  | 'GooglePay'
  /** The guest pays at the property (a booking on request): the backend has had it since BK-01. */
  | 'CashOnArrival';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  refundedAmount?: number;
  description?: string;
  otaWithholdingTax?: number;
  withholdingTaxApplied?: boolean;
  netAmountAfterWithholding?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A payment as `GET /payments` lists it (SR-03, `PaymentListItemDto`): the guest, the property and the code of its booking,
 * the amounts in euros and in cents (exact), the status and the method by name. The days are UTC instants: `processedAt` is
 * when the money came in (null until then), `createdAt` when the payment was recorded.
 */
export interface PaymentListItem {
  id: string;
  bookingId: string;
  /** The code the guest knows, `XXXXX-XXXXX`. */
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  /** First and last name of the guest of the booking; empty when the booking has no name. */
  guestName: string;
  amount: number;
  amountCents: number;
  /** What was given back so far. */
  refundedAmount: number;
  refundedAmountCents: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  description: string;
  /** Empty for a payment nobody has a Stripe id for: with no `stripePaymentIntentId` it is a row only the host can collect (SR-06b). */
  transactionId?: string;
  /** The Stripe PaymentIntent; null for a payment that never went through Stripe. */
  stripePaymentIntentId?: string | null;
  processedAt: string | null;
  createdAt: string;
}

/** `POST /payments` (SR-06b): a payment the host received outside CasaZen, cash or bank transfer, to record on a booking. */
export interface CreatePaymentDto {
  bookingId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  description?: string;
  /** The day the money came in (`YYYY-MM-DD`, Europe/Rome); today when missing. */
  receivedOn?: string;
  applyOtaWithholding?: boolean;
  manualWithholdingTax?: number;
  otaWithholdingTax?: number;
  withholdingTaxApplied?: boolean;
  netAmountAfterWithholding?: number;
}

/** What the host's record is sent with: the key that makes it happen once, however many times it is sent (header `Idempotency-Key`). */
export interface RecordPaymentInput extends CreatePaymentDto {
  idempotencyKey: string;
}

export interface UpdatePaymentDto extends Partial<CreatePaymentDto> {
  status?: PaymentStatus;
}

/**
 * Stripe status of one refund (BK-02). Only `Succeeded` means the money went back: `Pending` and
 * `RequiresAction` are still waiting for Stripe, `Failed` and `Canceled` refunded nothing.
 */
export type PaymentRefundStatus = 'Pending' | 'Succeeded' | 'Failed' | 'Canceled' | 'RequiresAction';

/** Who started the refund: the host, the booking cancellation, or someone on the Stripe Dashboard. */
export type PaymentRefundOrigin = 'Host' | 'BookingCancellation' | 'Stripe';

export interface PaymentRefund {
  id: string;
  paymentId: string;
  amount: number;
  status: PaymentRefundStatus;
  origin: PaymentRefundOrigin;
  failureReason?: string | null;
  reason?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

/** GET /payments/:id/refunds */
export interface PaymentRefundsResponse {
  paymentId: string;
  paidAmount: number;
  /** Confirmed by Stripe. */
  refundedAmount: number;
  /** Sent and not confirmed yet. */
  pendingRefundAmount: number;
  refundableAmount: number;
  /** False when the payment did not go through Stripe or is not collected. */
  refundableOnline: boolean;
  refunds: PaymentRefund[];
}

/** POST /payments/:id/refund; without `amount` everything still refundable. */
export interface RefundPaymentDto {
  amount?: number;
  reason?: string;
}

/** Matches GET /payments/revenue backend response. */
export interface RevenueResponse {
  propertyId: string;
  startDate: string;
  endDate: string;
  revenue: number;
}

export interface RevenueParams {
  startDate?: string;
  endDate?: string;
  propertyId?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
}

export interface RevenueData {
  period: string;
  revenue: number;
  bookings: number;
  averageBookingValue: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  totalBookings: number;
  averageBookingValue: number;
  data: RevenueData[];
}
