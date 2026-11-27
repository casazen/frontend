/**
 * The payment ledger (FIS-05, NF-85, E06/F04/US01): the contract of `GET api/payment-ledger/bookings/{bookingId}` and `GET api/payment-ledger` of the backend
 * (`PaymentLedgerController`, policy `payment.read`). One list of everything collected for a booking or for a period: the card payments, the manual ones and
 * the ones a channel collected, each with the state the server gives it and the fiscal document of its booking.
 *
 * The words of the wire are stable codes, never a text to show: the screens translate them. The API writes the enums by name and leaves out what is empty, so
 * every member that may be missing is optional here. Every amount is a number the server wrote in `currency` (the currency of the property), except the fee and
 * the net, which are in `providerCurrency` when the server says one: the client shows them as they come, never adds them up and never converts them.
 */

export const PAYMENT_LEDGER_KINDS = ['Card', 'BankTransfer', 'Cash', 'Ota', 'Other'] as const;
type PaymentLedgerKind = (typeof PAYMENT_LEDGER_KINDS)[number];

export const PAYMENT_LEDGER_STATES = ['Paid', 'ToCollect', 'Refunded', 'PartiallyRefunded', 'Failed', 'Canceled'] as const;
type PaymentLedgerState = (typeof PAYMENT_LEDGER_STATES)[number];

export const PAYMENT_LEDGER_COLLECTORS = ['Unknown', 'Host', 'Channel', 'Platform'] as const;
type PaymentLedgerCollector = (typeof PAYMENT_LEDGER_COLLECTORS)[number];

export interface PaymentLedgerDocument {
  id: string;
  number?: string | null;
  kind: string;
  status: string;
  paymentState: string;
}

export interface PaymentLedgerLine {
  kind: PaymentLedgerKind;
  bookingId: string;
  bookingCode: string;
  paymentId?: string | null;
  date: string;
  gross: number;
  providerFee?: number | null;
  net?: number | null;
  providerCurrency?: string | null;
  creditDate?: string | null;
  currency: string;
  state: PaymentLedgerState;
  collectedBy: PaymentLedgerCollector;
  document?: PaymentLedgerDocument | null;
}

export interface PaymentLedgerBooking {
  bookingId: string;
  bookingCode: string;
  channel: string;
  currency: string;
  lines: PaymentLedgerLine[];
  degraded: boolean;
}

export interface PaymentLedgerPage {
  items: PaymentLedgerLine[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PaymentLedgerCriteria {
  from?: string;
  to?: string;
  propertyId?: string;
  bookingId?: string;
}
