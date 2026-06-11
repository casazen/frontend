import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import {
  demoComplianceGuidePage,
  demoSeoGenerateAccepted,
  demoTouristTaxCalculation,
  mockComplianceSeoApi,
} from './helpers/compliance-seo-mock';

test.describe('Programmatic Compliance SEO (#258)', () => {
  test.beforeEach(async ({ page }) => {
    await mockComplianceSeoApi(page);
  });

  test('AC11: compliance guide renders disclaimers, tax widget embed, and CTA', async ({ page }) => {
    await page.goto('/p/affitti-brevi/lombardia/como');

    await expect(page.getByTestId('compliance-guide-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: demoComplianceGuidePage.title })).toBeVisible();
    await expect(page.getByTestId('compliance-guide-body')).toBeVisible();
    await expect(page.getByTestId('seo-disclaimer-footer')).toContainText('non consulenza legale');
    await expect(page.getByTestId('seo-disclaimer-footer')).toContainText('Contenuto generato con AI');
    await expect(page.getByTestId('tourist-tax-calculator-widget')).toBeVisible();
    await expect(page.getByTestId('seo-cta-block')).toBeVisible();
    await expect(page.getByTestId('seo-cta-checker')).toBeVisible();
    await expect(page.getByTestId('seo-cta-signup')).toBeVisible();
  });

  test('AC12: tourist tax widget calculates from API without Authorization header', async ({ page }) => {
    let authHeader: string | undefined;

    await page.route('**/api/public/tourist-tax/calculate', async (route) => {
      authHeader = route.request().headers()['authorization'];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(demoTouristTaxCalculation),
      });
    });

    await page.goto('/p/tassa-soggiorno/como');

    await expect(page.getByTestId('tourist-tax-calculator-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('tourist-tax-rate-summary')).toContainText('2,50');

    await page.getByTestId('tax-calculate-button').click();

    await expect(page.getByTestId('tax-calculation-result')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('tax-calculation-result')).toContainText('20,00');
    expect(authHeader).toBeUndefined();
  });

  test('AC13: admin SEO dashboard lists pages and Rigenera triggers generate job', async ({ page }) => {
    let generateCalled = false;

    await page.route('**/api/admin/seo/generate', async (route) => {
      generateCalled = true;
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify(demoSeoGenerateAccepted),
      });
    });

    await page.goto(demoUrl('/app/admin/seo', 'admin'));

    await expect(page.getByTestId('seo-dashboard-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('seo-pages-table')).toBeVisible();
    await expect(page.getByTestId(`seo-page-row-${demoComplianceGuidePage.id}`)).toContainText('Como');
    await expect(page.getByTestId('seo-review-status-reviewed')).toBeVisible();
    await expect(page.getByTestId('seo-review-status-draft')).toBeVisible();
    await expect(page.getByTestId('seo-ai-budget-card')).toBeVisible();

    await page.getByTestId('seo-regenerate-button').click();
    await expect(page.getByTestId('seo-regenerate-dialog')).toBeVisible();
    await page.getByTestId('seo-regenerate-confirm').click();

    await expect.poll(() => generateCalled).toBe(true);
  });
});
