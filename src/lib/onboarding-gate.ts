import type { QueryClient } from '@tanstack/react-query';
import { searchWithoutOctorateCallback } from '@/features/integrations/octorate/octorate-callback';

export const ONBOARDING_PATH = '/onboarding';

export const ME_QUERY_KEY = ['me'] as const;

const EXEMPT_PREFIXES = ['/app/admin', '/app/supplier', '/supplier'];

interface GateRouter {
  state: { location: { pathname: string; search: string } };
  navigate: (to: string, options?: { replace?: boolean; state?: unknown }) => unknown;
}

function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function openOnboardingAfterGate(
  router: GateRouter,
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
): boolean {
  const { pathname, search } = router.state.location;
  if (isUnder(pathname, ONBOARDING_PATH) || EXEMPT_PREFIXES.some((prefix) => isUnder(pathname, prefix))) {
    return false;
  }

  void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
  void router.navigate(ONBOARDING_PATH, {
    replace: true,
    state: { from: `${pathname}${searchWithoutOctorateCallback(pathname, search)}` },
  });
  return true;
}
