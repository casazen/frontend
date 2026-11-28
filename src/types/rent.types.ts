export type RentCadence = 'Monthly' | 'Bimonthly' | 'Quarterly' | 'Semiannual';

export type RentInstallmentStatus = 'Scheduled' | 'Processing' | 'Paid' | 'Failed' | 'Cancelled';

type RentPaymentChannel = 'Stripe' | 'Offline';

type RentComponentKind = 'Rent' | 'CondominiumAdvance' | 'CondominiumSettlement' | 'Other';

export interface RentLedgerComponent {
  id?: string;
  kind: RentComponentKind | string;
  amount: number;
  description?: string | null;
  competenceStart?: string | null;
  competenceEnd?: string | null;
  accepted?: boolean;
}

interface RentTransferDetails {
  accountHolder: string;
  iban: string;
  reference: string;
  tenantAreaUrl?: string | null;
}

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
  isOverdue: boolean;
  paidVia: RentPaymentChannel | null;
  paidOn: string | null;
  offlinePaymentNote: string | null;
  paymentRequestedAt: string | null;
  failureCode: string | null;
  lastFailedAt: string | null;
  components?: RentLedgerComponent[] | null;
  amountPaid?: number | null;
  residual?: number | null;
  transfer?: RentTransferDetails | null;
}

interface RentSchedule {
  cadence: RentCadence;
  billingDayOfMonth: number;
  amount: number;
  currency: string;
  isActive: boolean;
  trackFrom?: string | null;
  onlineRequestsEnabled?: boolean;
}

interface RentPeriod {
  start: string;
  end: string;
}

export interface RentLedger {
  leaseId: string;
  monthlyRent: number;
  canConfigure: boolean;
  /** The org's Stripe connected account accepts charges: the tenant can be asked to pay online. */
  onlinePaymentsAvailable: boolean;
  hasTenantEmail: boolean;
  schedule: RentSchedule | null;
  installments: RentInstallment[];
  partialFinalPeriod: RentPeriod | null;
  manualNotices?: RentManualNotice[] | null;
}

export interface ConfigureRentScheduleInput {
  cadence: RentCadence;
  billingDayOfMonth?: number;
  amount?: number;
  trackFrom?: string;
  onlineRequests?: boolean;
}

export interface MarkRentPaidInput {
  paidOn: string;
  note?: string;
}

export type RentRegisterStatus = 'All' | 'Paid' | 'Pending' | 'Overdue';

interface RentCounter {
  count: number;
  amount: number;
}

export interface RentRegisterCounters {
  expected: RentCounter;
  collected: RentCounter;
  pending: RentCounter;
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
  components?: RentLedgerComponent[] | null;
  amountPaid?: number | null;
  residual?: number | null;
  transfer?: RentTransferDetails | null;
  hasTenantPhone?: boolean;
  canWhatsAppRemind?: boolean;
}

export interface RentRegisterPage {
  month: string;
  counters: RentRegisterCounters;
  items: RentRegisterRow[];
  total: number;
  page: number;
  pageSize: number;
  onlinePaymentsAvailable: boolean;
  reminderIntervalHours: number;
}

export interface RentRegisterParams {
  month?: string;
  status?: RentRegisterStatus;
  page?: number;
  pageSize?: number;
}

export interface RentReminderResult {
  installmentId: string;
  sentAt: string;
  reminderCount: number;
  recipientCount: number;
  includesPaymentLink: boolean;
  nextReminderAllowedAt: string;
}

export interface RentWhatsAppReminder {
  installmentId: string;
  sentAt: string;
  recipientCount: number;
  nextReminderAllowedAt: string;
}

type BankStatementFormat = 'Csv' | 'Xlsx' | 'Camt053' | 'Mt940';

export type BankImportConfidence = 'High' | 'Medium' | 'Low';

type BankImportReason = 'Amount' | 'Surname' | 'FirstName' | 'PayerIban' | 'PayerName' | 'Property' | 'Month';

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

export interface BankImportSuggestion {
  fingerprint: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  payer: string | null;
  confidence: BankImportConfidence;
  reasons: BankImportReason[];
  installment: BankImportInstallment;
  alternatives: BankImportInstallment[];
}

export interface BankImportCredit {
  fingerprint: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  payer: string | null;
}

interface BankImportSummary {
  movements: number;
  credits: number;
  alreadyImported: number;
  suggested: number;
  confident: number;
  unmatched: number;
}

export interface BankImportPreview {
  format: BankStatementFormat;
  summary: BankImportSummary;
  suggestions: BankImportSuggestion[];
  unmatched: BankImportCredit[];
}

export interface BankColumnMapping {
  headerRow: number;
  date: number;
  description: number;
  amount: number;
}

export interface BankColumnsProblem {
  headerRow: number;
  columnCount: number;
  rows: string[][];
}

export interface BankImportSelection {
  fingerprint: string;
  installmentId: string;
}

interface BankImportSkipped extends BankImportSelection {
  code: string;
}

export interface BankImportConfirmation {
  requested: number;
  confirmed: BankImportSelection[];
  skipped: BankImportSkipped[];
}

type PublicRentPaymentState = 'Payable' | 'Processing' | 'Paid' | 'Unavailable';

/** `POST /public/rent-payments/:id` with the token of the link: what the tenant sees, no personal data. */
export interface PublicRentPayment {
  components?: RentLedgerComponent[];
  transactionFee?: number;
  totalAmount?: number;
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

export interface PublicRentPaymentSession {
  installmentId: string;
  clientSecret: string;
  publishableKey: string;
  stripeAccountId: string;
}
