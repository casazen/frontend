// ✅ Fixed: Backend uses PascalCase enum values
export type PaymentStatus =
  | 'Pending'
  | 'Processing'
  | 'Completed'
  | 'Failed'
  | 'Refunded'
  | 'PartiallyRefunded';

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

export interface ProcessPaymentDto {
  paymentMethodId: string;
  saveCard?: boolean;
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
