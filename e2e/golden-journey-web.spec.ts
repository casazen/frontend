import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPlansCatalog } from './helpers/org-api-mock';
import {
  GJ_SLUG,
  installGoldenJourneyApiMocks,
} from './helpers/golden-journey-mock';

/**
 * Golden Journey web harness — Fase 0 skeleton (steps 1–4).
 * Steps 5–12 are test.fixme until Fase 1 features land (#301).
 * @see Sessions/specs/spec-golden-journey-e2e.md
 */
test.describe('Golden Journey web (#301 / #286)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
    await installGoldenJourneyApiMocks(page);
  });

  test('GJ-1: supplier onboarding entry (admin path stub)', async ({ page }) => {
    await page.goto(demoUrl('/admin/users', 'short-stay'));
    // Demo user lacks admin — verify auth gate, no 500
    await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 10_000 });
  });

  test('GJ-2: supplier activation wizard reachable (demo stub)', async ({ page }) => {
    await page.route('**/api/me/contexts**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          contexts: [{ type: 'supplier', orgId: 'cccccccc-cccc-cccc-cccc-ccccccccccc1', status: 'Pending' }],
        }),
      });
    });

    await page.goto(demoUrl('/app/supplier/onboarding', 'short-stay'));
    // Page may redirect if route not fully wired — assert no server error surface
    await expect(page.locator('#root')).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase()).not.toContain('internal server error');
  });

  test('GJ-3: host onboarding → short-rent home', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
    await page.getByRole('button', { name: 'Scegli' }).first().click();
    await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
    await page.getByTestId('onboarding-plan-confirm').click();
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
  });

  test('GJ-4: guest public booking page loads without API 500', async ({ page }) => {
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(demoUrl(`/book/${GJ_SLUG}`, 'short-stay'), { waitUntil: 'networkidle' });
    await expect(page.locator('#root')).toBeVisible();
    expect(api500).toEqual([]);
  });

  test.fixme('GJ-5: calendar shows booking + iCal blocks — Fase 1', async () => {});
  test.fixme('GJ-6: guest check-in + Alloggiati — Fase 1', async () => {});
  test.fixme('GJ-7: host service request — Fase 1', async () => {});
  test.fixme('GJ-8: supplier presa in carico — Fase 1', async () => {});
  test.fixme('GJ-9: supplier completato — Fase 1', async () => {});
  test.fixme('GJ-10: host payment — Fase 1', async () => {});
  test.fixme('GJ-11: checkout wizard — Fase 1', async () => {});
  test.fixme('GJ-12: cockpit green — Fase 1', async () => {});
});
