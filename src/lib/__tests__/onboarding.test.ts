import { describe, expect, it } from 'vitest';
import { getHomeRouteForRentalType, getHomeRouteForUser, needsOnboarding } from '../onboarding';

describe('onboarding helpers', () => {
  it('maps rental types to home routes', () => {
    expect(getHomeRouteForRentalType('ShortTerm')).toBe('/app/short-rent');
    expect(getHomeRouteForRentalType('LongTerm')).toBe('/app/long-rent/leases');
    expect(getHomeRouteForRentalType('Both')).toBe('/app/short-rent');
  });

  it('detects onboarding requirement from JWT roles', () => {
    expect(needsOnboarding({ roles: [] })).toBe(true);
    expect(needsOnboarding({ roles: ['PropertyOwner'] })).toBe(false);
    expect(needsOnboarding({ roles: ['Admin'] })).toBe(false);
  });

  it('resolves home route for user roles', () => {
    expect(getHomeRouteForUser({ roles: ['LongTermLandlord'] })).toBe('/app/long-rent/leases');
    expect(getHomeRouteForUser({ roles: ['PropertyOwner', 'LongTermLandlord'] })).toBe('/app/short-rent');
    expect(getHomeRouteForUser({ roles: ['Admin'] })).toBe('/app/admin');
  });
});
