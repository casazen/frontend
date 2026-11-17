import { describe, expect, it } from 'vitest';
import type { OwnerReadinessReport } from '@/types/owner-onboarding.types';
import { propertyHasOwner } from '../owner-step-model';

const report = { summary: { owners: 1, properties: 1 }, properties: [], truncated: false } as unknown as OwnerReadinessReport;

describe('property owner completion', () => {
  it('accepts a complete readiness report with no outstanding issue for this property', () => {
    expect(propertyHasOwner(report, 'p1')).toBe(true);
  });
  it('blocks missing or incomplete ownership and does not confuse another property', () => {
    const missing = { ...report, properties: [{ propertyId: 'p1', ownershipReady: false }] } as OwnerReadinessReport;
    expect(propertyHasOwner(missing, 'p1')).toBe(false);
    expect(propertyHasOwner(missing, 'p2')).toBe(true);
    expect(propertyHasOwner({ ...report, summary: { ...report.summary, owners: 0 } }, 'p1')).toBe(false);
  });
  it('never assumes an omitted property is ready when the report is truncated', () => {
    expect(propertyHasOwner({ ...report, truncated: true }, 'p1')).toBe(false);
  });
});
