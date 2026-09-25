import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { SeoPagePublic, SeoPublishedPages } from '@/types/seo.types';
import { SeoHubPage } from './seo-hub-page';
import { ComplianceGuidePage } from './compliance-guide-page';
import { Footer } from '@/features/public-site/components/Footer';

/** SE-02 (A8-02): the hub lists the published pages, canonical URLs come only from the backend. */
const PUBLIC_SITE = 'https://public-site.example.test';

const state = vi.hoisted(() => ({
  hub: {} as { data?: SeoPublishedPages; isLoading: boolean; isError: boolean },
  refetch: vi.fn(),
  guide: null as SeoPagePublic | null,
}));

// Footer legal links come from the backend configuration (SE-03, D3): no domain in the frontend.
vi.mock('@/queries/use-legal', () => ({
  usePlatformLegalLinks: () => ({ privacyUrl: 'https://legal.example.test/privacy', termsUrl: undefined }),
}));

vi.mock('@/queries/use-public-seo', () => ({
  usePublishedSeoPages: () => ({ ...state.hub, refetch: state.refetch, isFetching: false }),
  useComplianceGuide: () => ({ data: state.guide, isLoading: false, isError: false }),
  useTouristTaxPage: () => ({ data: null, isLoading: false, isError: true }),
  useCalculateTouristTax: () => ({ mutateAsync: vi.fn(), data: undefined, isPending: false }),
}));

const HUB: SeoPublishedPages = {
  canonicalUrl: `${PUBLIC_SITE}/p/affitti-brevi`,
  pages: [
    {
      pageType: 'ComplianceGuide',
      title: 'Affitti brevi a Como: CIN e tassa di soggiorno',
      comuneName: 'Como',
      regionSlug: 'lombardia',
      comuneSlug: 'como',
      path: '/p/affitti-brevi/lombardia/como',
    },
    {
      pageType: 'TouristTaxCalc',
      title: 'Tassa di soggiorno a Como',
      comuneName: 'Como',
      regionSlug: 'lombardia',
      comuneSlug: 'como',
      path: '/p/tassa-soggiorno/como',
    },
  ],
};

function canonicalHref(): string | null {
  return document.head.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null;
}

function renderHub() {
  render(
    <MemoryRouter initialEntries={['/p/affitti-brevi']}>
      <Routes>
        <Route path="/p/affitti-brevi" element={<SeoHubPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
  state.hub = { data: HUB, isLoading: false, isError: false };
  state.guide = null;
});

afterEach(() => {
  cleanup();
  state.refetch.mockReset();
  document.head.querySelectorAll('link[rel="canonical"]').forEach((element) => element.remove());
});

describe('SeoHubPage', () => {
  it('SeoHubPage_PublishedPages_LinksEveryPageBySection', () => {
    renderHub();

    const guides = within(screen.getByTestId('seo-hub-guides'));
    expect(guides.getByRole('link', { name: HUB.pages[0].title })).toHaveAttribute('href', HUB.pages[0].path);
    const calculators = within(screen.getByTestId('seo-hub-calculators'));
    expect(calculators.getByRole('link', { name: HUB.pages[1].title })).toHaveAttribute('href', HUB.pages[1].path);
  });

  it('SeoHubPage_CanonicalFromBackend_IsSetOnThePublicDomain', () => {
    renderHub();

    expect(canonicalHref()).toBe(`${PUBLIC_SITE}/p/affitti-brevi`);
    expect(document.title).toBe(i18n.t('publicSeo.hub.metaTitle'));
  });

  it('SeoHubPage_BackendWithoutPublicUrl_SetsNoCanonical', () => {
    state.hub = { data: { ...HUB, canonicalUrl: null }, isLoading: false, isError: false };

    renderHub();

    expect(canonicalHref()).toBeNull();
  });

  it('SeoHubPage_Loading_ShowsSpinnerOnly', () => {
    state.hub = { data: undefined, isLoading: true, isError: false };

    renderHub();

    expect(screen.getByTestId('seo-hub-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('seo-hub-empty')).not.toBeInTheDocument();
  });

  it('SeoHubPage_ApiError_ShowsErrorWithRetryNotAnEmptyList', () => {
    state.hub = { data: undefined, isLoading: false, isError: true };

    renderHub();

    expect(screen.getByTestId('seo-hub-error')).toHaveTextContent(i18n.t('publicSeo.hub.loadError'));
    expect(screen.queryByTestId('seo-hub-empty')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('publicSeo.hub.retry') }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });

  it('SeoHubPage_NoPublishedPage_ShowsEmptyState', () => {
    state.hub = { data: { canonicalUrl: HUB.canonicalUrl, pages: [] }, isLoading: false, isError: false };

    renderHub();

    expect(screen.getByTestId('seo-hub-empty')).toHaveTextContent(i18n.t('publicSeo.hub.empty'));
    expect(screen.queryByTestId('seo-hub-guides')).not.toBeInTheDocument();
  });
});

describe('ComplianceGuidePage canonical', () => {
  it('ComplianceGuidePage_CanonicalFromBackend_IsUsedAsIs', () => {
    state.guide = {
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
      canonicalUrl: `${PUBLIC_SITE}/p/affitti-brevi/lombardia/como`,
      lastRefreshedAt: null,
      disclaimers: { lastUpdated: 'u', notLegalAdvice: 'n', aiGenerated: 'a' },
      cta: { signupUrl: 'https://example.test/signup?comune=como&utm_source=seo-compliance&utm_medium=cta' },
      touristTaxRates: [],
    };

    render(
      <MemoryRouter initialEntries={['/p/affitti-brevi/lombardia/como']}>
        <Routes>
          <Route path="/p/affitti-brevi/:region/:comune" element={<ComplianceGuidePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(canonicalHref()).toBe(`${PUBLIC_SITE}/p/affitti-brevi/lombardia/como`);
  });
});

describe('Footer hub link', () => {
  it('Footer_CasaZenPublicPages_LinksTheHub', () => {
    render(
      <MemoryRouter>
        <Footer displayName="CasaZen" showSeoHubLink />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('footer-seo-hub')).toHaveAttribute('href', '/p/affitti-brevi');
    expect(screen.getByTestId('footer-seo-hub')).toHaveTextContent(i18n.t('publicSite.seoHub'));
  });

  it('Footer_LegalLinks_UseTheConfiguredDocumentsAndHideTheMissingOnes', () => {
    render(
      <MemoryRouter>
        <Footer displayName="CasaZen" showSeoHubLink />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('footer-privacy')).toHaveAttribute('href', 'https://legal.example.test/privacy');
    // Terms not configured on the backend: no link to a page that does not exist.
    expect(screen.queryByTestId('footer-terms')).not.toBeInTheDocument();
    expect(document.querySelector('a[href*="casazen"]')).toBeNull();
  });

  it('Footer_HostBookingSite_DoesNotLinkTheHub', () => {
    render(
      <MemoryRouter>
        <Footer displayName="Villa Rosa" contactEmail="info@villa.test" />
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('footer-seo-hub')).not.toBeInTheDocument();
  });
});
