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

/** One part of a rent-ledger row (CondoLedger phase 1). `AmountDue` stays the total. */
export type RentComponentKind = 'Rent' | 'CondominiumAdvance' | 'CondominiumSettlement' | 'Other';

export interface RentLedgerComponent {
  id?: string;
  kind: RentComponentKind | string;
  amount: number;
  description?: string | null;
  competenceStart?: string | null;
  competenceEnd?: string | null;
}

/**
 * Bank details for a transfer, when the API sends them with the installment. The amount and the due date stay on the row.
 * Absent while the backend has not added them: the screen keeps working on the total alone.
 */
export interface RentTransferDetails {
  accountHolder: string;
  iban: string;
  /** Unique payment reference (causale). */
  reference: string;
  /** Authenticated link to the tenant area, when the message should carry one. */
  tenantAreaUrl?: string | null;
}

/**
 * A budget or a settlement ready for the landlord to send. CasaZen never sends it by itself: the screen posts only after
 * an explicit confirmation (`POST /leases/:id/condominium-notices/:id/send`).
 */
export interface RentManualNotice {
  id: string;
  kind: 'Budget' | 'Settlement';
  title: string;
  recipientName?: string | null;
  summary?: string | null;
}

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
  /**
   * Parts of the installment (rent, condominium advance, settlement, other). Absent while the API still sends only
   * `amount`: the screen then shows that total and leaves the parts blank.
   */
  components?: RentLedgerComponent[] | null;
  /** Collected so far. Absent: a `Paid` installment counts as fully paid, any other as nothing collected. */
  amountPaid?: number | null;
  /** Still due. Absent: `amount` (or the sum of the parts) minus what was collected. */
  residual?: number | null;
  transfer?: RentTransferDetails | null;
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
  /**
   * Budgets and settlements waiting for the landlord to send them. Absent or empty: nothing is offered, and nothing is
   * sent on its own.
   */
  manualNotices?: RentManualNotice[] | null;
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
  /** Same optional parts as an installment. Absent: the row keeps showing `amount` as the total. */
  components?: RentLedgerComponent[] | null;
  amountPaid?: number | null;
  residual?: number | null;
  transfer?: RentTransferDetails | null;
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

/**
 * Import of a bank statement on the rents (`/long-rent/rents/bank-import`). The landlord uploads the movements file of their bank, the
 * server proposes for each credit the installment it pays, and the landlord confirms; the file is not kept, the confirmation sends it again.
 */
export type BankStatementFormat = 'Csv' | 'Xlsx' | 'Camt053' | 'Mt940';

/** How sure the server is: only `High` is ticked by itself; the others wait for the landlord's choice. */
export type BankImportConfidence = 'High' | 'Medium' | 'Low';

/** Why the server thinks so; the screen says it in words. */
export type BankImportReason = 'Amount' | 'Surname' | 'FirstName' | 'PayerIban' | 'PayerName' | 'Property' | 'Month';

/** An installment a credit can pay. The tenant is the first one of the lease, by name only; null once that tenant was anonymized. */
export interface BankImportInstallment {
  id: string;
  leaseId: string;
  propertyId: string;
  propertyName: string;
  tenantName: string | null;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amount: number;
  currency: string;
}

/** A credit of the file that has at least one installment of its amount to pay, with the one proposed and the other possible ones. */
export interface BankImportSuggestion {
  /** SHA-256 of the movement: how the credit is named when the landlord confirms. */
  fingerprint: string;
  /** Value date of the credit (`YYYY-MM-DD`): the day the installment is declared paid. */
  date: string;
  amount: number;
  currency: string;
  /** The reason of the payment as the bank wrote it (clipped): it is the landlord's own file, shown back to them. */
  description: string;
  payer: string | null;
  confidence: BankImportConfidence;
  reasons: BankImportReason[];
  installment: BankImportInstallment;
  alternatives: BankImportInstallment[];
}

/** A credit with no installment to pay. */
export interface BankImportCredit {
  fingerprint: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  payer: string | null;
}

export interface BankImportSummary {
  movements: number;
  credits: number;
  alreadyImported: number;
  suggested: number;
  /** How many suggestions are `High`. */
  confident: number;
  unmatched: number;
}

/** `POST /long-rent/rents/bank-import/preview`: nothing is written. `unmatched` lists at most 200, the latest first. */
export interface BankImportPreview {
  format: BankStatementFormat;
  summary: BankImportSummary;
  suggestions: BankImportSuggestion[];
  unmatched: BankImportCredit[];
}

/**
 * The columns of a table when the landlord says which is which (the importer did not recognize the titles). Rows and columns are counted
 * from 0 over the rows that are not empty; `headerRow` is -1 when the file has no titles.
 */
export interface BankColumnMapping {
  headerRow: number;
  date: number;
  description: number;
  amount: number;
}

/** What the server adds to the 422 `bank_statement_columns_unrecognized`: the first rows of the table, to let the landlord say which column is which. */
export interface BankColumnsProblem {
  /** The row that looks like titles, -1 if none does. */
  headerRow: number;
  columnCount: number;
  rows: string[][];
}

/** One choice of the landlord: this credit pays this installment. */
export interface BankImportSelection {
  fingerprint: string;
  installmentId: string;
}

/** A choice that was not applied, and the stable code of the refusal (`bank_movement_already_imported`, `rent_installment_not_payable`…). */
export interface BankImportSkipped extends BankImportSelection {
  code: string;
}

/** `POST /long-rent/rents/bank-import/confirm`: a skipped choice never stops the others. */
export interface BankImportConfirmation {
  requested: number;
  confirmed: BankImportSelection[];
  skipped: BankImportSkipped[];
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
