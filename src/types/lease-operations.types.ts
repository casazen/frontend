/**
 * The operations of a lease in force (LR-OPS-1, `GET /leases/:id/operations`): what the landlord can do about the end of the lease, the
 * letters CasaZen prepares as drafts and the record that a letter was sent. Everything is decided on the server; no month or day of law is
 * written in the interface (`GET /long-rent/rules` has them). Nothing here is sent to the tenant: the person signs and sends the letter.
 */

/** The letters CasaZen prepares (backend `LeaseLetterKind`). A name is never renamed. */
export type LeaseLetterKind =
  | 'Disdetta'
  | 'PresaAttoRecesso'
  | 'Rinnovo'
  | 'ConfermaEsigenza'
  | 'AggiornamentoIstat'
  | 'OpzioneCedolare'
  | 'Riconsegna'
  | 'RestituzioneCauzione';

/** How the person sent a letter (backend `LeaseLetterMeans`). */
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

/** Why the tenant withdraws from the lease (backend `TenantWithdrawalReason`). */
export const TENANT_WITHDRAWAL_REASONS = ['GraveMotivi', 'ContractualFaculty'] as const;
export type TenantWithdrawalReason = (typeof TENANT_WITHDRAWAL_REASONS)[number];

/** The day a letter was marked as sent and how (`YYYY-MM-DD`). */
export interface LeaseLetterSent {
  on: string;
  means: LeaseLetterMeans;
}

/** One letter kind: its text is approved or still a draft (printed with a watermark), and when it was marked as sent. */
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
export interface LeaseDisdettaOperation {
  available: boolean;
  firstPeriod: boolean;
  periodEnd: string;
  lastDayToGiveNotice: string | null;
  late: boolean;
  reasons: LeaseDisdettaReason[];
}

/** A withdrawal of the tenant that was recorded. */
export interface LeaseWithdrawalRecord {
  receivedOn: string;
  reason: TenantWithdrawalReason;
  effectiveOn: string;
  noticeMonths: number;
}

/**
 * The withdrawal of the tenant. `available`: it can be recorded now, with a day received between `minReceivedOn` and `maxReceivedOn`;
 * `maxContractualNoticeMonths` bounds the notice the landlord types when the contract gave the faculty; `recorded` is the one already
 * recorded.
 */
export interface LeaseWithdrawalOperation {
  available: boolean;
  minReceivedOn: string;
  maxReceivedOn: string;
  maxContractualNoticeMonths: number;
  recorded: LeaseWithdrawalRecord | null;
}

/** The other lease of the property that is in the way of a renewal: its id (never a person) and the first and last day it covers. */
export interface LeaseRenewalConflict {
  leaseId: string;
  from: string;
  to: string;
}

/** A renewal that was recorded: whether it was agreed on a day (otherwise the standard one) and the period it added. */
export interface LeaseRenewalRecord {
  agreed: boolean;
  from: string;
  to: string;
}

/**
 * The renewal of the lease. `available`: it can be recorded now, from `opensOn` (the last day to give notice) to the end of the period;
 * recording one moves the end forward and closes the window until the next period's. The standard renewal runs from `startsOn` to
 * `standardEnd` (`standardMonths` months, the rules'); an extension the parties agreed on ends on any later day up to `latestAgreedEnd`.
 * `conflict` is the lease that already covers days of the standard renewal (the server would refuse it with 409 `lease_period_overlaps`);
 * `recorded` is the renewal of the period the lease is in now.
 */
export interface LeaseRenewalOperation {
  available: boolean;
  opensOn: string;
  startsOn: string;
  standardEnd: string;
  standardMonths: number;
  latestAgreedEnd: string;
  conflict: LeaseRenewalConflict | null;
  recorded: LeaseRenewalRecord | null;
}

/**
 * The confirmation of the need of a transitory lease. `applies`: it is a transitory lease in force and the need is confirmed in writing
 * before the end (`confirmBy`, its last day). `available`: the need is the landlord's, so CasaZen prepares the letter; `holder` says whose
 * the need is, or `null` when the contract does not say.
 */
export interface LeaseTransitoryConfirmation {
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
export interface LeaseIstatOperation {
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
export interface LeaseCedolareNotice {
  available: boolean;
  minEffectiveOn: string;
  maxEffectiveOn: string;
}

/**
 * The handover of the property at the end of the lease. `available`: the lease is ending (a notice is recorded, it was ended early, or it is of
 * a type that ends by itself), so the minutes can be prepared; they can be dated from `minOn` to `maxOn`, and the window suggests
 * `suggestedOn`, the last day of the lease.
 */
export interface LeaseHandoverOperation {
  available: boolean;
  minOn: string;
  maxOn: string;
  suggestedOn: string;
}

/** A return of the deposit the landlord recorded: the day, the deposit, the interest that was due, the sums kept and what was returned (euros). */
export interface LeaseDepositRecord {
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
export interface LeaseDepositOperation {
  available: boolean;
  amount: number;
  paidOn: string;
  minPaidOn: string;
  suggestedReturnOn: string;
  maxReturnOn: string;
  maxDeductions: number;
  recorded: LeaseDepositRecord | null;
}

/** The interest of one calendar year of the statement: the rate, the days the deposit was held in it, the days of the year and the interest. */
export interface LeaseDepositYear {
  year: number;
  ratePercent: number;
  days: number;
  daysInYear: number;
  interest: number;
}

/** A sum kept from the deposit and why. */
export interface LeaseDepositDeduction {
  reason: string;
  amount: number;
}

/** The statement of the return of the deposit worked out by the server (euros to the cent). */
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

/** `POST /leases/:id/letters/disdetta`: the reason of the law, required at the first expiry. */
export interface DisdettaLetterInput {
  reason?: LeaseDisdettaReason;
}

/** `POST /leases/:id/withdrawal` and `POST /leases/:id/letters/presa-atto-recesso`: the day the withdrawal was received, why, and the contract's notice. */
export interface TenantWithdrawalInput {
  receivedOn: string;
  reason: TenantWithdrawalReason;
  /** Only when the contract gave the faculty (1 to `maxContractualNoticeMonths`); for serious reasons the rules' months apply whatever is sent. */
  noticeMonths?: number;
}

/** `POST /leases/:id/renewal`: without a day the standard renewal of the type, otherwise the last day of the extension the parties agreed on. */
export interface RecordLeaseRenewalInput {
  newEnd?: string;
}

/** `POST /leases/:id/letters/rinnovo`: the period the agreement adds (first and last day) and whether it is an extension agreed on a day. */
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

/** The legal interest rate, in percent per year, of one calendar year the deposit was held. */
export interface DepositRate {
  year: number;
  ratePercent: number;
}

/**
 * `POST /leases/:id/deposit/calculate`, `/letters/restituzione-cauzione` and `/deposit/return`: the day the deposit is returned, the day it was paid
 * (the start of the lease when left out), the rate of every calendar year it was held, the interest already paid to the tenant and the sums kept.
 */
export interface DepositReturnInput {
  returnedOn: string;
  depositPaidOn?: string;
  rates: DepositRate[];
  interestPaid?: number;
  deductions: LeaseDepositDeduction[];
}

/** `POST /leases/:id/letters/riconsegna`: the day of the handover, when the person says it. */
export interface HandoverLetterInput {
  handoverOn?: string;
}

/** `POST /leases/:id/letters/:kind/sent`. */
export interface MarkLetterSentInput {
  sentOn: string;
  means: LeaseLetterMeans;
}
