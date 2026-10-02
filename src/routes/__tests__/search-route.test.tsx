import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';

/**
 * BK-20 (A3-27, A8-13) on the real route table: `/search` is a page of the public site, with the public header and
 * footer, and an anonymous guest never sees the host console (sidebar, bottom navigation).
 */
vi.mock('@/api/properties.api', () => ({
  propertiesApi: {
    search: vi.fn().mockResolvedValue([
      {
        id: 'p-1',
        slug: 'casa-del-faro',
        orgSlug: 'villa-mare',
        name: 'Casa del Faro',
        description: '',
        city: 'Camogli',
        postalCode: '16032',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        nightlyRate: 120,
        cleaningFee: 30,
        amenities: [],
        photoUrls: [],
        cinCode: null,
        cinStatus: 'Missing',
        timezone: 'Europe/Rome',
      },
    ]),
  },
}));
vi.mock('@/hooks/use-custom-host-redirect', () => ({ useCustomHostRedirect: vi.fn() }));

import { PublicAppProviders } from '@/contexts/auth-bridge';
import { appRoutes } from '@/routes';

function renderPublicApp(entry: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [entry] });
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

describe('public search route (BK-20)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.stubGlobal('location', { ...window.location, hostname: 'localhost' });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('SearchRoute_AnonymousGuest_IsInThePublicShellWithTheResultsLinkedToTheBookingSite', async () => {
    const router = renderPublicApp('/search');

    expect(await screen.findByTestId('search-page')).toBeInTheDocument();
    expect(screen.getByTestId('public-site-shell')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Casa del Faro' })).toHaveAttribute(
      'href',
      '/book/villa-mare/property/casa-del-faro',
    );
    expect(router.state.location.pathname).toBe('/search');
    // None of the host console: no navigation of the app shell.
    expect(screen.queryByRole('navigation', { name: i18n.t('shell.mainNavigation') })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: i18n.t('shell.mobileNavigation') })).not.toBeInTheDocument();
  });
});
