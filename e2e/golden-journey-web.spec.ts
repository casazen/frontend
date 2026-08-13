import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockPublicOrg,
} from './helpers/branded-booking-mock';
import { mockComplianceApi } from './helpers/compliance-mock';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

/**
 * Golden Journey web — Fase 0 batch (#301): host onboarding + branded booking.
 * Supplier tests consolidated into supplier-layout.spec.ts.
 */
test.describe('Golden Journey web (#301)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('GJ steps 3–4 sequential (demo mode)', async ({ page }) => {
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    // Step 3: host onboarding → consents → plan → short-rent
    await page.goto(demoUrl('/onboarding', 'onboarding'));
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
    await page.getByRole('button', { name: 'Scegli' }).first().click();

    const checkboxes = page.getByTestId('onboarding-consents-step').getByRole('checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByTestId('onboarding-consents-continue').click();

    await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
    await page.getByTestId('onboarding-plan-confirm').click();
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });

    // Step 4: guest public booking — branded shell
    await page.goto(demoUrl(`/book/${DEMO_ORG_SLUG}`, 'short-stay'), { waitUntil: 'networkidle' });
    await expect(page.getByTestId('public-site-shell')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('heading', { level: 1, name: mockPublicOrg.displayName, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible();

    expect(api500).toEqual([]);
  });

  test('GJ steps 5–7 host ops shell (calendar + marketplace + compliance)', async ({ page }) => {
    const property = buildCreatedProperty({ name: 'Villa GJ' });
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page);
    await mockPropertiesApi(page, [property]);
    await mockComplianceApi(page);
    await page.route('**/api/bookings/calendar**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], bookings: [] }),
      });
    });
    await page.route('**/api/bookings**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const url = route.request().url();
      if (url.includes('/calendar')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.route('**/api/suppliers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 0 }),
      });
    });

    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(demoUrl('/app/short-rent/bookings/calendar', 'short-stay'));
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 15_000 });

    await page.goto(demoUrl('/app/short-rent/marketplace', 'short-stay'));
    await expect(page.locator('body')).toBeVisible();

    await page.goto(demoUrl('/app/short-rent', 'short-stay'));
    await expect(page.getByTestId('compliance-summary-widget')).toBeVisible({ timeout: 15_000 });

    expect(api500).toEqual([]);
  });

  test('resolve-host API mock: subdomain maps to org branding (#288)', async ({ page }) => {
    await page.route('**/api/public/resolve-host**', async (route) => {
      const url = new URL(route.request().url());
      const host = url.searchParams.get('host');
      if (host === `${DEMO_ORG_SLUG}.casazen.it`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: '11111111-1111-1111-1111-111111111101',
            slug: DEMO_ORG_SLUG,
            publicHostMode: 'CasazenSubdomain',
            branding: mockPublicOrg,
          }),
        });
        return;
      }
      await route.fulfill({ status: 404, body: '{}' });
    });

    await page.goto(demoUrl('/', 'short-stay'));
    const result = await page.evaluate(async (slug) => {
      const res = await fetch(`/api/public/resolve-host?host=${slug}.casazen.it`);
      return { status: res.status, slug: (await res.json()).slug as string };
    }, DEMO_ORG_SLUG);

    expect(result.status).toBe(200);
    expect(result.slug).toBe(DEMO_ORG_SLUG);
  });
});
