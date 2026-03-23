import { z } from 'zod';

export const paymentFormSchema = z.object({
  bookingId: z.string().min(1, 'Booking is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  currency: z.string(),
  method: z.enum(['CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'BANK_TRANSFER', 'CASH']),
  description: z.string().optional(),
});

export const processPaymentSchema = z.object({
  paymentMethodId: z.string().min(1, 'Payment method is required'),
  saveCard: z.boolean().optional(),
});

export const refundPaymentSchema = z.object({
  amount: z.number().min(0.01).optional(),
  reason: z.string().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;
export type ProcessPaymentFormValues = z.infer<typeof processPaymentSchema>;
export type RefundPaymentFormValues = z.infer<typeof refundPaymentSchema>;

export const PAYMENT_STATUS_LABELS: Record<string, {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'
}> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  PROCESSING: { label: 'Processing', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  REFUNDED: { label: 'Refunded', variant: 'secondary' },
  PARTIALLY_REFUNDED: { label: 'Partially Refunded', variant: 'secondary' },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CREDIT_CARD: 'Credit Card',
  DEBIT_CARD: 'Debit Card',
  PAYPAL: 'PayPal',
  BANK_TRANSFER: 'Bank Transfer',
  CASH: 'Cash',
};
