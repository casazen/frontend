import { test, expect } from '@playwright/test';
import { loginViaAuth0, waitForAppReady } from './helpers/auth';
import { requireE2eCredentials } from './helpers/env';

const PROD_FE_URL =
  process.env.E2E_PROD_FE_URL ?? 'https://casazen-app.vercel.app';

const PROD_API =
  process.env.E2E_PROD_API_URL ?? 'https://casazen-api.up.railway.app/api';

const PROTECTED_ENDPOINTS = [
  '/properties',
  '/bookings',
  '/users/me',
  '/me/contexts',
  '/orgs/me/entitlement',
] as const;

/**
 * Full-stack production smoke — login on the deployed Vercel Production URL and
 * verify authenticated API calls hit Railway production (not test).
 *
 * Run after push to main:
 *   E2E_PROD_SMOKE=1 npm run test:e2e -- prod-deploy-smoke
 */
test.describe('Production deploy smoke (Vercel FE + Railway prod API)', () => {
  test.skip(!process.env.E2E_PROD_SMOKE, 'Set E2E_PROD_SMOKE=1 for live production checks');
  test.setTimeout(180_000);

  test.beforeEach(() => {
    requireE2eCredentials();
  });

  test('prod bundle targets production API (not test)', async ({ page }) => {
    await page.goto(PROD_FE_URL, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    const scriptMatch = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
    expect(scriptMatch, 'main JS bundle must be referenced').toBeTruthy();

    const jsUrl = `${PROD_FE_URL}${scriptMatch![1]}`;
    const jsResponse = await page.request.get(jsUrl);
    expect(jsResponse.ok()).toBeTruthy();
    const js = await jsResponse.text();

    expect(js, 'production bundle must not reference test API host').not.toContain(
      'casazen-api-test',
    );
    expect(js, 'production bundle must reference prod API host').toContain(
      'casazen-api.up.railway',
    );
  });

  test('authenticated session on prod FE reaches prod API without 401/500', async ({
    page,
  }) => {
    const apiFailures: string[] = [];
    page.on('response', (res) => {
      if (!res.url().includes('/api/')) return;
      if (res.status() === 401 || res.status() >= 500) {
        apiFailures.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(`${PROD_FE_URL}/login`);
    await loginViaAuth0(page);
    await waitForAppReady(page);

    const token = await page.evaluate(() => {
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
    expect(token, 'Auth0 access token must be present on production FE').toBeTruthy();

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
      { apiBase: PROD_API, paths: [...PROTECTED_ENDPOINTS], bearer: token! },
    );

    for (const path of PROTECTED_ENDPOINTS) {
      const status = results[path];
      expect(status, `${path} must not return 500 on prod`).not.toBe(500);
      expect(status, `${path} must not return 401 when authenticated on prod`).not.toBe(401);
    }

    expect(
      apiFailures,
      `API failures during prod FE session: ${apiFailures.join(', ')}`,
    ).toHaveLength(0);
  });
});
