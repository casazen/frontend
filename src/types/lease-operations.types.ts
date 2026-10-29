/**
 * The operations of a lease in force (LR-OPS-1, `GET /leases/:id/operations`): what the landlord can do about the end of the lease, the
 * letters CasaZen prepares as drafts and the record that a letter was sent. Everything is decided on the server; no month or day of law is
 * written in the interface (`GET /long-rent/rules` has them). Nothing here is sent to the tenant: the person signs and sends the letter.
 */

/** The letters CasaZen prepares (backend `LeaseLetterKind`). A name is never renamed. */
export type LeaseLetterKind = 'Disdetta' | 'PresaAttoRecesso';

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

export interface LeaseOperations {
  disdetta: LeaseDisdettaOperation;
  withdrawal: LeaseWithdrawalOperation;
  letters: LeaseLetterState[];
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

/** `POST /leases/:id/letters/:kind/sent`. */
export interface MarkLetterSentInput {
  sentOn: string;
  means: LeaseLetterMeans;
}
