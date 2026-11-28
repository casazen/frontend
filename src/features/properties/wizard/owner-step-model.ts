import type { OwnerReadinessReport } from '@/types/owner-onboarding.types';

export function propertyHasOwner(report: OwnerReadinessReport, propertyId: string): boolean {
  const incompleteOwnership = report.properties.some((property) => property.propertyId === propertyId && !property.ownershipReady);
  return !report.truncated && report.summary.properties === 1 && report.summary.owners > 0 && !incompleteOwnership;
}
