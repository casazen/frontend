import type { RouteObject } from 'react-router-dom';
import { HostLegalRedirect, HostOrgGuard, HostSiteNotFoundPage } from '@/features/public-site/host/host-site-pages';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';

/** Path of the booking site route of the app, the one an org's own host serves. */
const ORG_SITE_PATH = '/book/:orgSlug';

/**
 * Routes of an org's own host (BK-16, A3-08): the org's booking site (the very route of the app, so every page and every
 * future page of it is served, only for the org of the host), the CasaZen legal documents (redirected to the public web app)
 * and a public 404. There is no app, no login, no search and no guide here: such an address is "not found".
 */
export function buildHostSiteRoutes(appRoutes: RouteObject[]): RouteObject[] {
  const orgSite = appRoutes.find((route) => route.path === ORG_SITE_PATH);
  if (!orgSite) throw new Error(`The route ${ORG_SITE_PATH} of the booking site is missing from the app routes.`);

  return [
    { ...orgSite, element: <HostOrgGuard>{orgSite.element}</HostOrgGuard> },
    ...[LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH, ...Object.values(LEGAL_DOCUMENT_PATHS)].map((path) => ({
      path,
      element: <HostLegalRedirect />,
    })),
    { path: '*', element: <HostSiteNotFoundPage /> },
  ];
}
