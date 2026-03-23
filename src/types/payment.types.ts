export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export type PaymentMethod =
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'PAYPAL'
  | 'BANK_TRANSFER'
  | 'CASH';

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
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentDto {
  bookingId: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  description?: string;
}

export interface UpdatePaymentDto extends Partial<CreatePaymentDto> {
  status?: PaymentStatus;
}

export interface ProcessPaymentDto {
  paymentMethodId: string;
  saveCard?: boolean;
}

export interface RefundPaymentDto {
  amount?: number; // If not provided, full refund
  reason?: string;
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
