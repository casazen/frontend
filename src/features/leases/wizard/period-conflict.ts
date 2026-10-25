import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type { LeasePeriodConflict } from '@/types';

/**
 * Two leases of one property cannot cover the same days (backend LR-OVERLAP). The code of the review check that says so, and the code of
 * the 409 of the steps that make a lease a contract (confirming the review, handing it out for signature, importing or signing it).
 */
export const PERIOD_CONFLICT_CHECK = 'lease_overlap';
const PERIOD_CONFLICT_ERROR = 'lease_period_overlaps';

/** The sheet of a lease, a draft too (it leads back to the wizard). */
export function conflictingLeasePath(leaseId: string): string {
  return `/app/long-rent/leases/${leaseId}`;
}

/** The other lease named by a 409 `lease_period_overlaps` (its id and days, never a name), or `null` for any other error. */
export function periodConflictOf(error: unknown): LeasePeriodConflict | null {
  if (!isAxiosError(error) || getProblemCode(error.response?.data) !== PERIOD_CONFLICT_ERROR) return null;
  const data = error.response?.data as Record<string, unknown>;
  const { conflictingLeaseId, conflictingFrom, conflictingTo } = data;
  return typeof conflictingLeaseId === 'string' && typeof conflictingFrom === 'string' && typeof conflictingTo === 'string'
    ? { conflictingLeaseId, conflictingFrom, conflictingTo }
    : null;
}
