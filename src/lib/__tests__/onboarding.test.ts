import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import {
  getHomeRouteForRentalType,
  getHomeRouteForUser,
  getPostOnboardingRoute,
  isExemptFromHostOnboarding,
  isProfileLoadFailure,
  needsOnboarding,
  needsOrgSetup,
  canEditOnboarding,
} from '../onboarding';

function httpError(status: number): AxiosError {
  return new AxiosError('request failed', 'ERR_BAD_RESPONSE', undefined, undefined, {
    status,
    data: {},
  } as AxiosResponse);
}

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
    expect(needsOnboarding({ roles: ['PropertyOwner'] }, { orgId: null })).toBe(true);
    expect(needsOnboarding({ roles: ['LongTermLandlord'] }, { orgId: null, onboardingCompletedAt: null })).toBe(true);
  });

  it('needsOnboarding_AdminWithoutOrg_ReturnsFalse (A1-01)', () => {
    expect(needsOnboarding({ roles: ['Admin'] }, { orgId: null })).toBe(false);
    expect(needsOnboarding({ roles: ['Admin'] }, null)).toBe(false);
    expect(needsOnboarding({ roles: ['Admin', 'PropertyOwner'] }, { orgId: null })).toBe(false);
  });

  it('needsOnboarding_SupplierOnlyWithoutOrg_ReturnsFalse', () => {
    expect(needsOnboarding({ roles: ['Supplier'] }, { orgId: null })).toBe(false);
    // A supplier who is also a host needs the host org.
    expect(needsOnboarding({ roles: ['Supplier', 'PropertyOwner'] }, { orgId: null })).toBe(true);
  });

  it('isExemptFromHostOnboarding_OnlyAdminsAndSupplierOnlyUsers', () => {
    expect(isExemptFromHostOnboarding(['Admin'])).toBe(true);
    expect(isExemptFromHostOnboarding(['Supplier'])).toBe(true);
    expect(isExemptFromHostOnboarding(['Supplier', 'LongTermLandlord'])).toBe(false);
    expect(isExemptFromHostOnboarding(['PropertyOwner'])).toBe(false);
    expect(isExemptFromHostOnboarding([])).toBe(false);
  });

  it('detects onboarding completion via timestamp (#277)', () => {
    // With onboardingCompletedAt, user never needs onboarding (immutable)
    expect(
      needsOnboarding({ roles: [] }, { orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z' })
    ).toBe(false);
    // Without timestamp, falls back to role + org check
    expect(needsOnboarding({ roles: [] }, { orgId: null, onboardingCompletedAt: null })).toBe(true);
  });

  it('requires org backfill when onboardingCompletedAt set but org missing (#285), except for admins', () => {
    expect(
      needsOnboarding(
        { roles: ['PropertyOwner'] },
        { orgId: null, onboardingCompletedAt: '2026-06-16T12:00:00Z' },
      ),
    ).toBe(true);
    expect(
      needsOnboarding(
        { roles: ['Admin'] },
        { orgId: null, onboardingCompletedAt: '2026-06-16T12:00:00Z' },
      ),
    ).toBe(false);
  });

  it('getPostOnboardingRoute_ReturnsOriginOnlyWithinTheChosenContexts', () => {
    expect(getPostOnboardingRoute('ShortTerm', '/app/short-rent/properties?tab=1')).toBe('/app/short-rent/properties?tab=1');
    expect(getPostOnboardingRoute('Both', '/app/long-rent/leases/42')).toBe('/app/long-rent/leases/42');
    expect(getPostOnboardingRoute('LongTerm', '/app/short-rent/properties')).toBe('/app/long-rent/leases');
    expect(getPostOnboardingRoute('ShortTerm', '/app/short-rentals-elsewhere')).toBe('/app/short-rent');
    expect(getPostOnboardingRoute('ShortTerm', '/app/admin')).toBe('/app/short-rent');
    expect(getPostOnboardingRoute('LongTerm', null)).toBe('/app/long-rent/leases');
  });

  it('isProfileLoadFailure_TransientErrorsYes_NotFoundNo (A1-19)', () => {
    expect(isProfileLoadFailure(httpError(503))).toBe(true);
    expect(isProfileLoadFailure(httpError(500))).toBe(true);
    expect(isProfileLoadFailure(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toBe(true);
    expect(isProfileLoadFailure(httpError(401))).toBe(true);
    expect(isProfileLoadFailure(httpError(404))).toBe(false);
    expect(isProfileLoadFailure(null)).toBe(false);
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
    expect(getHomeRouteForUser({ roles: ['Supplier'] })).toBe('/supplier/inbox');
  });
});
