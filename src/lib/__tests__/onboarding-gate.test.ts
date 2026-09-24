import { describe, expect, it, vi } from 'vitest';
import { ME_QUERY_KEY, ONBOARDING_PATH, openOnboardingAfterGate } from '../onboarding-gate';

function setup(pathname: string, search = '') {
  const router = { state: { location: { pathname, search } }, navigate: vi.fn() };
  const queryClient = { invalidateQueries: vi.fn(async () => undefined) };
  return { router, queryClient };
}

describe('openOnboardingAfterGate (PL-02)', () => {
  it('openOnboardingAfterGate_HostPage_RefreshesProfileAndOpensOnboardingWithOrigin', () => {
    const { router, queryClient } = setup('/app/short-rent/properties/new', '?step=2');

    expect(openOnboardingAfterGate(router, queryClient)).toBe(true);

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ME_QUERY_KEY });
    expect(router.navigate).toHaveBeenCalledWith(ONBOARDING_PATH, {
      replace: true,
      state: { from: '/app/short-rent/properties/new?step=2' },
    });
  });

  it('openOnboardingAfterGate_AlreadyOnOnboarding_StaysPut', () => {
    const { router, queryClient } = setup('/onboarding');

    expect(openOnboardingAfterGate(router, queryClient)).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('openOnboardingAfterGate_AdminOrSupplierArea_StaysPut', () => {
    for (const pathname of ['/app/admin', '/app/admin/users', '/app/supplier/inbox', '/supplier/inbox']) {
      const { router, queryClient } = setup(pathname);

      expect(openOnboardingAfterGate(router, queryClient)).toBe(false);
      expect(router.navigate).not.toHaveBeenCalled();
      expect(queryClient.invalidateQueries).not.toHaveBeenCalled();
    }
  });

  it('openOnboardingAfterGate_PathOnlySharingThePrefix_OpensOnboarding', () => {
    const { router, queryClient } = setup('/app/administration-like');

    expect(openOnboardingAfterGate(router, queryClient)).toBe(true);
  });
});
