import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { LEGAL_DOCUMENT_PATHS, LEGAL_INDEX_PATH, LEGAL_SUBPROCESSORS_PATH } from '@/features/legal/legal-paths';
import { SEO_HUB_PATH } from '@/features/public-seo/seo-paths';
import { supplierShowcasePath } from '@/features/supplier/lib/showcase-paths';
import { SIGNUP_PATH } from '@/lib/signup-attribution';
import { isNotRedesignedMatch, NOT_REDESIGNED_ROUTE_HANDLE } from '@/lib/ui-version';
import { appRoutes } from '@/routes';
import { buildHostSiteRoutes } from '../host-site-routes';

/**
 * UI-01 on the real route table: the redesign (`data-ui="v2"`) reaches the console and the access pages, and never the
 * pages of people who are not console users: the public booking site and its layout (search, guides, legal documents,
 * supplier showcase), the check-in of a guest and the rent payment of a tenant. They keep their look until their own
 * redesign (DB-01...), which drops the marker from the route.
 */
const notRedesigned = (path: string) => isNotRedesignedMatch(matchRoutes(appRoutes, path));

describe('routes that keep the current look (NOT_REDESIGNED_ROUTE_HANDLE)', () => {
  it.each([
    '/book/villa',
    '/book/villa/my-bookings',
    '/book/villa/property/casa-mare',
    '/book/villa/property/casa-mare/checkout',
    '/book/villa/booking/b-1',
    '/book/villa/requests/r-1/confirm',
    '/search',
    SEO_HUB_PATH,
    '/p/affitti-brevi/lombardia/milano',
    '/p/tassa-soggiorno/milano',
    LEGAL_INDEX_PATH,
    LEGAL_SUBPROCESSORS_PATH,
    ...Object.values(LEGAL_DOCUMENT_PATHS),
    supplierShowcasePath('splendore-pulizie'),
    '/checkin/abc123',
    '/rent/pay/installment-1',
  ])('Route_%s_KeepsTheCurrentLook', (path) => {
    expect(matchRoutes(appRoutes, path), `${path} matches a route`).not.toBeNull();
    expect(notRedesigned(path)).toBe(true);
  });

  it.each([
    '/login',
    '/register',
    SIGNUP_PATH,
    '/register/claim',
    '/onboarding',
    '/app/choose-context',
    '/app/no-access',
    '/app/short-rent',
    '/app/short-rent/properties',
    '/app/long-rent/leases',
    '/app/admin',
    '/app/supplier/inbox',
    // Help for the console users (the iCal link of a calendar) and the 404 are CasaZen's own pages.
    '/help/ical',
    '/a/page/that/does/not/exist',
  ])('Route_%s_GetsTheRedesign', (path) => {
    expect(notRedesigned(path)).toBe(false);
  });

  it('HostSiteRoutes_OrgSite_KeepsTheMarker', () => {
    // On an org's own host `UiVersionSync` stays off through `getHostSite()`; the marker is also on the route it serves.
    const [orgSite] = buildHostSiteRoutes(appRoutes);
    expect(orgSite.handle).toEqual(NOT_REDESIGNED_ROUTE_HANDLE);
  });
});
