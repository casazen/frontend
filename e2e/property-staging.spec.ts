import { test, expect } from '@playwright/test';
import { requireE2eCredentials } from './helpers/env';
import { pinE2eLocale } from './helpers/locale';
import { fillPropertyWizard } from './helpers/properties-api-mock';

// Exercise the real API through the same proxy used by the staging UI, without bypassing CORS.
const STAGING_API = '/api';

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
    const runId = Date.now();
    const uniqueName = `E2E Staging ${runId}`;
    // The staging org keeps every property the earlier runs created, and the API refuses a second active property at the same
    // address and unit (409 duplicate_property_address): each run takes a street number of its own.
    const uniqueAddress = `Via Milano ${(runId % 99_000) + 1}`;

    await page.getByTestId('property-add').click();
    await expect(page.getByRole('heading', { level: 1, name: /^(Add property|Aggiungi immobile)$/ })).toBeVisible();

    // «Aggiungi immobile» (SR-07b): the property is created by the first «Continua».
    const planAlert = page.getByTestId('plan-limit-alert');
    const nextButton = page.getByTestId('property-wizard-next');
    await expect.poll(async () => await planAlert.isVisible() || await nextButton.isEnabled()).toBe(true);
    if (await planAlert.isVisible()) {
      await expect(nextButton).toBeDisabled();
      await page.goto(PROPERTIES_PATH);
      await page.locator('table tbody tr').first().getByRole('button').first().click();
    } else {
      await fillPropertyWizard(page, {
        name: uniqueName,
        address: uniqueAddress,
        comune: 'Milano',
        postalCode: '20100',
      });

      const createResponse = page.waitForResponse(
        (res) => res.url().includes('/api/properties') && res.request().method() === 'POST',
        { timeout: 30_000 },
      );

      await nextButton.click();
      const response = await createResponse;

      expect(response.status(), 'Property create must not return 500').not.toBe(500);

      if (response.status() === 403 || response.status() === 409) {
        const body = (await response.json().catch(() => ({}))) as { code?: string };
        expect(
          body.code,
          '403/409 on create must be plan_limit_reached, not a schema failure',
        ).toBe('plan_limit_reached');
        await expect(
          page.getByText(/Hai raggiunto il limite del tuo piano|You have reached your plan limit/i).first(),
        ).toBeVisible();
        await page.goto(PROPERTIES_PATH);
        await page.locator('table tbody tr').first().getByRole('button').first().click();
      } else {
        expect(response.status()).toBe(201);
        // The property exists from here: «Salva e chiudi» leaves the wizard and the list has it.
        await page.getByTestId('property-wizard-save-close').click();
        await expect(page.getByRole('button', { name: uniqueName, exact: true })).toBeVisible({ timeout: 15_000 });
        await page.getByRole('button', { name: uniqueName, exact: true }).click();
      }
    }
    await page.getByRole('link', { name: /^(Apri la scheda completa|Open full page)$/ }).click();

    await expect(page.getByRole('heading', { name: /^(Dati dell'immobile|Property details)$/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('tab', { name: /^(Documenti e adempimenti|Documents and compliance)$/ })).toBeVisible();
  });
});
