import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from '../helpers/env';

/**
 * L3 — real API (local InMemory or staging). No page.route mocks on /api/properties.
 * Run: npm run test:e2e:local   or   E2E_STAGING=1 npm run test:e2e:staging-gj
 */
test.describe('L3 properties & health', () => {
  test.skip(!process.env.E2E_LOCAL && !process.env.E2E_STAGING, 'Set E2E_LOCAL=1 or E2E_STAGING=1');
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    requireE2eCredentials();
    await page.goto('/app/short-rent/properties');
    await expect(page.getByRole('heading', { name: /Properties|Immobili/i })).toBeVisible({
      timeout: 60_000,
    });
  });

  test('AC: authenticated GET /api/properties returns 200 (not 500)', async ({ page }) => {
    const apiBase =
      process.env.E2E_LOCAL_API_URL ??
      process.env.E2E_STAGING_API_URL ??
      'http://localhost:5000/api';

    const status = await page.evaluate(async (base) => {
      let token: string | null = null;
      for (const key of Object.keys(localStorage)) {
        if (!key.includes('auth0spajs')) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
          token = parsed?.body?.access_token ?? null;
          if (token) break;
        } catch {
          /* continue */
        }
      }
      if (!token) return 0;
      const res = await fetch(`${base}/properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    }, apiBase);

    expect(status, 'GET /api/properties must succeed').toBe(200);
  });

  test('AC: short-rent dashboard loads without API 500 storm', async ({ page }) => {
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto('/app/short-rent');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 30_000 });
    expect(api500, 'No API 500 on dashboard').toEqual([]);
  });
});
