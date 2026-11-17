import type { OwnerReadinessReport } from '@/types/owner-onboarding.types';

/** The readiness API lists properties needing attention; omission means ready only in a complete report. */
export function propertyHasOwner(report: OwnerReadinessReport, propertyId: string): boolean {
  return !report.truncated && report.summary.properties === 1 && report.summary.owners > 0 && !report.properties.some((property) => property.propertyId === propertyId && !property.ownershipReady);
}

