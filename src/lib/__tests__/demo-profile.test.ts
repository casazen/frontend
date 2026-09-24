import { describe, expect, it } from 'vitest';
import { buildDemoProfile } from '../demo-profile';
import { needsOnboarding } from '../onboarding';

const ROLES_CLAIM = 'https://casazen.app/roles';

describe('buildDemoProfile (A1-18)', () => {
  it('buildDemoProfile_OnboardedPersonas_HaveOrgAndCompletion', () => {
    for (const persona of ['short-stay', 'long-term', 'dual', 'triple', 'supplier'] as const) {
      const profile = buildDemoProfile(persona);
      expect(profile.orgId).toBeTruthy();
      expect(profile.onboardingCompletedAt).toBeTruthy();
    }
  });

  it('buildDemoProfile_OnboardingPersona_NeedsTheWizard', () => {
    const profile = buildDemoProfile('onboarding');
    expect(profile.orgId).toBeNull();
    expect(needsOnboarding({ [ROLES_CLAIM]: [] }, profile)).toBe(true);
  });

  it('buildDemoProfile_AdminPersona_HasNoOrgButSkipsTheWizard', () => {
    const profile = buildDemoProfile('admin');
    expect(profile.orgId).toBeNull();
    expect(needsOnboarding({ [ROLES_CLAIM]: ['Admin'] }, profile)).toBe(false);
  });

  it('buildDemoProfile_HostPersonas_DoNotNeedTheWizard', () => {
    expect(needsOnboarding({ [ROLES_CLAIM]: ['PropertyOwner'] }, buildDemoProfile('short-stay'))).toBe(false);
    expect(needsOnboarding({ [ROLES_CLAIM]: ['LongTermLandlord'] }, buildDemoProfile('long-term'))).toBe(false);
  });
});
