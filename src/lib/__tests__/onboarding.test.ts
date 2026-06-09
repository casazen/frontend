import { describe, expect, it } from 'vitest';
import { getHomeRouteForRentalType, getHomeRouteForUser, needsOnboarding, needsOrgSetup } from '../onboarding';

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

  it('resolves home route for user roles', () => {
    expect(getHomeRouteForUser({ roles: ['LongTermLandlord'] })).toBe('/app/long-rent/leases');
    expect(getHomeRouteForUser({ roles: ['PropertyOwner', 'LongTermLandlord'] })).toBe('/app/short-rent');
    expect(getHomeRouteForUser({ roles: ['Admin'] })).toBe('/app/admin');
  });
});
