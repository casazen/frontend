import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from './helpers/env';

const STAGING_API =
  process.env.E2E_STAGING_API_URL ?? 'https://casazen-api-test.up.railway.app/api';

const PROPERTIES_PATH = '/app/short-rent/properties';

/**
 * Live staging smoke — real Auth0 + real Railway test API.
 * Run locally: E2E_STAGING=1 npm run test:e2e -- property-staging
 * Requires .env.e2e with E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD.
 */
test.describe('Property flow on staging API (live)', () => {
  test.skip(!process.env.E2E_STAGING, 'Set E2E_STAGING=1 to run live staging tests');
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    requireE2eCredentials();
    await page.goto(PROPERTIES_PATH);
    await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible({ timeout: 60_000 });
  });

  test('GET /api/properties returns 200 with Bearer token (not 500)', async ({ page }) => {
    const status = await page.evaluate(async (apiBase) => {
      let token: string | null = null;
      for (const key of Object.keys(localStorage)) {
        if (!key.includes('auth0spajs')) continue;
        try {
          const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
          token = parsed?.body?.access_token ?? null;
          if (token) break;
        } catch {
          // continue
        }
      }
      if (!token) return 0;
      const res = await fetch(`${apiBase}/properties`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    }, STAGING_API);

    expect(status, 'Staging /api/properties must not return 500').not.toBe(500);
    expect(status).toBe(200);
  });

  test('creates a property via UI and opens its detail page', async ({ page }) => {
    const uniqueName = `E2E Staging ${Date.now()}`;

    const addButton = page.getByRole('button', { name: /Add (Your First )?Property/i });
    await addButton.first().click();
    await expect(page.getByRole('heading', { name: 'Add New Property' })).toBeVisible();

    await page.getByLabel('Property Name *').fill(uniqueName);
    await page.getByLabel('Description *').fill('Proprietà creata dal test E2E staging live.');
    await page.getByLabel('Address *').fill('Via Milano 5');
    await page.getByLabel('City *').fill('Milano');
    await page.getByLabel('Country *').fill('IT');
    await page.getByLabel('ZIP Code *').fill('20100');
    await page.getByLabel('Bedrooms *').fill('2');
    await page.getByLabel('Bathrooms *').fill('1');
    await page.getByLabel('Max Guests *').fill('4');
    await page.getByLabel('Price per Night *').fill('99');

    const createResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/properties') &&
        res.request().method() === 'POST' &&
        res.status() !== 500,
      { timeout: 30_000 },
    );

    await page.getByRole('button', { name: 'Create Property' }).click();
    const response = await createResponse;

    expect(response.status(), 'Property create must not return 500').toBe(201);

    await expect(page.getByRole('link', { name: uniqueName })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: uniqueName }).click();

    await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dettagli proprietà' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documenti' })).toBeVisible();
  });
});
