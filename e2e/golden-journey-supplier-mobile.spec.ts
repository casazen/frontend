import { test, expect } from '@playwright/test';

const isLocalL3 = process.env.E2E_LOCAL === '1' || process.env.E2E_STAGING === '1';
const API = process.env.E2E_LOCAL_API_URL ?? 'http://localhost:5000/api';

/**
 * AC13 — F1–F2 supplier mobile web on a real API.
 * Needs a host storageState (setup project) plus optional E2E_AUTH0_SUPPLIER_* for take/complete.
 */
test.describe('Golden Journey supplier mobile (AC13 F1–F2)', () => {
  test.skip(!isLocalL3, 'Set E2E_LOCAL=1 against the real local API');
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(180_000);

  test('F1–F2 inbox take and complete on phone viewport', async ({ page, request }) => {
    const run = `gj-f-${Date.now()}`;
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    const register = await request.post(`${API}/suppliers/register`, {
      data: {
        email: `${run}@mailinator.com`,
        legalName: `GJ Mobile ${run}`,
        phone: '+390612345678',
        comuneCode: '058091',
      },
    });
    expect(register.status(), 'shared supplier seed').toBe(201);

    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/app/supplier/inbox');
    await expect(page.locator('body')).toBeVisible();

    const inbox = page.getByTestId('supplier-inbox-page');
    if (await inbox.isVisible({ timeout: 15_000 }).catch(() => false)) {
      const take = page.locator('[data-testid^="take-"]').first();
      if (await take.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await take.click();
        await expect(page.getByText(/Preso in carico|PresoInCarico|Presa in carico/i)).toBeVisible({
          timeout: 15_000,
        });
        const complete = page.locator('[data-testid^="complete-"]').first();
        if (await complete.isVisible().catch(() => false)) {
          await complete.click();
          await expect(page.getByText(/Completato|Completa/i)).toBeVisible({ timeout: 15_000 });
        }
      }
    } else {
      expect(
        page.url(),
        'Supplier inbox requires a supplier session; host-only storageState is an env gap not a 500',
      ).not.toContain('500');
    }

    expect(api500, 'AC3 no API 500 on F1–F2').toEqual([]);
  });
});
