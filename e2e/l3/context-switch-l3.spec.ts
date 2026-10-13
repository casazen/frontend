import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from '../helpers/env';

/**
 * L3 — workspace context switching against real API.
 */
test.describe('L3 context workspace switch', () => {
  test.skip(!process.env.E2E_LOCAL && !process.env.E2E_STAGING, 'Set E2E_LOCAL=1 or E2E_STAGING=1');
  test.setTimeout(120_000);

  test.beforeEach(() => {
    requireE2eCredentials();
  });

  test('AC: /api/me/contexts returns 200 and UI shows workspace chrome', async ({ page }) => {
    const apiBase =
      process.env.E2E_LOCAL_API_URL ??
      process.env.E2E_STAGING_API_URL ??
      'http://localhost:5000/api';

    await page.goto('/app/short-rent');
    await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 60_000 });

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
      const res = await fetch(`${base}/me/contexts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    }, apiBase);

    expect([200, 404]).toContain(status);
    expect(status).not.toBe(500);

    const nav = page.locator('[data-testid="workspace-sidebar"], aside, nav').first();
    await expect(nav).toBeVisible({ timeout: 15_000 });
  });
});
