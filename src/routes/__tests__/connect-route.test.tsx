import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { matchRoutes } from 'react-router-dom';
import { OnboardingGuard } from '@/components/auth/onboarding-guard';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { ContextLayout } from '@/components/layout/context-layout';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { ConnectWordPressPage } from '@/features/connect/connect-wordpress-page';
import type { HostSite } from '@/lib/host-site';
import { isNotRedesignedMatch } from '@/lib/ui-version';
import { appRoutes } from '@/routes';
import { buildHostSiteRoutes } from '../host-site-routes';

const ADDRESS = '/app/connect/wordpress';

const typesOf = (path: string) => (matchRoutes(appRoutes, path) ?? []).map((match) => (isValidElement(match.route.element) ? match.route.element.type : null));

describe('route /app/connect/wordpress (PLG-FE-CONSOLE, NF-201)', () => {
  it('Route_ThePageOfThePlugin_IsTheConnectPage', () => {
    const last = matchRoutes(appRoutes, ADDRESS)?.at(-1);

    expect(isValidElement(last?.route.element) && last?.route.element.type).toBe(ConnectWordPressPage);
  });

  it('Route_IsInsideTheSignedInApp_BehindTheLoginAndTheOnboardingGuard', () => {
    const types = typesOf(ADDRESS);

    expect(types).toContain(ProtectedRoute);
    expect(types).toContain(OnboardingGuard);
    expect(types.indexOf(ProtectedRoute)).toBeLessThan(types.indexOf(OnboardingGuard));
  });

  it('Route_IsOutsideEveryArea_NoMenuNoTabs', () => {
    expect(typesOf(ADDRESS)).not.toContain(ContextLayout);
    expect(ROUTE_MANIFEST.some((entry) => entry.path === ADDRESS)).toBe(false);
  });

  it('Route_KeepsTheRedesignOfTheConsole', () => {
    expect(isNotRedesignedMatch(matchRoutes(appRoutes, ADDRESS))).toBe(false);
  });

  it.each(['/app/connect', '/app/connect/', '/app/connect/wordpress/extra', '/app/connect/other'])('Route_%s_IsNotThePage', (path) => {
    const last = matchRoutes(appRoutes, path)?.at(-1);

    expect(isValidElement(last?.route.element) && last?.route.element.type).not.toBe(ConnectWordPressPage);
  });

  it('Route_OnTheOwnHostOfAnAgency_IsNotServed', () => {
    const site: HostSite = { host: 'www.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi', surfaces: { guestArea: true, ownerPortal: true }, ownerLoginReady: true };
    const hostRoutes = buildHostSiteRoutes(appRoutes, site);

    const types = (matchRoutes(hostRoutes, ADDRESS) ?? []).map((match) => (isValidElement(match.route.element) ? match.route.element.type : null));
    expect(types).not.toContain(ConnectWordPressPage);
  });
});
