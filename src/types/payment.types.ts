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
  | 'GooglePay';

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

export interface CreatePaymentDto {
  bookingId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  description?: string;
  applyOtaWithholding?: boolean;
  manualWithholdingTax?: number;
  otaWithholdingTax?: number;
  withholdingTaxApplied?: boolean;
  netAmountAfterWithholding?: number;
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
