import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';

/**
 * BK-20 (A3-27, A8-13) on the real route table: `/search` is a page of the public site, with the public header and
 * footer, and an anonymous guest never sees the host console (sidebar, bottom navigation). Since SEARCH-GLOBAL the page is
 * the results page of a booking site with the scope of all of them: the homes come from the search of the platform.
 */
vi.mock('@/api/public-site-search.api', () => ({
  publicSiteSearchApi: {
    getPlatformStays: vi.fn().mockResolvedValue({
      currency: 'EUR',
      adults: 2,
      children: 0,
      pets: false,
      totalCount: 1,
      availableCount: 1,
      page: 1,
      pageSize: 24,
      items: [
        {
          id: 'p-1',
          slug: 'casa-del-faro',
          name: 'Casa del Faro',
          comune: 'Camogli',
          latitude: 44.35,
          longitude: 9.15,
          photos: [],
          bedrooms: 2,
          bathrooms: 1,
          maxGuests: 4,
          amenities: [],
          tags: [],
          availability: { available: true },
          price: { currency: 'EUR', perNightCents: 12000 },
          orgSlug: 'villa-mare',
          hostName: 'Villa Mare',
          country: 'IT',
        },
      ],
      alternatives: [],
      unsupportedFilters: [],
      generatedAt: '2030-06-01T08:00:00Z',
      facets: { maxGuests: 6, petsAllowed: true, tags: [], currency: 'EUR' },
    }),
    getPlatformDestinations: vi.fn().mockResolvedValue([]),
    getPlatformCalendar: vi.fn().mockResolvedValue({
      from: '2030-01-01',
      to: '2031-01-01',
      today: '2030-01-01',
      currency: 'EUR',
      adults: 2,
      children: 0,
      days: [],
      generatedAt: '2030-01-01T00:00:00Z',
    }),
    getStays: vi.fn(),
    getDestinations: vi.fn(),
    getSiteCalendar: vi.fn(),
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

    // The whole route table and the page with its map are built on the first visit: more than the default second on a busy runner.
    expect(await screen.findByTestId('platform-search', undefined, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByTestId('public-site-shell')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Casa del Faro' }, { timeout: 5000 })).toHaveAttribute(
      'href',
      '/book/villa-mare/property/casa-del-faro',
    );
    expect(router.state.location.pathname).toBe('/search');
    // None of the host console: no navigation of the app shell.
    expect(screen.queryByRole('navigation', { name: i18n.t('shell.mainNavigation') })).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: i18n.t('shell.mobileNavigation') })).not.toBeInTheDocument();
  });
});
