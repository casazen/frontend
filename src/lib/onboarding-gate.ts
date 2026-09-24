import type { QueryClient } from '@tanstack/react-query';

export const ONBOARDING_PATH = '/onboarding';

/** Query key of `GET /users/me` (`useMe`). */
export const ME_QUERY_KEY = ['me'] as const;

/**
 * Areas that never wait for the host onboarding (PL-01): the admin console and the supplier console. A host endpoint
 * called from there answers `onboarding_required` as an error of that call, without leaving the page.
 */
const EXEMPT_PREFIXES = ['/app/admin', '/app/supplier', '/supplier'];

interface GateRouter {
  state: { location: { pathname: string; search: string } };
  navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => unknown;
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Handler of a 403 `onboarding_required` (backend PL-02): the host features wait for the onboarding and the current
 * legal consents. Refreshes the profile (its `onboardingRequired` / `consentsAccepted` drive the wizard) and opens
 * `/onboarding`, remembering the page to come back to. Returns false when it stays put: already on the onboarding, or
 * in the admin / supplier area.
 */
export function openOnboardingAfterGate(
  router: GateRouter,
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
): boolean {
  const { pathname, search } = router.state.location;
  if (isUnder(pathname, ONBOARDING_PATH) || EXEMPT_PREFIXES.some((prefix) => isUnder(pathname, prefix))) {
    return false;
  }

  void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  // `replace`: Back must not reopen the page that was refused.
  void router.navigate(ONBOARDING_PATH, { replace: true, state: { from: `${pathname}${search}` } });
  return true;
}
