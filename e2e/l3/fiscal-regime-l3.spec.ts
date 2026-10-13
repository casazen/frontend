import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from '../helpers/env';

/**
 * L3 — real API. Do not page.route mock /api/fiscal.
 * Run: E2E_LOCAL=1 npm run test:e2e -- fiscal-regime-l3
 */
test.describe('L3 fiscal regime 2026 (#3)', () => {
  test.skip(!process.env.E2E_LOCAL && !process.env.E2E_STAGING, 'Set E2E_LOCAL=1 or E2E_STAGING=1');
  test.setTimeout(120_000);

  test('AC1: GET /api/fiscal/regime returns 200 and disclaimer', async ({ page }) => {
    requireE2eCredentials();
    await page.goto('/app/short-rent/fiscal');
    await expect(page.getByTestId('fiscal-dashboard-page')).toBeVisible({ timeout: 60_000 });

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
      const res = await fetch(`${base}/fiscal/regime?taxYear=2026`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    }, apiBase);

    expect(status).toBe(200);
    await expect(page.getByTestId('fiscal-disclaimer')).toBeVisible();
  });
});
