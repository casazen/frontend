export type PaymentStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Refunded'
  | 'PartiallyRefunded'
  | 'Canceled';

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

export interface PaymentListItem {
  id: string;
  bookingId: string;
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  guestName: string;
  amount: number;
  amountCents: number;
  refundedAmount: number;
  refundedAmountCents: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  description: string;
  transactionId?: string;
  /** The Stripe PaymentIntent; null for a payment that never went through Stripe. */
  stripePaymentIntentId?: string | null;
  processedAt: string | null;
  createdAt: string;
  bookingCheckIn?: string | null;
  bookingCheckOut?: string | null;
}

interface CreatePaymentDto {
  bookingId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  description?: string;
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

export type PaymentRefundStatus = 'Pending' | 'Succeeded' | 'Failed' | 'Canceled' | 'RequiresAction';

type PaymentRefundOrigin = 'Host' | 'BookingCancellation' | 'Stripe';

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

export interface PaymentRefundsResponse {
  paymentId: string;
  paidAmount: number;
  refundedAmount: number;
  pendingRefundAmount: number;
  refundableAmount: number;
  refundableOnline: boolean;
  refunds: PaymentRefund[];
}

export interface RefundPaymentDto {
  amount?: number;
  reason?: string;
}

export interface RevenueParams {
  startDate?: string;
  endDate?: string;
  propertyId?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
}

interface RevenueData {
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
