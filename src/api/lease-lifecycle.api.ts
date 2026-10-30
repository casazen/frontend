import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  LeaseDetail,
  LeaseErasureResult,
  LeaseErasureStatus,
  RecordLeaseNoticeInput,
  RecordLeaseRenewalInput,
  TenantWithdrawalInput,
  TerminateLeaseInput,
} from '@/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErasureStatus(value: unknown): value is LeaseErasureStatus {
  return value === 'Anonymized' || value === 'PartiallyAnonymized' || value === 'Scheduled';
}

/** The notice and the termination answer with the detail of the lease; anything else (an HTML fallback, an envelope) is not an answer. */
function expectLease(data: unknown, url: string): LeaseDetail {
  if (!isRecord(data) || typeof data.id !== 'string') throw new UnexpectedApiResponseError(url);
  return data as unknown as LeaseDetail;
}

/**
 * What the landlord does about the life of a lease (LR-10): the draft deleted, the download for the signature taken back, the notice
 * of non-renewal given and withdrawn, the early termination and the erasure of the data of the parties. All of them need `lease.create`
 * on the property of the lease, and none writes to a tenant: no e-mail, no message. The rules and the error codes are in the
 * runbooks of the backend (`long-rent-lease-draft.md` § 6-7, `long-rent-aggregates.md` § 10, `gdpr.md` § 7).
 */
export const leaseLifecycleApi = {
  /** Deletes a draft with everything tied to it. 409 `lease_not_deletable` for a lease that is not a draft, or has a signed copy or a rent plan. */
  deleteDraft: async (id: string): Promise<void> => {
    await ApiClient.delete<unknown>(`/leases/${id}`);
  },

  /** The contract was downloaded for the signature on paper. 422 while the review is not confirmed or the template is not approved. */
  markSent: async (id: string): Promise<void> => {
    await ApiClient.post<unknown>(`/leases/${id}/sent`);
  },

  /** Takes the download for the signature back: the lease is a draft in review again. */
  revokeSent: async (id: string): Promise<void> => {
    await ApiClient.delete<unknown>(`/leases/${id}/sent`);
  },

  /**
   * Records the notice of non-renewal given by the landlord or the tenant: the lease ends with its current period instead of renewing by
   * itself. 422 `lease_type_has_no_renewal`, `lease_notice_date_invalid`; 409 `lease_not_in_force`, `lease_notice_already_recorded`,
   * `lease_already_terminated`, `lease_busy`.
   */
  recordNotice: async (id: string, input: RecordLeaseNoticeInput): Promise<LeaseDetail> =>
    expectLease(await ApiClient.post<unknown>(`/leases/${id}/notice`, input), '/leases/:id/notice'),

  /** Takes the notice back, only while the current period has not ended (409 `lease_term_already_ended` after). */
  removeNotice: async (id: string): Promise<LeaseDetail> =>
    expectLease(await ApiClient.delete<unknown>(`/leases/${id}/notice`), '/leases/:id/notice'),

  /**
   * Ends the lease on its last day. **Irreversible.** 422 `lease_termination_date_invalid`; 409 `lease_not_in_force`,
   * `lease_already_terminated`, `lease_busy`.
   */
  terminate: async (id: string, input: TerminateLeaseInput): Promise<LeaseDetail> =>
    expectLease(await ApiClient.post<unknown>(`/leases/${id}/terminate`, input), '/leases/:id/terminate'),

  /**
   * Records the withdrawal the tenant sent and ends the lease on the day its notice runs out (LR-OPS-1): the day received plus the months of
   * notice, through the same rules as the early termination. **Irreversible.** 422 `lease_withdrawal_date_invalid`,
   * `lease_withdrawal_notice_invalid`, `lease_termination_date_invalid`; 409 `lease_not_in_force`, `lease_already_terminated`, `lease_busy`.
   */
  recordWithdrawal: async (id: string, input: TenantWithdrawalInput): Promise<LeaseDetail> =>
    expectLease(await ApiClient.post<unknown>(`/leases/${id}/withdrawal`, input), '/leases/:id/withdrawal'),

  /**
   * Records the renewal of the lease before the end of its period (LR-OPS-1): the standard one of the type or, with `newEnd`, an extension to
   * the day the parties agreed on; the rent plan is extended and nothing is written to the tenant. 409 `lease_period_overlaps`,
   * `lease_renewal_blocked_by_notice`, `lease_renewal_period_over`, `lease_not_in_force`, `lease_already_terminated`, `lease_busy`; 422
   * `lease_renewal_not_yet`, `lease_renewal_end_invalid`, `lease_type_has_no_renewal`.
   */
  recordRenewal: async (id: string, input: RecordLeaseRenewalInput): Promise<LeaseDetail> =>
    expectLease(await ApiClient.post<unknown>(`/leases/${id}/renewal`, input), '/leases/:id/renewal'),

  /** Records the erasure request of the parties (art. 17 GDPR). Idempotent: asking again answers where the first request stands. */
  requestErasure: async (id: string): Promise<LeaseErasureResult> => {
    const data = await ApiClient.post<unknown>(`/leases/${id}/erasure-request`);
    if (!isRecord(data) || !isErasureStatus(data.status)) throw new UnexpectedApiResponseError('/leases/:id/erasure-request');
    return {
      status: data.status,
      anonymizationFrom: typeof data.anonymizationFrom === 'string' ? data.anonymizationFrom : null,
      partiesKept: typeof data.partiesKept === 'number' ? data.partiesKept : 0,
    };
  },
};
