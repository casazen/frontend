import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type { LeasePeriodConflict } from '@/types';

export const PERIOD_CONFLICT_CHECK = 'lease_overlap';
const PERIOD_CONFLICT_ERROR = 'lease_period_overlaps';

export function conflictingLeasePath(leaseId: string): string {
  return `/app/long-rent/leases/${leaseId}`;
}

export function periodConflictOf(error: unknown): LeasePeriodConflict | null {
  if (!isAxiosError(error) || getProblemCode(error.response?.data) !== PERIOD_CONFLICT_ERROR) return null;
  const data = error.response?.data as Record<string, unknown>;
  const { conflictingLeaseId, conflictingFrom, conflictingTo } = data;
  return typeof conflictingLeaseId === 'string' && typeof conflictingFrom === 'string' && typeof conflictingTo === 'string'
    ? { conflictingLeaseId, conflictingFrom, conflictingTo }
    : null;
}
