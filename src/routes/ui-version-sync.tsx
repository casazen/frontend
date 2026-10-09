import { useLayoutEffect, useSyncExternalStore } from 'react';
import { matchRoutes, type createBrowserRouter } from 'react-router-dom';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHostSite } from '@/lib/host-site';
import { applyUiVersion, isNotRedesignedMatch, isUiV2Override } from '@/lib/ui-version';

type RouterLike = Pick<ReturnType<typeof createBrowserRouter>, 'routes' | 'state' | 'subscribe'>;

/**
 * Keeps `<html data-ui="v2">` in step with the app (UI-01, D8). The redesign is on when the backend flag `uiRedesign` is on
 * or the QA / build override is set (`isUiV2Override`), and never where the app is not redesigned yet: neither on an org's
 * own host (its whole site is the public booking site) nor on a route marked `NOT_REDESIGNED_ROUTE_HANDLE` (the booking
 * site, the guest and tenant pages), which the router tells at every navigation: the app is a single page, a visitor can
 * move between the console and a public page without a reload.
 *
 * It sits outside the `RouterProvider` (the flags provider wraps the router), so it follows the router by subscription.
 * The attribute is set before the browser paints: the override and the build flag apply on the first frame; the flag of the
 * API, which has to be fetched, applies as soon as it arrives.
 */
export function UiVersionSync({ router }: { router: RouterLike }) {
  const { flags } = useFeatureFlags();
  const pathname = useSyncExternalStore(router.subscribe, () => router.state.location.pathname);

  const wanted = flags.uiRedesign || isUiV2Override();
  const enabled = wanted && getHostSite() === null && !isNotRedesignedMatch(matchRoutes(router.routes, pathname));

  useLayoutEffect(() => {
    applyUiVersion(enabled);
    return () => applyUiVersion(false);
  }, [enabled]);

  return null;
}
