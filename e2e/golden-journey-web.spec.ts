import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPlansCatalog } from './helpers/org-api-mock';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgPropertyId,
  mockPublicOrg,
} from './helpers/branded-booking-mock';

/**
 * Golden Journey web — Fase 0 batch (#301).
 * Single sequential demo run for steps 1–4; steps 5–12 remain Fase 1.
 */
test.describe('Golden Journey web (#301)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
    });
  });

  test('GJ steps 1–4 sequential (demo mode)', async ({ page }) => {
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    // Step 1–2: supplier path — auth gate (no admin in demo)
    await page.goto(demoUrl('/admin/users', 'short-stay'));
    await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 10_000 });

    // Step 3: host onboarding → short-rent
    await page.goto(demoUrl('/onboarding', 'onboarding'));
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
    await page.getByRole('button', { name: 'Scegli' }).first().click();
    await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
    await page.getByTestId('onboarding-plan-confirm').click();
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });

    // Step 4: guest public booking — branded shell
    await page.goto(demoUrl(`/book/${DEMO_ORG_SLUG}`, 'short-stay'), { waitUntil: 'networkidle' });
    await expect(page.getByTestId('public-booking-shell')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('heading', { level: 1, name: mockPublicOrg.displayName, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible();

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

  test.fixme('GJ-5: calendar + iCal blocks — Fase 1', async () => {});
  test.fixme('GJ-6: guest check-in — Fase 1', async () => {});
  test.fixme('GJ-7–12: service loop + checkout — Fase 1', async () => {});
});
