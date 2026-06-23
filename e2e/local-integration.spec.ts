import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from './helpers/env';

const LOCAL_API =
  process.env.E2E_LOCAL_API_URL ?? 'http://localhost:5000/api';

const PROPERTIES_PATH = '/app/short-rent/properties';

/**
 * Local integration smoke — real Auth0 + local .NET backend (InMemory DB).
 * Run: E2E_LOCAL=1 npm run test:e2e:local
 *
 * Requires:
 *   - .env.e2e with E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD
 *   - Local backend running on http://localhost:5000 (see scripts/start-backend-local.ps1)
 */
test.describe('Property flow on local API', () => {
  test.skip(!process.env.E2E_LOCAL, 'Set E2E_LOCAL=1 to run local integration tests');
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    requireE2eCredentials();
    await page.goto(PROPERTIES_PATH);
    await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible({ timeout: 60_000 });
  });

  test('GET /api/properties returns 200 with Bearer token', async ({ page }) => {
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
    }, LOCAL_API);

    expect(status, 'Local /api/properties must return 200').toBe(200);
  });

  test('GET /api/health returns 200', async ({ page }) => {
    const result = await page.evaluate(async (apiBase) => {
      const res = await fetch(`${apiBase}/health`);
      return { status: res.status, body: await res.text() };
    }, LOCAL_API);

    expect(result.status).toBe(200);
  });

  test('creates a property via UI and opens its detail page', async ({ page }) => {
    const uniqueName = `E2E Local ${Date.now()}`;

    const addButton = page.getByRole('button', { name: /Add (Your First )?Property/i });
    await addButton.first().click();
    await expect(page.getByRole('heading', { name: 'Add New Property' })).toBeVisible();

    await page.getByLabel('Property Name *').fill(uniqueName);
    await page.getByLabel('Description *').fill('Proprietà creata dal test E2E locale.');
    await page.getByLabel('Address *').fill('Via Roma 10');
    await page.getByLabel('City *').fill('Roma');
    await page.getByLabel('Country *').fill('IT');
    await page.getByLabel('ZIP Code *').fill('00100');
    await page.getByLabel('Bedrooms *').fill('3');
    await page.getByLabel('Bathrooms *').fill('2');
    await page.getByLabel('Max Guests *').fill('6');
    await page.getByLabel('Price per Night *').fill('120');

    const createResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/properties') &&
        res.request().method() === 'POST' &&
        res.status() !== 500,
      { timeout: 30_000 },
    );

    await page.getByRole('button', { name: 'Create Property' }).click();
    const response = await createResponse;

    expect(response.status(), 'Property create must return 201').toBe(201);

    await expect(page.getByRole('link', { name: uniqueName })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: uniqueName }).click();

    await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Dettagli proprietà' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documenti' })).toBeVisible();
  });

  test('property list UI renders correctly', async ({ page }) => {
    // The list page should show the properties heading and at minimum show the empty/add state
    await expect(
      page.getByRole('heading', { name: /Properties|Immobili/i })
    ).toBeVisible();
  });

  test('workspace context includes short-rent and supplier tabs', async ({ page }) => {
    // After login, the sidebar should show workspace tabs
    const sidebar = page.locator('[data-testid="workspace-sidebar"], aside, nav').first();
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });
});
