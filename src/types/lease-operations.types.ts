/**
 * The operations of a lease in force (LR-OPS-1, `GET /leases/:id/operations`): what the landlord can do about the end of the lease, the
 * letters CasaZen prepares as drafts and the record that a letter was sent. Everything is decided on the server; no month or day of law is
 * written in the interface (`GET /long-rent/rules` has them). Nothing here is sent to the tenant: the person signs and sends the letter.
 */

export type LeaseLetterKind =
  | 'Disdetta'
  | 'PresaAttoRecesso'
  | 'Rinnovo'
  | 'ConfermaEsigenza'
  | 'AggiornamentoIstat'
  | 'OpzioneCedolare'
  | 'Riconsegna'
  | 'RestituzioneCauzione';

export const LEASE_LETTER_MEANS = ['RegisteredMail', 'Pec', 'ByHand', 'Other'] as const;
export type LeaseLetterMeans = (typeof LEASE_LETTER_MEANS)[number];

/**
 * The reasons of the law for which the landlord may deny the renewal at the first expiry (backend `LeaseDisdettaReason`, art. 3 comma 1
 * L. 431/1998, lettere a-g): a closed list.
 */
export type LeaseDisdettaReason =
  | 'OwnUse'
  | 'LegalEntityUse'
  | 'TenantOtherHome'
  | 'DamagedBuilding'
  | 'Renovation'
  | 'TenantAbsent'
  | 'Sale';

export const TENANT_WITHDRAWAL_REASONS = ['GraveMotivi', 'ContractualFaculty'] as const;
export type TenantWithdrawalReason = (typeof TENANT_WITHDRAWAL_REASONS)[number];

export interface LeaseLetterSent {
  on: string;
  means: LeaseLetterMeans;
}

export interface LeaseLetterState {
  kind: LeaseLetterKind;
  approved: boolean;
  sent: LeaseLetterSent | null;
}

/**
 * The notice of non-renewal. `available`: a letter can be prepared. `periodEnd` is the day the lease ends if the notice is given,
 * `lastDayToGiveNotice` the last day by which it is on time (null for a type that does not renew) and `late` says today is after it.
 * `firstPeriod`: the letter must state one of `reasons`; later periods have none.
 */
interface LeaseDisdettaOperation {
  available: boolean;
  firstPeriod: boolean;
  periodEnd: string;
  lastDayToGiveNotice: string | null;
  late: boolean;
  reasons: LeaseDisdettaReason[];
}

interface LeaseWithdrawalRecord {
  receivedOn: string;
  reason: TenantWithdrawalReason;
  effectiveOn: string;
  noticeMonths: number;
}

interface LeaseWithdrawalOperation {
  available: boolean;
  minReceivedOn: string;
  maxReceivedOn: string;
  maxContractualNoticeMonths: number;
  recorded: LeaseWithdrawalRecord | null;
}

interface LeaseRenewalConflict {
  leaseId: string;
  from: string;
  to: string;
}

/** A renewal that was recorded: whether it was agreed on a day (otherwise the standard one) and the period it added. */
interface LeaseRenewalRecord {
  agreed: boolean;
  from: string;
  to: string;
}

interface LeaseRenewalOperation {
  available: boolean;
  opensOn: string;
  startsOn: string;
  standardEnd: string;
  standardMonths: number;
  latestAgreedEnd: string;
  conflict: LeaseRenewalConflict | null;
  recorded: LeaseRenewalRecord | null;
}

interface LeaseTransitoryConfirmation {
  applies: boolean;
  available: boolean;
  holder: 'Landlord' | 'Tenant' | null;
  confirmBy: string;
}

/**
 * The ISTAT update of the rent. `available`: the lease is in force, has a rent and is not under the cedolare secca (which suspends every update),
 * so a calculation and a letter make sense. `currentRent` is the monthly rent today; `defaultSharePercent` the share the window suggests (the
 * contract states the real one) and `maxSharePercent` the most a share can be; the update can start from a day between `minEffectiveOn` (never
 * in the past) and `maxEffectiveOn` (the end of the period).
 */
interface LeaseIstatOperation {
  available: boolean;
  currentRent: number;
  defaultSharePercent: number;
  maxSharePercent: number;
  minEffectiveOn: string;
  maxEffectiveOn: string;
}

