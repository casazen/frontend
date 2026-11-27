import type { LeaseNoticeParty } from './lease.types';

/**
 * What the landlord does about the life of a lease (LR-10): the notice of non-renewal, the early termination and the erasure of the
 * personal data of its parties. The answers of the notice and the termination are the lease detail itself (`LeaseDetail`, where
 * `currentTermEndDate`, `noticeOn`, `noticeFrom`, `terminatedOn` and `noticeWarning` say where the lease stands now).
 */

export interface RecordLeaseNoticeInput {
  from: LeaseNoticeParty;
  on: string;
}

export interface TerminateLeaseInput {
  on: string;
}

export type LeaseErasureStatus = 'Anonymized' | 'PartiallyAnonymized' | 'Scheduled';

/** `POST /leases/:id/erasure-request`: idempotent, the answer says what was done and what waits. */
export interface LeaseErasureResult {
  status: LeaseErasureStatus;
  /** For a lease that has not ended: the day from which its parties are anonymized (a date, or a UTC midnight); null otherwise. */
  anonymizationFrom: string | null;
  /** The parties not anonymized yet because they are also parties of another lease that has not ended. */
  partiesKept: number;
}
