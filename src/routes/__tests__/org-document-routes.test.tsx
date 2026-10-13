import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { PublicOrgDto } from '@/types';

/**
 * BK-14 (A3-21) on the real route table: the operator's privacy notice and terms are public pages of the org's booking
 * site, reachable by an anonymous guest (no login), and the old English spelling of the terms leads to the same page.
 */
const org: PublicOrgDto = {
  slug: 'villa-parco',
  displayName: 'Villa Parco',
  logoUrl: null,
  themeColor: null,
  contactEmail: null,
};

vi.mock('@/queries/use-public-org', () => ({
  usePublicOrg: () => ({ data: org, isLoading: false, isError: false, error: null, refetch: vi.fn() }),
  useOrgProperties: () => ({ data: [], isLoading: false, isError: false }),
  useOrgDocument: (_slug: string | undefined, kind: 'privacy' | 'terms') => ({
    data: {
      kind,
      published: kind === 'privacy',
      version: kind === 'privacy' ? 1 : null,
      source: kind === 'privacy' ? 'Text' : null,
      contentHtml: kind === 'privacy' ? '<p>Informativa di Villa Parco</p>' : null,
      externalUrl: null,
      publishedAt: kind === 'privacy' ? '2026-10-01T09:30:00Z' : null,
    },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));
vi.mock('@/hooks/use-custom-host-redirect', () => ({ useCustomHostRedirect: vi.fn() }));
vi.mock('@/components/shared/cookie-consent-banner', () => ({ CookieConsentBanner: () => null }));

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

describe('operator document routes (BK-14)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    vi.stubGlobal('location', { ...window.location, hostname: 'localhost' });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('PrivacyRoute_AnonymousGuest_ShowsTheOperatorsPublishedNotice', async () => {
    const router = renderPublicApp('/book/villa-parco/privacy');

    expect(await screen.findByTestId('org-document-privacy')).toHaveTextContent('Informativa di Villa Parco');
    expect(router.state.location.pathname).toBe('/book/villa-parco/privacy');
    // Inside the booking site (header and footer), not a CasaZen page.
    expect(screen.getByTestId('public-site-shell')).toBeInTheDocument();
    expect(screen.getByTestId('footer-privacy')).toHaveAttribute('href', '/book/villa-parco/privacy');
  });

  it('TermsRoute_NotPublished_ShowsTheHonestNotice', async () => {
    const router = renderPublicApp('/book/villa-parco/termini');

    expect(await screen.findByTestId('org-document-not-published')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/book/villa-parco/termini');
  });

  it('TermsRoute_EnglishSpelling_RedirectsToTheTermsPage', async () => {
    const router = renderPublicApp('/book/villa-parco/terms');

    expect(await screen.findByTestId('org-document-not-published')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/book/villa-parco/termini');
  });
});
