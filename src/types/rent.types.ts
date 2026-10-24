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
  /** LR-04a: the day the rents are tracked from (`YYYY-MM-DD`); null = from the start of the lease. */
  trackFrom?: string | null;
  /** LR-04a: the daily job emails the tenants the payment links. Off for a new plan, until the landlord turns it on. */
  onlineRequestsEnabled?: boolean;
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

/**
 * `PUT /leases/:id/rent/schedule`: omitted values default to the lease (start day, monthly rent × months). Until the plan has
 * its own endpoint for the online requests the server recomputes the day and the amount that are missing, so a change of any
 * other part sends the current ones again. `trackFrom` absent keeps the day the plan already has; a day on or before the start
 * of the lease means «from the start». `onlineRequests` absent keeps the choice (off for a new plan).
 */
export interface ConfigureRentScheduleInput {
  cadence: RentCadence;
  billingDayOfMonth?: number;
  amount?: number;
  trackFrom?: string;
  onlineRequests?: boolean;
}

export interface MarkRentPaidInput {
  /** `YYYY-MM-DD`, not later than today in Europe/Rome. */
  paidOn: string;
  note?: string;
}

/** What the rent register can be narrowed to (`GET /long-rent/rents?status=`): the three states a landlord reads at a glance. */
export type RentRegisterStatus = 'All' | 'Paid' | 'Pending' | 'Overdue';

/** A number of installments and what they add up to. */
export interface RentCounter {
  count: number;
  amount: number;
}

/** The numbers of the whole month, whatever the status filter and the page. */
export interface RentRegisterCounters {
  /** Everything due in the month and not cancelled: `collected` + `pending` + `overdue`. */
  expected: RentCounter;
  collected: RentCounter;
  /** Still to come, or a payment in flight. */
  pending: RentCounter;
  /** Past its due date and not paid. */
  overdue: RentCounter;
}

/**
 * One installment of the register (LR-01). The tenant is the first one of the lease, by name only; the names are null once
 * that tenant was anonymized. `canRemind`: the installment is not paid nor in flight, a tenant has an email address and the
 * interval since the last reminder has passed.
 */
export interface RentRegisterRow {
  id: string;
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantFirstName: string | null;
  tenantLastName: string | null;
  tenantAnonymized: boolean;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: RentInstallmentStatus;
  isOverdue: boolean;
  daysOverdue: number | null;
  paidVia: RentPaymentChannel | null;
  paidOn: string | null;
  paymentRequestedAt: string | null;
  lastReminderAt: string | null;
  reminderCount: number;
  canRemind: boolean;
}

/** `GET /long-rent/rents`. `month` is `yyyy-MM`. */
export interface RentRegisterPage {
  month: string;
  counters: RentRegisterCounters;
  items: RentRegisterRow[];
  total: number;
  page: number;
  pageSize: number;
  /** The org accepts rent online (Stripe), so a reminder carries the payment link. */
  onlinePaymentsAvailable: boolean;
  /** The least time between two reminders of the same installment. */
  reminderIntervalHours: number;
}

export interface RentRegisterParams {
  /** `yyyy-MM`; the current month in Rome when missing. */
  month?: string;
  status?: RentRegisterStatus;
  page?: number;
  pageSize?: number;
}

/** What the server answers to one reminder: who was written to is not part of it, only how many. */
export interface RentReminderResult {
  installmentId: string;
  sentAt: string;
  reminderCount: number;
  recipientCount: number;
  includesPaymentLink: boolean;
  nextReminderAllowedAt: string;
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
