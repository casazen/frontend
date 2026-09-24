import { z } from 'zod';

export const paymentFormSchema = z.object({
  bookingId: z.string().min(1, 'payment.validation.bookingId.required'),
  amount: z.number().min(0.01, 'payment.validation.amount.min'),
  currency: z.string(),
  method: z.enum(['CreditCard', 'BankTransfer', 'PayPal', 'ApplePay', 'GooglePay']),
  description: z.string().optional(),
  applyOtaWithholding: z.boolean().optional(),
  manualWithholdingTax: z.number().optional(),
});

export type PaymentFormValues = z.infer<typeof paymentFormSchema>;

// Payment status labels are now resolved via getPaymentStatusLabel() from @/lib/i18n-labels.
// Payment method labels are now resolved via getPaymentMethodLabel() from @/lib/i18n-labels.
// Variants stay here as a UI-only concern.
export const PAYMENT_STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  Pending: 'warning',
  Processing: 'default',
  Completed: 'success',
  Failed: 'destructive',
  Refunded: 'secondary',
  PartiallyRefunded: 'secondary',
  Canceled: 'secondary',
  PENDING: 'warning',
  PROCESSING: 'default',
  COMPLETED: 'success',
  FAILED: 'destructive',
  REFUNDED: 'secondary',
  PARTIALLY_REFUNDED: 'secondary',
};
