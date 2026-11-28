import { describe, expect, it } from 'vitest';
import { AxiosError, type AxiosResponse } from 'axios';
import {
  getHomeRouteForRentalType,
  getHomeRouteForUser,
  getPlanPageForRentalType,
  getProfilePageForRentalType,
  getFirstPropertyRoute,
  getPostOnboardingRoute,
  getStaleConsentDocuments,
  isExemptFromHostOnboarding,
  isLinkedSupplier,
  isProfileLoadFailure,
  lacksCurrentConsents,
  needsConsentRenewal,
  needsFirstProperty,
  needsOnboarding,
  needsOrgSetup,
  canEditOnboarding,
  getRentalTypeOfHostSetUpByServer,
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
    expect(getHomeRouteForRentalType('LongTerm')).toBe('/app/long-rent');
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
    expect(needsOnboarding({ roles: ['Supplier', 'PropertyOwner'] }, { orgId: null })).toBe(true);
  });

  it('needsOnboarding_BackendSaysOnboardingRequired_ReturnsTrueForHosts (PL-02)', () => {
    const legacyHost = { orgId: 'org-1', onboardingCompletedAt: null, onboardingRequired: true };
    expect(needsOnboarding({ roles: ['PropertyOwner'] }, legacyHost)).toBe(true);
    const staleConsents = { orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z', onboardingRequired: true };
    expect(needsOnboarding({ roles: ['PropertyOwner'] }, staleConsents)).toBe(true);
    expect(needsOnboarding({ roles: ['Admin'] }, legacyHost)).toBe(false);
    expect(needsOnboarding({ roles: ['Supplier'] }, legacyHost)).toBe(false);
    const done = { orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z', onboardingRequired: false };
    expect(needsOnboarding({ roles: ['PropertyOwner'] }, done)).toBe(false);
  });

  it('needsConsentRenewal_OnlyForACompletedOnboardingWithOldConsents (PL-02)', () => {
    const onboarded = { orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z', rentalType: 'ShortTerm' as const };
    expect(needsConsentRenewal({ ...onboarded, consentsAccepted: false })).toBe(true);
    expect(needsConsentRenewal({ ...onboarded, consentsAccepted: true })).toBe(false);
    expect(needsConsentRenewal(onboarded)).toBe(false);
    expect(needsConsentRenewal({ ...onboarded, onboardingCompletedAt: null, consentsAccepted: false })).toBe(false);
    expect(needsConsentRenewal({ ...onboarded, orgId: null, consentsAccepted: false })).toBe(false);
    expect(needsConsentRenewal(null)).toBe(false);
  });

  it('lacksCurrentConsents_WithOrgAndCompletedOnboarding_IgnoresTheRentalType', () => {
    const noType = { orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z', rentalType: null };
    expect(lacksCurrentConsents({ ...noType, consentsAccepted: false })).toBe(true);
    expect(needsConsentRenewal({ ...noType, consentsAccepted: false })).toBe(false);
    expect(lacksCurrentConsents({ ...noType, consentsAccepted: true })).toBe(false);
    expect(lacksCurrentConsents(noType)).toBe(false);
    expect(lacksCurrentConsents({ ...noType, orgId: null, consentsAccepted: false })).toBe(false);
    expect(lacksCurrentConsents({ ...noType, onboardingCompletedAt: null, consentsAccepted: false })).toBe(false);
    expect(lacksCurrentConsents(null)).toBe(false);
  });

  it('isExemptFromHostOnboarding_OnlyAdminsAndSupplierOnlyUsers', () => {
    expect(isExemptFromHostOnboarding(['Admin'])).toBe(true);
    expect(isExemptFromHostOnboarding(['Supplier'])).toBe(true);
    expect(isExemptFromHostOnboarding(['Supplier', 'LongTermLandlord'])).toBe(false);
    expect(isExemptFromHostOnboarding(['PropertyOwner'])).toBe(false);
    expect(isExemptFromHostOnboarding([])).toBe(false);
  });

  it('detects onboarding completion via timestamp (#277)', () => {
    expect(
      needsOnboarding({ roles: [] }, { orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z' })
    ).toBe(false);
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
    expect(getPostOnboardingRoute('LongTerm', '/app/short-rent/properties')).toBe('/app/long-rent');
    expect(getPostOnboardingRoute('ShortTerm', '/app/short-rentals-elsewhere')).toBe('/app/short-rent');
    expect(getPostOnboardingRoute('ShortTerm', '/app/admin')).toBe('/app/short-rent');
    expect(getPostOnboardingRoute('LongTerm', null)).toBe('/app/long-rent');
  });

  it('getPostOnboardingRoute_FirstRunOpensTheFirstPropertyUnlessAGuardSentTheUserToADeepPage', () => {
    expect(getPostOnboardingRoute('ShortTerm', '/app/short-rent/bookings/42', { firstRun: true, guidedSetup: true })).toBe('/app/short-rent/onboarding');
    expect(getPostOnboardingRoute('Both', null, { firstRun: true, guidedSetup: true })).toBe('/app/short-rent/onboarding');
    expect(getPostOnboardingRoute('LongTerm', null, { firstRun: true, guidedSetup: true })).toBe('/app/long-rent/properties/new?first=1');
    expect(getPostOnboardingRoute('ShortTerm', null, { firstRun: true })).toBe('/app/short-rent/properties/create?first=1');
    expect(getPostOnboardingRoute('LongTerm', null, { firstRun: true })).toBe('/app/long-rent/properties/new?first=1');
    expect(getPostOnboardingRoute('Both', null, { firstRun: true })).toBe('/app/short-rent/properties/create?first=1');
    expect(getPostOnboardingRoute('ShortTerm', '/app/short-rent', { firstRun: true })).toBe('/app/short-rent/properties/create?first=1');
    expect(getPostOnboardingRoute('ShortTerm', '/app/short-rent/bookings/42', { firstRun: true })).toBe('/app/short-rent/bookings/42');
    expect(getPostOnboardingRoute('ShortTerm', '/app/short-rent', { firstRun: false })).toBe('/app/short-rent');
    expect(getFirstPropertyRoute('LongTerm')).toBe('/app/long-rent/properties/new?first=1');
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
    expect(canEditOnboarding(null)).toBe(false);
    expect(canEditOnboarding({ orgId: 'org-1', onboardingCompletedAt: null })).toBe(false);
    expect(canEditOnboarding({ orgId: null, onboardingCompletedAt: '2026-06-16T12:00:00Z' })).toBe(false);
    expect(canEditOnboarding({ orgId: 'org-1', onboardingCompletedAt: '2026-06-16T12:00:00Z' })).toBe(true);
  });

  it('resolves home route for user roles', () => {
    expect(getHomeRouteForUser({ roles: ['LongTermLandlord'] })).toBe('/app/long-rent');
    expect(getHomeRouteForUser({ roles: ['PropertyOwner', 'LongTermLandlord'] })).toBe('/app/short-rent');
    expect(getHomeRouteForUser({ roles: ['Admin'] })).toBe('/app/admin');
    expect(getHomeRouteForUser({ roles: ['Supplier'] })).toBe('/app/supplier/activation');
  });

  it('getHomeRouteForUser_LinkedSupplierWithoutRoleInToken_ReturnsSupplierConsole', () => {
    expect(getHomeRouteForUser({ roles: [] }, { orgId: 's-1', supplierOrgId: 's-1' })).toBe('/app/supplier/activation');
    expect(getHomeRouteForUser({ roles: ['PropertyOwner'] }, { orgId: 'h-1', supplierOrgId: 's-1' })).toBe(
      '/app/short-rent',
    );
  });

  it('needsOnboarding_LinkedSupplier_NeverSendsToHostOnboarding', () => {
    expect(isLinkedSupplier({ supplierOrgId: 's-1' })).toBe(true);
    expect(isLinkedSupplier({ supplierOrgId: null })).toBe(false);
    expect(needsOnboarding({}, { orgId: 's-1', supplierOrgId: 's-1', onboardingCompletedAt: null }, [])).toBe(false);
    expect(needsOnboarding({}, { orgId: null, supplierOrgId: null, onboardingCompletedAt: null }, [])).toBe(true);
  });
});

describe('operator type edit and stale consents (PL-06)', () => {
  function errorWith(status: number, data: unknown): AxiosError {
    return new AxiosError('request failed', 'ERR_BAD_REQUEST', undefined, undefined, {
      status,
      data,
    } as AxiosResponse);
  }

  it('getPlanPageForRentalType_EachRentalType_ReturnsThePlanPageOfItsContext', () => {
    expect(getPlanPageForRentalType('ShortTerm')).toBe('/app/short-rent/settings/plan');
    expect(getPlanPageForRentalType('Both')).toBe('/app/short-rent/settings/plan');
    expect(getPlanPageForRentalType('LongTerm')).toBe('/app/long-rent/settings/plan');
  });

  it('getProfilePageForRentalType_EachRentalType_ReturnsTheProfileOfItsContext', () => {
    expect(getProfilePageForRentalType('ShortTerm')).toBe('/app/short-rent/profile');
    expect(getProfilePageForRentalType('Both')).toBe('/app/short-rent/profile');
    expect(getProfilePageForRentalType('LongTerm')).toBe('/app/long-rent/profile');
  });

  it('getStaleConsentDocuments_BadRequestWithStaleDocuments_ReturnsTheDocuments', () => {
    const error = errorWith(400, { error: 'Documenti aggiornati.', staleDocuments: ['tos', 'subprocessors'] });

    expect(getStaleConsentDocuments(error)).toEqual(['tos', 'subprocessors']);
  });

  it('getStaleConsentDocuments_OtherErrors_ReturnsNull', () => {
    expect(getStaleConsentDocuments(errorWith(400, { error: 'Tutti i consensi obbligatori devono essere accettati.' }))).toBeNull();
    expect(getStaleConsentDocuments(errorWith(400, { staleDocuments: [] }))).toBeNull();
    expect(getStaleConsentDocuments(errorWith(400, { staleDocuments: 'tos' }))).toBeNull();
    expect(getStaleConsentDocuments(errorWith(422, { staleDocuments: ['tos'] }))).toBeNull();
    expect(getStaleConsentDocuments(errorWith(400, null))).toBeNull();
    expect(getStaleConsentDocuments(new Error('network'))).toBeNull();
  });
});

describe('first property pending', () => {
  const onboarded = {
    orgId: 'org-1',
    onboardingCompletedAt: '2026-06-16T12:00:00Z',
    rentalType: 'ShortTerm' as const,
    onboardingRequired: false,
    consentsAccepted: true,
  };
  const host = { roles: ['PropertyOwner'] };
  const home = '/app/short-rent';

  it('needsFirstProperty_OnboardedHostWithoutProperties_ReturnsTrue', () => {
    expect(needsFirstProperty(host, { ...onboarded, hasProperties: false }, undefined, home)).toBe(true);
  });

  it('needsFirstProperty_HasPropertiesOrFieldMissing_ReturnsFalse', () => {
    expect(needsFirstProperty(host, { ...onboarded, hasProperties: true }, undefined, home)).toBe(false);
    expect(needsFirstProperty(host, { ...onboarded, hasProperties: null }, undefined, home)).toBe(false);
    expect(needsFirstProperty(host, onboarded, undefined, home)).toBe(false);
  });

  it('needsFirstProperty_AdminSupplierOrLinkedSupplier_ReturnsFalse', () => {
    const profile = { ...onboarded, hasProperties: false };
    expect(needsFirstProperty({ roles: ['Admin'] }, profile, undefined, home)).toBe(false);
    expect(needsFirstProperty({ roles: ['Supplier'] }, profile, undefined, home)).toBe(false);
    expect(needsFirstProperty(host, { ...profile, supplierOrgId: 'sup-1' }, undefined, home)).toBe(false);
  });

  it('needsFirstProperty_OnboardingStillRequiredOrNoOrgOrNoRentalType_ReturnsFalse', () => {
    const profile = { ...onboarded, hasProperties: false };
    expect(needsFirstProperty(host, { ...profile, onboardingRequired: true }, undefined, home)).toBe(false);
    expect(needsFirstProperty(host, { ...profile, orgId: null }, undefined, home)).toBe(false);
    expect(needsFirstProperty(host, { ...profile, rentalType: null }, undefined, home)).toBe(false);
  });

  it('needsFirstProperty_CreationAndAccountPages_ReturnsFalseToAvoidLoops', () => {
    const profile = { ...onboarded, hasProperties: false };
    for (const path of [
      '/app/short-rent/properties/create',
      '/app/long-rent/properties/new',
      '/properties/create',
      '/app/short-rent/settings/billing',
      '/app/short-rent/profile',
      '/app/short-rent/onboarding',
      '/app/short-rent/onboarding/parts/compliance',
      '/onboarding',
    ]) {
      expect(needsFirstProperty(host, profile, undefined, path)).toBe(false);
    }
    expect(needsFirstProperty(host, profile, undefined, '/app/short-rent/properties')).toBe(true);
  });

  it('needsFirstProperty_ConnectionOfTheChannelManagerAndItsCallback_ReturnsFalseSoTheWizardOpens', () => {
    const profile = { ...onboarded, hasProperties: false };
    for (const path of ['/app/short-rent/integrations/octorate', '/app/short-rent/integrations/octorate/']) {
      expect(needsFirstProperty(host, profile, undefined, path)).toBe(false);
    }
    expect(needsFirstProperty(host, profile, undefined, '/app/short-rent/integrations/octorate-other')).toBe(true);
  });

  it('needsFirstProperty_PageOfThePluginForWordPress_ReturnsFalseSoTheConsentOpensWithItsParameters', () => {
    // The plugin sends the administrator of the agency to `/app/connect/wordpress?site=…&return=…&state=…&challenge=…&method=S256` (PLG-FE-CONSOLE): an owner who has finished the
    // onboarding and has no property yet must still reach that page, or the redirect to the first property drops the whole request of the plugin (the query is not part of the path).
    const profile = { ...onboarded, hasProperties: false };
    for (const path of ['/app/connect/wordpress', '/app/connect/wordpress/']) {
      expect(needsFirstProperty(host, profile, undefined, path)).toBe(false);
      expect(needsFirstProperty({ roles: ['LongTermLandlord'] }, { ...profile, rentalType: 'LongTerm' as const }, undefined, path)).toBe(false);
    }
    expect(needsFirstProperty(host, profile, undefined, '/app/connected')).toBe(true);
    expect(needsFirstProperty(host, profile, undefined, '/app/connect-other')).toBe(true);
  });
});

describe('host set up by the server, access token without role claims', () => {
  const setUp = {
    orgId: 'org-1',
    onboardingCompletedAt: '2026-11-20T10:00:00Z',
    rentalType: 'LongTerm' as const,
    isActive: true,
    onboardingRequired: false,
    consentsAccepted: true,
    commercialSetupRequired: false,
  };

  it('getRentalTypeOfHostSetUpByServer_OrgFinishedOnboardingRentalTypeAndNoPaymentWaiting_ReturnsTheRentalType', () => {
    expect(getRentalTypeOfHostSetUpByServer(setUp)).toBe('LongTerm');
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, rentalType: 'Both' })).toBe('Both');
    expect(getRentalTypeOfHostSetUpByServer({ orgId: 'org-1', onboardingCompletedAt: setUp.onboardingCompletedAt, rentalType: 'ShortTerm' })).toBe('ShortTerm');
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, onboardingRequired: null, consentsAccepted: null, commercialSetupRequired: null })).toBe('LongTerm');
  });

  it('getRentalTypeOfHostSetUpByServer_PaymentPendingOrHostFeaturesWithheld_ReturnsNull', () => {
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, commercialSetupRequired: true })).toBeNull();
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, onboardingRequired: true })).toBeNull();
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, consentsAccepted: false })).toBeNull();
  });

  it('getRentalTypeOfHostSetUpByServer_NoOrgNoFinishedOnboardingNoRentalTypeOrInactive_ReturnsNull', () => {
    expect(getRentalTypeOfHostSetUpByServer(null)).toBeNull();
    expect(getRentalTypeOfHostSetUpByServer(undefined)).toBeNull();
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, orgId: null })).toBeNull();
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, onboardingCompletedAt: null })).toBeNull();
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, rentalType: null })).toBeNull();
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, isActive: false })).toBeNull();
  });

  it('getRentalTypeOfHostSetUpByServer_LinkedSupplier_ReturnsNullSoTheSupplierConsoleStaysTheirHome', () => {
    expect(getRentalTypeOfHostSetUpByServer({ ...setUp, supplierOrgId: 'sup-1' })).toBeNull();
  });
});
