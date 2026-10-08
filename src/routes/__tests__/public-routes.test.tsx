import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import type { SeoPagePublic } from '@/types/seo.types';
import i18n from '@/i18n/config';

/**
 * SE-03 (A8-03) on the real route table, with the providers the app mounts on a public path (no Auth0): an anonymous
 * visitor on a public page is never sent to the login, an unknown address is a public 404, and the SEO CTA leads to
 * the Auth0 signup through `/signup` with one click.
 */
const PUBLIC_SITE = 'https://public-site.example.test';

const { page } = vi.hoisted(() => {
  const page: SeoPagePublic = {
    id: 'page-1',
    pageType: 'ComplianceGuide',
    title: 'Affitti brevi a Como',
    metaDescription: 'Guida',
    bodyHtml: '<p>Guida</p>',
    comuneName: 'Como',
    comuneCode: '013075',
    regionCode: 'LOM',
    regionSlug: 'lombardia',
    comuneSlug: 'como',
    canonicalUrl: 'https://public-site.example.test/p/affitti-brevi/lombardia/como',
    lastRefreshedAt: null,
    aiGenerated: true,
    contentLanguage: 'it',
    cta: {
      signupUrl:
        'https://public-site.example.test/signup?comune=como&utm_source=seo-compliance&utm_medium=cta&utm_content=compliance-guide',
    },
    touristTaxRates: [],
  };
  return { page };
});

vi.mock('@/queries/use-public-seo', () => ({
  usePublishedSeoPages: () => ({
    data: { canonicalUrl: null, pages: [] },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useComplianceGuide: () => ({ data: page, isLoading: false, isError: false }),
  useTouristTaxPage: () => ({ data: page, isLoading: false, isError: false }),
  useFeaturedProperties: () => ({
    data: { comuneSlug: 'como', comuneName: 'Como', properties: [] },
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useCalculateTouristTax: () => ({ mutateAsync: vi.fn(), data: undefined, isPending: false }),
}));
vi.mock('@/queries/use-legal', () => ({
  useLegalDocuments: () => ({ isLoading: true, isError: false }),
  useLegalLanguage: () => 'it',
  // PL-14: no text provided yet by the product owner (D14).
  useLegalDocument: () => ({
    data: { key: 'tos', version: '2026-06-v1', effectiveAt: null, title: 't', summary: 's', available: false },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
  useSubprocessors: () => ({
    data: { version: '2026-10-v1', effectiveAt: null, items: [] },
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  }),
}));

import { PublicAppProviders } from '@/contexts/auth-bridge';
import { appRoutes } from '@/routes';

const assign = vi.fn();
const replace = vi.fn();

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

describe('public routes without Auth0 (SE-03)', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    assign.mockClear();
    replace.mockClear();
    // The CTA reads the origin; the host stays a local one (no org-site resolution in these tests).
    vi.stubGlobal('location', { ...window.location, origin: PUBLIC_SITE, hostname: 'localhost', assign, replace });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('UnknownRoute_AnonymousVisitor_ShowsThePublic404AndIsNotRedirected', async () => {
    const router = renderPublicApp('/pagina-che-non-esiste');

    expect(await screen.findByTestId('not-found-page')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/pagina-che-non-esiste');
    expect(assign).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('UnknownBookingSite_AnonymousVisitor_ShowsTheSiteNotFoundPage', async () => {
    const router = renderPublicApp('/book');

    expect(await screen.findByText(i18n.t('publicBooking.orgNotFound'))).toBeInTheDocument();
    expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/book');
    expect(assign).not.toHaveBeenCalled();
  });

  it.each(['/p/affitti-brevi', '/p/affitti-brevi/lombardia/como', '/p/tassa-soggiorno/como'])(
    'PublicSeoPage_%s_AnonymousVisitor_IsNotRedirected',
    async (path) => {
      const router = renderPublicApp(path);

      expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
      expect(assign).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it.each(['/legale', '/legale/termini', '/legale/privacy', '/legale/dpa', '/legale/sub-responsabili'])(
    'LegalPage_%s_AnonymousVisitor_IsPublic',
    async (path) => {
      const router = renderPublicApp(path);

      expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      expect(screen.queryByTestId('not-found-page')).not.toBeInTheDocument();
      expect(screen.getByTestId('footer-subprocessors')).toBeInTheDocument();
      expect(assign).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
    },
  );

  it('PublicSeoPage_DefaultMode_ShowsCookieConsentBanner', async () => {
    localStorage.removeItem('casazen_cookie_consent');
    renderPublicApp('/p/affitti-brevi/lombardia/como');

    expect(await screen.findByTestId('public-site-shell')).toBeInTheDocument();
    expect(screen.getByTestId('cookie-consent-banner')).toBeInTheDocument();
  });

  it('SeoCta_OpensSignupOnThePublicDomainWithComuneAndTheUtmOfTheVisit', async () => {
    renderPublicApp('/p/affitti-brevi/lombardia/como?utm_source=newsletter&utm_campaign=settembre');

    const cta = await screen.findByTestId('seo-cta-signup');
    // A plain link (full page load, so /signup gets Auth0), never a router link to the login.
    expect(cta.tagName).toBe('A');
    const url = new URL(cta.getAttribute('href')!);
    expect(`${url.origin}${url.pathname}`).toBe(`${PUBLIC_SITE}/signup`);
    expect(url.searchParams.get('comune')).toBe('como');
    expect(url.searchParams.get('utm_source')).toBe('newsletter');
    expect(url.searchParams.get('utm_campaign')).toBe('settembre');
    // No CTA towards a compliance checker that does not exist.
    expect(screen.queryByTestId('seo-cta-checker')).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="verifica-conformita"]')).toBeNull();
  });

  it('SignupReachedClientSide_FromAPublicPage_ReloadsItselfWithAuth0InsteadOfTheLoginPage', async () => {
    const router = renderPublicApp('/p/affitti-brevi');
    await screen.findByTestId('public-site-shell');

    await act(async () => {
      await router.navigate('/signup?comune=como&utm_source=seo-compliance');
    });

    expect(replace).toHaveBeenCalledWith('/signup?comune=como&utm_source=seo-compliance');
    expect(assign).not.toHaveBeenCalledWith('/login');
    expect(router.state.location.pathname).toBe('/signup');
  });

  it('ProtectedRouteReachedClientSide_FromAPublicPage_ReloadsInsteadOfAskingForASecondClick', async () => {
    const router = renderPublicApp('/p/affitti-brevi');
    await screen.findByTestId('public-site-shell');

    await act(async () => {
      await router.navigate('/app/short-rent/bookings');
    });

    expect(replace).toHaveBeenCalledWith('/app/short-rent/bookings');
    expect(router.state.location.pathname).toBe('/app/short-rent/bookings');
  });

  it('AccountInactivePageReachedClientSide_FromAPublicPage_ReloadsWithAuth0SoThatLogoutWorks', async () => {
    const router = renderPublicApp('/p/affitti-brevi');
    await screen.findByTestId('public-site-shell');

    await act(async () => {
      await router.navigate('/account-inactive');
    });

    // Without Auth0 the logout of the page would do nothing (PL-03).
    expect(replace).toHaveBeenCalledWith('/account-inactive');
    expect(router.state.location.pathname).toBe('/account-inactive');
  });
});
