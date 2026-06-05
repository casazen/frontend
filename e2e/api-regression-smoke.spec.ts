import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from './helpers/env';

const STAGING_API =
  process.env.E2E_STAGING_API_URL ?? 'https://casazen-api-test.up.railway.app/api';

const PROTECTED_ENDPOINTS = [
  '/properties',
  '/bookings',
  '/users/me',
  '/me/contexts',
] as const;

/**
 * Live API regression — authenticated requests must never return 500.
 * Catches missing EF migrations and schema drift on Railway test/prod.
 *
 * Run: E2E_STAGING=1 npm run test:e2e -- api-regression-smoke
 */
test.describe('API regression smoke (live Railway)', () => {
  test.skip(!process.env.E2E_STAGING, 'Set E2E_STAGING=1 to run live API regression');
  test.setTimeout(120_000);

  test.beforeEach(() => {
    requireE2eCredentials();
  });

  async function getAccessToken(page: import('@playwright/test').Page): Promise<string | null> {
    return page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (!key.includes('auth0spajs')) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
          const token = parsed?.body?.access_token;
          if (typeof token === 'string') return token;
        } catch {
          // continue
        }
      }
      return null;
    });
  }

  test('authenticated core endpoints never return 500', async ({ page }) => {
    await page.goto('/app/short-rent');
    await expect(page.locator('body')).toBeVisible({ timeout: 60_000 });

    const token = await getAccessToken(page);
    expect(token, 'Auth0 access token must be present after login').toBeTruthy();

    const results = await page.evaluate(
      async ({ apiBase, paths, bearer }) => {
        const out: Record<string, number> = {};
        for (const path of paths) {
          const res = await fetch(`${apiBase}${path}`, {
            headers: { Authorization: `Bearer ${bearer}` },
          });
          out[path] = res.status;
        }
        return out;
      },
      { apiBase: STAGING_API, paths: [...PROTECTED_ENDPOINTS], bearer: token! },
    );

    for (const path of PROTECTED_ENDPOINTS) {
      const status = results[path];
      expect(status, `${path} must not return 500 (likely pending EF migration)`).not.toBe(500);
      expect(status, `${path} should be reachable when authenticated`).toBeGreaterThanOrEqual(200);
      expect(status, `${path} should not be 401 when authenticated`).not.toBe(401);
    }
  });
});
