import type { LeaseNoticeParty } from './lease.types';

/**
 * What the landlord does about the life of a lease (LR-10): the notice of non-renewal, the early termination and the erasure of the
 * personal data of its parties. The answers of the notice and the termination are the lease detail itself (`LeaseDetail`, where
 * `currentTermEndDate`, `noticeOn`, `noticeFrom`, `terminatedOn` and `noticeWarning` say where the lease stands now).
 */

/** `POST /leases/:id/notice`: who gave the notice and the day (`YYYY-MM-DD`, from the start of the lease up to today). */
export interface RecordLeaseNoticeInput {
  from: LeaseNoticeParty;
  on: string;
}

/** `POST /leases/:id/terminate`: the last day of the lease (`YYYY-MM-DD`, from its start up to the end of the period it is in). */
export interface TerminateLeaseInput {
  on: string;
}

/** Where an erasure request of a lease stands (backend `LeaseErasureStatus`). */
export type LeaseErasureStatus = 'Anonymized' | 'PartiallyAnonymized' | 'Scheduled';

/** `POST /leases/:id/erasure-request`: idempotent, the answer says what was done and what waits. */
export interface LeaseErasureResult {
  status: LeaseErasureStatus;
  /** For a lease that has not ended: the day from which its parties are anonymized (a date, or a UTC midnight); null otherwise. */
  anonymizationFrom: string | null;
  /** The parties not anonymized yet because they are also parties of another lease that has not ended. */
  partiesKept: number;
}
