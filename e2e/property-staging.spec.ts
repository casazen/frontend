import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from './helpers/env';
import { pinE2eLocale } from './helpers/locale';
import { fillPropertyForm } from './helpers/properties-api-mock';

const STAGING_API =
  process.env.E2E_STAGING_API_URL ?? 'https://casazen-api-test.up.railway.app/api';

const PROPERTIES_PATH = '/app/short-rent/properties';

/**
 * Live staging smoke — real Auth0 + real Railway test API.
 * Run locally: E2E_STAGING=1 npm run test:e2e -- --project=staging
 * Requires .env.e2e with E2E_AUTH0_EMAIL / E2E_AUTH0_PASSWORD.
 *
 * Product default locale is Italian (`Immobili`). Pin it and keep EN aliases so a stored `en` locale still matches.
 */
test.describe('Property flow on staging API (live)', () => {
  test.skip(!process.env.E2E_STAGING, 'Set E2E_STAGING=1 to run live staging tests');
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    requireE2eCredentials();
    await pinE2eLocale(page, 'it');
    await page.goto(PROPERTIES_PATH);
    await expect(page.getByRole('heading', { name: /^(Properties|Immobili)$/ })).toBeVisible({
      timeout: 60_000,
    });
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

    await page.getByRole('button', { name: /^(Add (Your First )?Property|Aggiungi (il primo )?immobile)$/i }).click();
    await expect(page.getByRole('heading', { name: /^(Add New Property|Nuovo immobile)$/ })).toBeVisible();

    await fillPropertyForm(page, {
      name: uniqueName,
      description: 'Proprietà creata dal test E2E staging live.',
      address: 'Via Milano 5',
      comune: 'Milano',
      postalCode: '20100',
      bedrooms: 2,
      bathrooms: 1,
      maxGuests: 4,
      nightlyRate: 99,
    });

    const createResponse = page.waitForResponse(
      (res) => res.url().includes('/api/properties') && res.request().method() === 'POST',
      { timeout: 30_000 },
    );

    await page.getByRole('button', { name: /^(Create Property|Crea immobile)$/ }).click();
    const response = await createResponse;

    expect(response.status(), 'Property create must not return 500').not.toBe(500);

    if (response.status() === 403 || response.status() === 409) {
      const body = (await response.json().catch(() => ({}))) as { code?: string };
      expect(
        body.code,
        '403/409 on create must be plan_limit_reached, not a schema failure',
      ).toBe('plan_limit_reached');
      await expect(
        page.getByText(/Hai raggiunto il limite del tuo piano|You have reached your plan limit/i),
      ).toBeVisible();
      await page.getByRole('button', { name: /^(Cancel|Annulla)$/ }).click();
      await page.locator('table tbody tr').first().getByRole('link').first().click();
    } else {
      expect(response.status()).toBe(201);
      await expect(page.getByRole('link', { name: uniqueName })).toBeVisible({ timeout: 15_000 });
      await page.getByRole('link', { name: uniqueName }).click();
      await expect(page.getByRole('heading', { name: uniqueName })).toBeVisible({ timeout: 15_000 });
    }

    await expect(page.getByRole('heading', { name: /^(Dettagli proprietà|Property details)$/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: /^(Documenti|Documents)$/ })).toBeVisible();
  });
});
