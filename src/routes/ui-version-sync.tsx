import { useLayoutEffect, useSyncExternalStore } from 'react';
import { matchRoutes, type createBrowserRouter } from 'react-router-dom';
import { getHostSite } from '@/lib/host-site';
import { isNotRedesignedMatch } from '@/lib/ui-version';

type RouterLike = Pick<ReturnType<typeof createBrowserRouter>, 'routes' | 'state' | 'subscribe'>;

/**
 * Takes `<html data-ui="v2">` (set by `index.html`) off where the app is not redesigned yet: on an org's own host (its whole
 * site is the public booking site) and on a route marked `NOT_REDESIGNED_ROUTE_HANDLE` (the booking site, the guest and
 * tenant pages), which the router tells at every navigation: the app is a single page, a visitor can move between the
 * console and a public page without a reload. Anywhere else the attribute stays as `index.html` has it.
 *
 * It sits outside the `RouterProvider`, so it follows the router by subscription, and it runs before the browser paints.
 */
export function UiVersionSync({ router }: { router: RouterLike }) {
  const pathname = useSyncExternalStore(router.subscribe, () => router.state.location.pathname);
  const notRedesigned = getHostSite() !== null || isNotRedesignedMatch(matchRoutes(router.routes, pathname));

  useLayoutEffect(() => {
    if (!notRedesigned) return;
    const root = document.documentElement;
    root.removeAttribute('data-ui');
    return () => root.setAttribute('data-ui', 'v2');
  }, [notRedesigned]);

  return null;
}
