import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { setHostSite } from '@/lib/host-site';
import type { PublicOrgDto } from '@/types';

/**
 * BK-16 (A3-08) on the real route table: an org's own host serves that org's booking site and nothing else. No app, no
 * login (it used to send the guest of `https://www.villa.example/` to Auth0), no search, no guides, no other org.
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

import { PublicAppProviders } from '@/contexts/auth-bridge';
import { appRoutes } from '@/routes';
import { buildHostSiteRoutes } from '../host-site-routes';

const replace = vi.fn();

function renderHostSite(entry: string) {
  const router = createMemoryRouter(buildHostSiteRoutes(appRoutes), { initialEntries: [entry] });
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

  it.each(['/login', '/signup', '/onboarding', '/app/short-rent/bookings', '/search', '/p/affitti-brevi', '/checkin/abc', '/s/supplier', '/fornitori/supplier', '/anything'])(
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
