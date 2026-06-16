import { describe, expect, it } from 'vitest';
import { getHomeRouteForRentalType, getHomeRouteForUser, needsOnboarding, needsOrgSetup, canEditOnboarding } from '../onboarding';

describe('onboarding helpers', () => {
  it('maps rental types to home routes', () => {
    expect(getHomeRouteForRentalType('ShortTerm')).toBe('/app/short-rent');
    expect(getHomeRouteForRentalType('LongTerm')).toBe('/app/long-rent/leases');
    expect(getHomeRouteForRentalType('Both')).toBe('/app/short-rent');
  });

  it('detects org setup requirement from profile', () => {
    expect(needsOrgSetup(null)).toBe(true);
    expect(needsOrgSetup({ orgId: null })).toBe(true);
    expect(needsOrgSetup({ orgId: 'org-1' })).toBe(false);
  });

  it('detects onboarding requirement from JWT roles and org', () => {
    expect(needsOnboarding({ roles: [] })).toBe(true);
    expect(needsOnboarding({ roles: ['PropertyOwner'] }, { orgId: 'org-1' })).toBe(false);
    expect(needsOnboarding({ roles: ['Admin'] }, { orgId: 'org-1' })).toBe(false);
    expect(needsOnboarding({ roles: ['Admin'] }, { orgId: null })).toBe(true);
    expect(needsOnboarding({ roles: ['PropertyOwner'] }, { orgId: null })).toBe(true);
  });

  it('detects onboarding completion via timestamp (#277)', () => {
    // With onboardingCompletedAt, user never needs onboarding (immutable)
    expect(
      needsOnboarding({ roles: [] }, { orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z' })
    ).toBe(false);
    // Without timestamp, falls back to role + org check
    expect(needsOnboarding({ roles: [] }, { orgId: null, onboardingCompletedAt: null })).toBe(true);
  });

  it('canEditOnboarding requires both timestamp and orgId', () => {
    // No profile = cannot edit
    expect(canEditOnboarding(null)).toBe(false);
    // No timestamp = cannot edit
    expect(canEditOnboarding({ orgId: 'org-1', onboardingCompletedAt: null })).toBe(false);
    // No orgId = cannot edit
    expect(canEditOnboarding({ orgId: null, onboardingCompletedAt: '2026-06-16T12:00:00Z' })).toBe(false);
    // Both present = can edit
    expect(canEditOnboarding({ orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z' })).toBe(true);
  });

  it('resolves home route for user roles', () => {
    expect(getHomeRouteForUser({ roles: ['LongTermLandlord'] })).toBe('/app/long-rent/leases');
    expect(getHomeRouteForUser({ roles: ['PropertyOwner', 'LongTermLandlord'] })).toBe('/app/short-rent');
    expect(getHomeRouteForUser({ roles: ['Admin'] })).toBe('/app/admin');
  });
});
