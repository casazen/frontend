/**
 * The payment ledger (FIS-05, NF-85, E06/F04/US01): the contract of `GET api/payment-ledger/bookings/{bookingId}` and `GET api/payment-ledger` of the backend
 * (`PaymentLedgerController`, policy `payment.read`). One list of everything collected for a booking or for a period: the card payments, the manual ones and
 * the ones a channel collected, each with the state the server gives it and the fiscal document of its booking.
 *
 * The words of the wire are stable codes, never a text to show: the screens translate them. The API writes the enums by name and leaves out what is empty, so
 * every member that may be missing is optional here. Every amount is a number the server wrote in `currency` (the currency of the property), except the fee and
 * the net, which are in `providerCurrency` when the server says one: the client shows them as they come, never adds them up and never converts them.
 */

/** What a line is: a card payment, a bank transfer, cash, a payment of a channel, or any other way. */
export const PAYMENT_LEDGER_KINDS = ['Card', 'BankTransfer', 'Cash', 'Ota', 'Other'] as const;
export type PaymentLedgerKind = (typeof PAYMENT_LEDGER_KINDS)[number];

/**
 * Whether the money of a line came in. `ToCollect` is a payment recorded or on its way (pending or processing) and nothing else: a payment cancelled with its
 * booking is `Canceled`, and a state that is not `Paid` is never shown as collected.
 */
export const PAYMENT_LEDGER_STATES = ['Paid', 'ToCollect', 'Refunded', 'PartiallyRefunded', 'Failed', 'Canceled'] as const;
export type PaymentLedgerState = (typeof PAYMENT_LEDGER_STATES)[number];

/** Who collected the money of a line (`Unknown`: the server does not know). */
export const PAYMENT_LEDGER_COLLECTORS = ['Unknown', 'Host', 'Channel', 'Platform'] as const;
export type PaymentLedgerCollector = (typeof PAYMENT_LEDGER_COLLECTORS)[number];

/** The fiscal document of the booking a line belongs to: its id, its number (a draft has none) and the stable codes of its kind, its status and its collection state. */
export interface PaymentLedgerDocument {
  id: string;
  number?: string | null;
  /** `Invoice`, `Receipt`, `CreditNote` or `Proforma`. */
  kind: string;
  /** `Draft` or `Issued`. */
  status: string;
  /** `Unknown`, `ToCollect` or `Paid`: whether the amount of the document was collected. */
  paymentState: string;
}

/**
 * One line of the ledger. `date` is the Europe/Rome day of the settlement (`YYYY-MM-DD`). `providerFee`, `net` and `creditDate` are there only when the server has
 * them (a payment not captured yet has none) and are never worked out here.
 */
export interface PaymentLedgerLine {
  kind: PaymentLedgerKind;
  bookingId: string;
  bookingCode: string;
  /** The payment of the line; none for a line that comes from the amounts of a channel. */
  paymentId?: string | null;
  date: string;
  gross: number;
  providerFee?: number | null;
  net?: number | null;
  /** The currency of the fee and of the net when it is not the one of the line (the balance of the provider); missing: the one of the line. */
  providerCurrency?: string | null;
  creditDate?: string | null;
  currency: string;
  state: PaymentLedgerState;
  collectedBy: PaymentLedgerCollector;
  document?: PaymentLedgerDocument | null;
}

/**
 * The ledger of one booking. `degraded`: the collections of its channel could not be read right now and the lines are the amounts stored on the booking, not an
 * error.
 */
export interface PaymentLedgerBooking {
  bookingId: string;
  bookingCode: string;
  channel: string;
  currency: string;
  lines: PaymentLedgerLine[];
  degraded: boolean;
}

/** One page of the lines of a period, newest first; `totalCount` is every line of the period, whatever the page. */
export interface PaymentLedgerPage {
  items: PaymentLedgerLine[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** What narrows the ledger of a period: the Europe/Rome days (`YYYY-MM-DD`, both included), one property, one booking. */
export interface PaymentLedgerCriteria {
  from?: string;
  to?: string;
  propertyId?: string;
  bookingId?: string;
}
