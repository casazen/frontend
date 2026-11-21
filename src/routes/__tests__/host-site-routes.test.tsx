import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { publicCheckinApi } from '@/api/checkin.api';
import i18n from '@/i18n/config';
import { setHostSite, type HostSite } from '@/lib/host-site';
import type { PublicOrgDto } from '@/types';

/**
 * BK-16 (A3-08) on the real route table: an org's own host serves that org's booking site and nothing else. No app, no
 * login (it used to send the guest of `https://www.villa.example/` to Auth0), no cross-site search, no guides, no other org.
 */
const PUBLIC_SITE = 'https://public-site.example.test';

const ORG: PublicOrgDto = {
  slug: 'villa-rossi',
  displayName: 'Villa Rossi',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
  tagline: 'Il tuo rifugio sul lago',
};

vi.mock('@/queries/use-public-org', () => ({
  usePublicOrg: () => ({ data: ORG, isLoading: false, isError: false }),
  useOrgProperties: () => ({ data: [], isLoading: false, isError: false }),
  useOrgPublicProperty: () => ({ data: undefined, isLoading: true, isError: false }),
  usePropertyAvailability: () => ({ data: undefined, isError: false, refetch: vi.fn() }),
}));

// The context of a check-in link: the one thing the routes need is which agency's link it is, and a page to show for it.
vi.mock('@/api/checkin.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/checkin.api')>();
  return { ...actual, publicCheckinApi: { ...actual.publicCheckinApi, getContext: vi.fn() } };
});

import { PublicAppProviders } from '@/contexts/auth-bridge';
import { appRoutes } from '@/routes';
import { buildHostSiteRoutes } from '../host-site-routes';

const replace = vi.fn();

const HOST_SITE: HostSite = { host: 'www.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' };

