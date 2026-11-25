import type { RouteObject } from 'react-router-dom';
import { OwnerHostLoginPage } from '@/features/owner-portal/owner-host-login-page';
import { OwnerHostNoAccessPage } from '@/features/owner-portal/owner-host-no-access-page';
import { OwnerLoginNotEnabledPage } from '@/features/owner-portal/owner-login-not-enabled-page';
import { ownerPortalPaths } from '@/features/owner-portal/paths';
import {
  HostCheckInGuard,
  HostLegalRedirect,
  HostOrgGuard,
  HostOwnerPortalGate,
  HostSiteNotFoundPage,
} from '@/features/public-site/host/host-site-pages';
import { HostSurfaceFrame } from '@/features/public-site/host/host-surface-frame';

import { GuestPortalEntry } from '@/features/guest-portal/guest-portal-page';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { getHostSite, isHostSurfaceOn, type HostSite } from '@/lib/host-site';
import { buildEmbedRoutes } from './embed-routes';
import { ownerPortalRoutes } from './ownerPortalRoutes';

/** Path of the booking site route of the app, the one an org's own host serves. */
const ORG_SITE_PATH = '/book/:orgSlug';

/** Path of the guest check-in route of the app, the one an org's own host serves when its guest area is on. */
const CHECK_IN_PATH = '/checkin/:token';

function findAppRoute(appRoutes: RouteObject[], what: string, matches: (route: RouteObject) => boolean): RouteObject {
  const route = appRoutes.find(matches);
  if (!route) throw new Error(`The route of ${what} is missing from the app routes.`);
  return route;
}

/**
 * The guest check-in on an org's own host (NF-140): the very route of the app, only for the agency of the host (`HostCheckInGuard`). The door of a property
 * (`/checkin/porta/:doorToken`) is another route of the app and is not served here.
 */
function checkInRoute(appRoutes: RouteObject[]): RouteObject {
  const route = findAppRoute(appRoutes, `the check-in ${CHECK_IN_PATH}`, (candidate) => candidate.path === CHECK_IN_PATH);
  return { ...route, element: <HostCheckInGuard>{route.element}</HostCheckInGuard> };
}

/**
 * The owner portal on an org's own host (NF-140, NF-141) when its domain is registered with the sign-in service: the very routes of the app (the layout that holds the Auth boundary and
 * its children, `ownerPortalRoutes`), with two differences that a host needs. The sign-in page is the one of the domain (`OwnerHostLoginPage`: it returns to this domain, to
 * `/portale-proprietari`), and a visitor who is not signed in goes there from the protected portal instead of to `/login`, which is «not found» on a host. A third page is the domain's own too: where a signed-in
 * person whose read of the portal was refused (403) lands, since `/app/no-access` is «not found» on a host (`OwnerHostNoAccessPage`: it says so and gives the way out).
 */
function ownerPortalHostRoute(appRoutes: RouteObject[]): RouteObject {
  const layout = findAppRoute(appRoutes, 'the owner portal', (candidate) => candidate.children === ownerPortalRoutes);
  return {
    element: layout.element,
    children: [
      ...ownerPortalRoutes.map((route) => {
        if (route.path === ownerPortalPaths.signIn) return { ...route, element: <OwnerHostLoginPage /> };
        if (route.path === ownerPortalPaths.home) return { ...route, element: <HostOwnerPortalGate>{route.element}</HostOwnerPortalGate> };
        return route;
      }),
      { path: ownerPortalPaths.noAccess, element: <OwnerHostNoAccessPage /> },
    ],
  };
}

/**
 * The owner portal on an org's own host whose domain is NOT yet registered with the sign-in service: every address of the portal is one page that says the access is not active yet.
 * No sign-in boundary here: the boundary reloads a page that needs the sign-in, and on such a host nothing mounts it.
 */
function ownerPortalNotEnabledRoute(): RouteObject {
  return { path: `${ownerPortalPaths.home}/*`, element: <OwnerLoginNotEnabledPage /> };
}

/**
 * Routes of an org's own host (BK-16, A3-08): the org's booking site (the very route of the app, so every page and every
 * future page of it is served, only for the org of the host), the embeddable widgets of that org (`/embed/booking`, `/embed/property/…`,
 * `/embed/guest-access`: NF-144, the org is always the host's, never a parameter, and every other address under `/embed`, which is the shell's
 * own «not available» state with no link: the 404 page below has one, and a frame of another site must not be led to the rest of the site by it),
 * the CasaZen legal documents (redirected to the public web app) and a public 404. There is no app, no login, no search and no guide here: such
 * an address is "not found".
 *
 * Two surfaces more, each only when `resolve-host` says it is on for this host (`site.surfaces`, NF-140; a host that says nothing serves what it always served), both inside the frame of the
 * agency (`HostSurfaceFrame`: its logo, name and colours): the guest check-in `/checkin/:token` (guest area) and the owner portal `/portale-proprietari/…` (owner portal). With the
 * owner surface on but the domain not registered with the sign-in service (`site.ownerLoginReady`) the whole portal is one «not yet enabled» page. Everything else that belongs to the
 * host console stays «not found» on the host with every surface on: `/app/*`, `/login`, `/register`, `/search`, the door of a property `/checkin/porta/:doorToken`, the supplier pages and the
 * `/book/…` of another org. `/my-bookings` is part of the booking site and is served whatever the surfaces say.
 *
 * The router window of such a host (`host-site-window.ts`) only rewrites the segments of `HOST_SITE_SEGMENTS`: `/embed/…`, `/checkin/…` and `/portale-proprietari/…` are the routes themselves.
 * `site` is the one the start-up found (`getHostSite`); without one no surface is on.
 */
export function buildHostSiteRoutes(appRoutes: RouteObject[], site: HostSite | null = getHostSite()): RouteObject[] {
  const orgSite = findAppRoute(appRoutes, `the booking site ${ORG_SITE_PATH}`, (route) => route.path === ORG_SITE_PATH);

  const surfaces: RouteObject[] = [];
  if (isHostSurfaceOn(site, 'guestArea')) surfaces.push(checkInRoute(appRoutes));
  if (isHostSurfaceOn(site, 'ownerPortal')) {
    surfaces.push(site?.ownerLoginReady === true ? ownerPortalHostRoute(appRoutes) : ownerPortalNotEnabledRoute());
  }

  return [
    { ...orgSite, element: <HostOrgGuard>{orgSite.element}</HostOrgGuard> },
    ...buildEmbedRoutes('host'),
    ...(surfaces.length > 0 ? [{ element: <HostSurfaceFrame />, children: surfaces }] : []),
    { path: '/s/:slug', element: <GuestPortalEntry hostOnly /> },
    ...[LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH, ...Object.values(LEGAL_DOCUMENT_PATHS)].map((path) => ({
      path,
      element: <HostLegalRedirect />,
    })),
    { path: '*', element: <HostSiteNotFoundPage /> },
  ];
}
