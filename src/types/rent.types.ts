/**
 * Recurring rent of a long-term lease (LT-06, #269). Dates are `YYYY-MM-DD` calendar dates (Europe/Rome); instants are
 * ISO UTC strings.
 */
export type RentCadence = 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Semiannual';

/**
 * Real state of an installment: `Scheduled` to collect, `Processing` payment in flight on Stripe, `Paid` (Stripe
 * confirmed it or the landlord declared it), `Failed` last online payment failed, `Cancelled` schedule disabled.
 */
export type RentInstallmentStatus = 'Scheduled' | 'Processing' | 'Paid' | 'Failed' | 'Cancelled';

export type RentPaymentChannel = 'Stripe' | 'Offline';

export interface RentInstallment {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: RentInstallmentStatus;
  /** Not paid and past its due date (computed by the server on the Rome calendar). */
  isOverdue: boolean;
  paidVia: RentPaymentChannel | null;
  paidOn: string | null;
  offlinePaymentNote: string | null;
  /** When the payment link was last emailed to the tenants. */
  paymentRequestedAt: string | null;
  /** Stripe error code of the last failed online payment (e.g. `card_declined`). */
  failureCode: string | null;
  lastFailedAt: string | null;
}

export interface RentSchedule {
  cadence: RentCadence;
  billingDayOfMonth: number;
  amount: number;
  currency: string;
  isActive: boolean;
}

export interface RentPeriod {
  start: string;
  end: string;
}

/** `GET /leases/:id/rent`. */
export interface RentLedger {
  leaseId: string;
  monthlyRent: number;
  /** The lease is signed by every party: the schedule can be set up. */
  canConfigure: boolean;
  /** The org's Stripe connected account accepts charges: the tenant can be asked to pay online. */
  onlinePaymentsAvailable: boolean;
  hasTenantEmail: boolean;
  schedule: RentSchedule | null;
  installments: RentInstallment[];
  /** Final period shorter than the cadence: no installment is generated for it (no pro rata rule assumed). */
  partialFinalPeriod: RentPeriod | null;
}

/** `PUT /leases/:id/rent/schedule`: omitted values default to the lease (start day, monthly rent × months). */
export interface ConfigureRentScheduleInput {
  cadence: RentCadence;
  billingDayOfMonth?: number;
  amount?: number;
}

export interface MarkRentPaidInput {
  /** `YYYY-MM-DD`, not later than today in Europe/Rome. */
  paidOn: string;
  note?: string;
}

export type PublicRentPaymentState = 'Payable' | 'Processing' | 'Paid' | 'Unavailable';

/** `POST /public/rent-payments/:id` with the token of the link: what the tenant sees, no personal data. */
export interface PublicRentPayment {
  installmentId: string;
  propertyName: string;
  landlordName: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: number;
  currency: string;
  state: PublicRentPaymentState;
  lastPaymentFailed: boolean;
}

/** `POST /public/rent-payments/:id/payment-session`: the PaymentIntent on the landlord's connected account. */
export interface PublicRentPaymentSession {
  installmentId: string;
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
}