/**
 * The communication of the cedolare secca to the tenant. `available`: the lease is in force and under the cedolare secca; the option can be
 * said to apply from a day between `minEffectiveOn` and `maxEffectiveOn`.
 */
interface LeaseCedolareNotice {
  available: boolean;
  minEffectiveOn: string;
  maxEffectiveOn: string;
}

interface LeaseHandoverOperation {
  available: boolean;
  minOn: string;
  maxOn: string;
  suggestedOn: string;
}

interface LeaseDepositRecord {
  returnedOn: string;
  deposit: number;
  interestDue: number;
  deductions: number;
  returned: number;
}

/**
 * The return of the security deposit. `available`: the lease is ending and has a deposit, so the statement can be worked out. `amount` is the
 * deposit; it is taken to have been paid on `paidOn` (the start of the lease) unless the landlord says another day from `minPaidOn`; the return can
 * be dated up to `maxReturnOn` and the window suggests `suggestedReturnOn`; at most `maxDeductions` sums can be kept. `recorded` is the return the
 * landlord recorded last, if any.
 */
interface LeaseDepositOperation {
  available: boolean;
  amount: number;
  paidOn: string;
  minPaidOn: string;
  suggestedReturnOn: string;
  maxReturnOn: string;
  maxDeductions: number;
  recorded: LeaseDepositRecord | null;
}

interface LeaseDepositYear {
  year: number;
  ratePercent: number;
  days: number;
  daysInYear: number;
  interest: number;
}

export interface LeaseDepositDeduction {
  reason: string;
  amount: number;
}

export interface LeaseDepositCalculation {
  deposit: number;
  from: string;
  to: string;
  years: LeaseDepositYear[];
  interest: number;
  interestPaid: number;
  interestDue: number;
  deductions: LeaseDepositDeduction[];
  deductionsTotal: number;
  returned: number;
}

/** The ISTAT update worked out by the server: the rent, the percentages typed, what they make of the rent, the increase and the new rent (to the cent). */
export interface LeaseIstatCalculation {
  currentRent: number;
  foiPercent: number;
  sharePercent: number;
  appliedPercent: number;
  increase: number;
  newRent: number;
}

export interface LeaseOperations {
  disdetta: LeaseDisdettaOperation;
  withdrawal: LeaseWithdrawalOperation;
  letters: LeaseLetterState[];
  renewal: LeaseRenewalOperation;
  transitoryConfirmation: LeaseTransitoryConfirmation;
  istat: LeaseIstatOperation;
  cedolareNotice: LeaseCedolareNotice;
  handover: LeaseHandoverOperation;
  deposit: LeaseDepositOperation;
}

export interface DisdettaLetterInput {
  reason?: LeaseDisdettaReason;
}

export interface TenantWithdrawalInput {
  receivedOn: string;
  reason: TenantWithdrawalReason;
  noticeMonths?: number;
}

/** `POST /leases/:id/renewal`: without a day the standard renewal of the type, otherwise the last day of the extension the parties agreed on. */
export interface RecordLeaseRenewalInput {
  newEnd?: string;
}

export interface RenewalLetterInput {
  startsOn: string;
  endsOn: string;
  agreed?: boolean;
}

/** `POST /leases/:id/istat/calculate`: the variation of the FOI index (percent) and the share of it the contract recognizes (percent). */
export interface IstatCalculationInput {
  foiPercent: number;
  sharePercent: number;
}

/** `POST /leases/:id/letters/aggiornamento-istat`: the same percentages and the day the new rent applies from. */
export interface IstatLetterInput extends IstatCalculationInput {
  effectiveFrom: string;
}

/** `POST /leases/:id/letters/opzione-cedolare`: the first day the option applies from, when the person says it. */
export interface OpzioneCedolareLetterInput {
  effectiveFrom?: string;
}

export interface DepositRate {
  year: number;
  ratePercent: number;
}

export interface DepositReturnInput {
  returnedOn: string;
  depositPaidOn?: string;
  rates: DepositRate[];
  interestPaid?: number;
  deductions: LeaseDepositDeduction[];
}

export interface HandoverLetterInput {
  handoverOn?: string;
}

export interface MarkLetterSentInput {
  sentOn: string;
  means: LeaseLetterMeans;
}
