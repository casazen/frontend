import { z } from 'zod';

/** A payment the host received outside CasaZen (SR-06b): cash or a bank transfer, on the day it came in. */
export const paymentFormSchema = z.object({
  bookingId: z.string().min(1, 'payment.validation.bookingId.required'),
  amount: z.number().min(0.01, 'payment.validation.amount.min'),
  method: z.enum(['CashOnArrival', 'BankTransfer']),
  receivedOn: z.string().min(1, 'payment.validation.receivedOn.required'),
  description: z.string().optional(),
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
