import type { Page } from '@playwright/test';
import type {
  PlatformAiBudget,
  PublicTouristTaxCalculateResponse,
  SeoGenerateAccepted,
  SeoPagePublic,
  SeoPagesPagedResult,
} from '../../src/types/seo.types';

export const demoComplianceGuidePage: SeoPagePublic = {
  id: '11111111-1111-1111-1111-111111111111',
  pageType: 'ComplianceGuide',
  title: 'Affitti brevi a Como: CIN e tassa di soggiorno',
  metaDescription: 'Guida aggiornata per host di affitti brevi a Como.',
  bodyHtml: '<article><p>Guida compliance Como con CIN e Alloggiati Web.</p></article>',
  comuneName: 'Como',
  comuneCode: '013075',
  regionCode: 'LOM',
  regionSlug: 'lombardia',
  comuneSlug: 'como',
  canonicalUrl: 'https://www.casazen.it/p/affitti-brevi/lombardia/como',
  lastRefreshedAt: '2026-06-01T12:00:00Z',
  disclaimers: {
    lastUpdated: 'Ultimo aggiornamento: 1 giugno 2026',
    notLegalAdvice:
      "Informazione generale, non consulenza legale. L'host resta responsabile degli adempimenti.",
    aiGenerated: 'Contenuto generato con AI — verifica le fonti ufficiali',
  },
  cta: {
    complianceCheckerUrl: '/tools/verifica-conformita?comune=como&utm_source=seo-compliance',
    signupUrl: '/signup?utm_source=seo-compliance&utm_medium=cta',
  },
  touristTaxRate: {
    ratePerPersonPerNight: 2.5,
    maxNights: 4,
    minimumAge: 14,
    city: 'Como',
  },
};

export const demoTouristTaxPage: SeoPagePublic = {
  ...demoComplianceGuidePage,
  id: '22222222-2222-2222-2222-222222222222',
  pageType: 'TouristTaxCalc',
  title: 'Tassa di soggiorno a Como',
  metaDescription: 'Calcola la tassa di soggiorno a Como con le tariffe ufficiali del comune.',
  bodyHtml: '<article><p>Informazioni sulla tassa di soggiorno a Como.</p></article>',
  canonicalUrl: 'https://www.casazen.it/p/tassa-soggiorno/como',
};

export const demoTouristTaxCalculation: PublicTouristTaxCalculateResponse = {
  comuneSlug: 'como',
  city: 'Como',
  taxAmount: 20,
  numberOfAdults: 2,
  numberOfChildren: 0,
  nights: 4,
  ratePerPersonPerNight: 2.5,
  maxNightsApplied: 4,
  checkInDate: '2026-07-01',
  checkOutDate: '2026-07-05',
  disclaimer: 'Stima indicativa basata sulle tariffe comunali ufficiali.',
};

export const demoSeoPages: SeoPagesPagedResult = {
  items: [
    {
      id: demoComplianceGuidePage.id,
      slug: 'affitti-brevi/lombardia/como',
      comuneCode: '013075',
      comuneName: 'Como',
      regionCode: 'LOM',
      regionSlug: 'lombardia',
      pageType: 'ComplianceGuide',
      title: demoComplianceGuidePage.title,
      legalReviewStatus: 'Reviewed',
      publishedAt: '2026-06-01T12:00:00Z',
      lastRefreshedAt: '2026-06-01T12:00:00Z',
      latestRevision: {
        generatedAt: '2026-06-01T12:00:00Z',
        aiModelTier: 'Economy',
        promptTokens: 100,
        sourceDataVersion: 'test-v1',
      },
    },
    {
      id: demoTouristTaxPage.id,
      slug: 'tassa-soggiorno/como',
      comuneCode: '013075',
      comuneName: 'Como',
      regionCode: 'LOM',
      regionSlug: 'lombardia',
      pageType: 'TouristTaxCalc',
      title: demoTouristTaxPage.title,
      legalReviewStatus: 'Draft',
      publishedAt: null,
      lastRefreshedAt: '2026-06-01T12:00:00Z',
      latestRevision: null,
    },
  ],
  totalCount: 2,
  page: 1,
  pageSize: 50,
};

export const demoPlatformAiBudget: PlatformAiBudget = {
  monthlyTokenCap: 1_000_000,
  tokensUsedThisMonth: 42_000,
  lastResetAt: '2026-06-01T00:00:00Z',
};

export const demoSeoGenerateAccepted: SeoGenerateAccepted = {
  jobId: 'job-e2e-seo-001',
  enqueuedAt: '2026-06-11T12:00:00Z',
  comuneCount: 1,
  estimatedPages: 2,
};

export async function mockComplianceSeoApi(page: Page): Promise<void> {
  await page.route('**/api/public/content/affitti-brevi/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoComplianceGuidePage),
    });
  });

  await page.route('**/api/public/content/tassa-soggiorno/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoTouristTaxPage),
    });
  });

  await page.route('**/api/public/tourist-tax/calculate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoTouristTaxCalculation),
    });
  });

  await page.route('**/api/admin/seo/pages**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoSeoPages),
    });
  });

  await page.route('**/api/admin/seo/budget', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(demoPlatformAiBudget),
    });
  });

  await page.route('**/api/admin/seo/generate', async (route) => {
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify(demoSeoGenerateAccepted),
    });
  });
}