function renderHostSite(entry: string, site: HostSite | null = HOST_SITE) {
  setHostSite(site);
  const router = createMemoryRouter(buildHostSiteRoutes(appRoutes, site), { initialEntries: [entry] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <PublicAppProviders>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </PublicAppProviders>,
  );
  return router;
}

describe('routes of an org own host (BK-16)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    replace.mockClear();
    setHostSite({ host: 'www.villa-rossi.example.test', slug: 'villa-rossi', displayName: 'Villa Rossi' });
    vi.stubEnv('VITE_PUBLIC_SITE_URL', PUBLIC_SITE);
    vi.stubGlobal('location', { ...window.location, hostname: 'www.villa-rossi.example.test', replace });
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('OrgSiteRoute_OwnOrg_ShowsTheBookingSiteShellWithItsBranding', async () => {
    renderHostSite('/book/villa-rossi');

    expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
    expect(screen.getAllByText('Villa Rossi').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('OrgSiteRoute_OwnOrgPropertyPage_IsServed', async () => {
    renderHostSite('/book/villa-rossi/property/casa-mare');

    expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it.each(['/book/other-org', '/book/other-org/property/casa-mare', '/book/villa-rossi-2'])(
    'OrgSiteRoute_AnotherOrg_%s_IsNotFoundOnThisHost',
    async (path) => {
      // A domain can never be made to show another host's site under its name.
      renderHostSite(path);

      expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
      expect(screen.queryByTestId('public-site-shell')).not.toBeInTheDocument();
    },
  );

  it.each(['/login', '/signup', '/onboarding', '/app/short-rent/bookings', '/p/affitti-brevi', '/checkin/abc', '/s/supplier', '/fornitori/supplier', '/anything'])(
    'AnyOtherRoute_%s_IsNotFoundNeverTheAppOrTheLogin',
    async (path) => {
      const router = renderHostSite(path);

      expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it('NotFoundPage_OffersTheWayBackToTheSiteLandingPage', async () => {
    renderHostSite('/anything');

    const home = await screen.findByRole('link', { name: i18n.t('hostSite.pageNotFound.home') });

    expect(home).toHaveAttribute('href', '/');
  });

  it.each(['/legale/privacy', '/legale/termini', '/legale/dpa', '/legale/sub-responsabili', '/legale'])(
    'LegalDocument_%s_LeadsToThePublicWebApp',
    async (path) => {
      // The documents are CasaZen's, not the host's: they live on the public web app (VITE_PUBLIC_SITE_URL).
      renderHostSite(path);

      await vi.waitFor(() => expect(replace).toHaveBeenCalledWith(`${PUBLIC_SITE}${path}`));
    },
  );

  it('LegalDocument_PublicSiteNotConfigured_IsNotFoundNoDefaultDomain', async () => {
    vi.stubEnv('VITE_PUBLIC_SITE_URL', '');

    renderHostSite('/legale/privacy');

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('buildHostSiteRoutes_WithoutTheBookingSiteRoute_FailsLoudlyInsteadOfServingNothing', () => {
    expect(() => buildHostSiteRoutes([{ path: '/x' }])).toThrow(/\/book\/:orgSlug/);
  });
});

/**
 * NF-140 on the real route table: besides its booking site, the own domain of an agency serves the guest check-in and the owner portal, each only when `resolve-host` says it is on, inside the frame of the
 * agency; everything that belongs to the host console stays «not found» with every surface on.
 */
const BRANDED_LOOK = {
  logoUrl: 'https://cdn.example.test/villa-rossi.png',
  primaryColor: '#1a5276',
  themeId: 'mare',
  fontId: null,
  displayName: 'Villa Rossi',
  showPoweredBy: true,
};

const GUEST_ONLY: HostSite = { ...HOST_SITE, surfaces: { guestArea: true, ownerPortal: false }, branding: BRANDED_LOOK };
const OWNER_NOT_READY: HostSite = { ...HOST_SITE, surfaces: { guestArea: false, ownerPortal: true }, branding: BRANDED_LOOK };
const EVERY_SURFACE: HostSite = { ...HOST_SITE, surfaces: { guestArea: true, ownerPortal: true }, ownerLoginReady: true, branding: BRANDED_LOOK };

describe('guest check-in and owner portal on an org own host (NF-140)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    replace.mockClear();
    vi.mocked(publicCheckinApi.getContext).mockReset();
    // A link that is already completed: the check-in page shows its closing card, nothing to fill in.
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: true, status: 'Completo' });
    vi.stubEnv('VITE_PUBLIC_SITE_URL', PUBLIC_SITE);
    vi.stubGlobal('location', { ...window.location, hostname: 'www.villa-rossi.example.test', replace });
  });

  afterEach(() => {
    cleanup();
    setHostSite(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('CheckInRoute_GuestAreaOn_ShowsTheCheckInPageInsideTheFrameOfTheAgency', async () => {
    renderHostSite('/checkin/tok-1', GUEST_ONLY);

    const frame = await screen.findByTestId('host-surface-frame');
    expect(await within(frame).findByTestId('checkin-success')).toBeInTheDocument();
    // The logo and the name of the agency, a link to the landing page of the site.
    const home = within(frame).getByTestId('host-surface-frame-home');
    expect(home).toHaveAttribute('href', '/');
    expect(home).toHaveTextContent('Villa Rossi');
    expect(home.querySelector('img')).toHaveAttribute('src', BRANDED_LOOK.logoUrl);
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    expect(publicCheckinApi.getContext).toHaveBeenCalledWith('tok-1');
  });

  it.each([
    ['the field is missing from the answer', { ...HOST_SITE }],
    ['the guest area is off', { ...HOST_SITE, surfaces: { guestArea: false, ownerPortal: true }, ownerLoginReady: true }],
  ])('surface off means not found: /checkin/:token when %s (and nothing is asked)', async (_name, site) => {
    // Nothing changes for an org without the surface.
    renderHostSite('/checkin/tok-1', site);

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('host-surface-frame')).not.toBeInTheDocument();
    expect(publicCheckinApi.getContext).not.toHaveBeenCalled();
  });

  it('CheckInRoute_AnotherAgencyContext_IsNotFoundInTheFrameOfNoOne', async () => {
    vi.mocked(publicCheckinApi.getContext).mockResolvedValue({ completed: false, status: 'InCompilazione', propertyName: 'Casa di altri', privacyNoticeOrgSlug: 'another-agency' });
    renderHostSite('/checkin/tok-1', GUEST_ONLY);

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByText('Casa di altri')).not.toBeInTheDocument();
  });

  it.each(['/portale-proprietari/accedi', '/portale-proprietari/invito', '/portale-proprietari/contatto', '/portale-proprietari', '/portale-proprietari/contabilita'])(
    'surface off means not found: owner portal %s',
    async (path) => {
      // The guest area alone, and a host with no surface at all: the owner portal is not there.
      renderHostSite(path, GUEST_ONLY);

      expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
      expect(screen.queryByTestId('host-surface-frame')).not.toBeInTheDocument();
      expect(screen.queryByTestId('owner-login-not-enabled')).not.toBeInTheDocument();
    },
  );

  it('surface off means not found: owner portal when the answer has no surfaces', async () => {
    renderHostSite('/portale-proprietari/accedi', HOST_SITE);

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
  });

  it.each(['/portale-proprietari/accedi', '/portale-proprietari/invito', '/portale-proprietari/contatto', '/portale-proprietari', '/portale-proprietari/contabilita'])(
    'OwnerPortalRoute_SurfaceOnButDomainNotRegistered_%s_IsTheNotEnabledPageInTheFrame',
    async (path) => {
      renderHostSite(path, OWNER_NOT_READY);

      const frame = await screen.findByTestId('host-surface-frame');
      expect(within(frame).getByTestId('owner-login-not-enabled')).toBeInTheDocument();
      expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
    },
  );

  it.each([
    '/app/short-rent/bookings',
    '/app',
    '/login',
    '/register',
    '/signup',
    '/onboarding',
    '/search',
    '/checkin/porta/door-token',
    '/checkin',
    '/s/supplier',
    '/fornitori/supplier',
    '/book/other-org',
    '/book/other-org/property/casa-mare',
  ])('host-only paths are not found with every surface on: %s', async (path) => {
    // The host app and the host sign-in are not reachable on the agency domain, whatever the agency has switched on.
    const router = renderHostSite(path, EVERY_SURFACE);

    expect(await screen.findByTestId('host-site-page-not-found')).toBeInTheDocument();
    expect(screen.queryByTestId('host-surface-frame')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe(path);
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    ['without a surface', HOST_SITE],
    ['with every surface on', EVERY_SURFACE],
  ])('BookingSite_%s_IsServedAsBefore', async (_name, site) => {
    // The booking site, and with it «Le mie prenotazioni» (`/my-bookings` of the browser is `/book/<slug>/my-bookings` for the router), do not depend on the surfaces.
    renderHostSite('/book/villa-rossi/my-bookings', site);

    expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('host-site-page-not-found')).not.toBeInTheDocument();
  });

  it('buildHostSiteRoutes_SiteNotGiven_IsReadFromTheStartUpAndNoSiteMeansNoSurface', () => {
    setHostSite(EVERY_SURFACE);
    const fromStartUp = createMemoryRouter(buildHostSiteRoutes(appRoutes), { initialEntries: ['/checkin/tok-1'] });
    expect(fromStartUp.state.matches.at(-1)?.route.path).toBe('/checkin/:token');

    const none = createMemoryRouter(buildHostSiteRoutes(appRoutes, null), { initialEntries: ['/checkin/tok-1'] });
    expect(none.state.matches.at(-1)?.route.path).toBe('*');
    fromStartUp.dispose();
    none.dispose();
  });

  it('buildHostSiteRoutes_SurfaceOnButTheAppRouteIsMissing_FailsLoudlyInsteadOfServingNothing', () => {
    const orgSiteOnly = appRoutes.filter((route) => route.path === '/book/:orgSlug');

    expect(() => buildHostSiteRoutes(orgSiteOnly, GUEST_ONLY)).toThrow(/check-in/);
    expect(() => buildHostSiteRoutes(orgSiteOnly, OWNER_NOT_READY)).not.toThrow();
    expect(() => buildHostSiteRoutes(orgSiteOnly, EVERY_SURFACE)).toThrow();
  });
});
