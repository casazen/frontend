import { expect, test } from '@playwright/test';
import { loginViaAuth0 } from './helpers/auth';
import { requireE2eCredentials } from './helpers/env';

/**
 * Tenant Canoni against the web app whose API is the Railway test backend
 * (`E2E_STAGING=1`, default `https://casazen-api-test.up.railway.app/api`).
 * Missing login credentials fail this file. They are not stored in the repository.
 */
test.describe('Canoni del conduttore on the Railway test API', () => {
  test.beforeEach(() => {
    requireE2eCredentials();
  });

  test('the signed-in tenant opens Canoni and the path to pay', async ({ page }) => {
    test.setTimeout(180_000);
    try {
      await loginViaAuth0(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/E2E_AUTH0_EMAIL|E2E_AUTH0_PASSWORD|did not lead to Auth0|username field not visible|password field not visible/.test(message)) {
        throw new Error(
          `Login blocked. E2E_AUTH0_EMAIL and E2E_AUTH0_PASSWORD are not in the repository. ${message}`,
        );
      }
      throw error;
    }
    await page.goto('/portale-conduttore');
    await page.waitForLoadState('domcontentloaded');

    const contracts = page.getByTestId('tenant-contracts');
    const empty = page.getByTestId('tenant-no-contracts');
    const loadError = page.getByTestId('tenant-error');
    await expect(contracts.or(empty).or(loadError)).toBeVisible({ timeout: 45_000 });
    if (await loadError.isVisible()) {
      throw new Error('The tenant area did not load from the Railway test API.');
    }
    if (await empty.isVisible()) {
      await expect(empty).toContainText('Non hai un contratto attivo');
      return;
    }

    await page.getByRole('link', { name: 'Apri il contratto' }).first().click();
    await expect(page.getByTestId('tenant-contract')).toBeVisible();
    await expect(page.getByTestId('tenant-bank')).toHaveCount(0);

    const pay = page.getByRole('link', { name: 'Paga la scadenza' });
    const see = page.getByRole('link', { name: 'Vedi la scadenza' });
    if (await pay.isVisible()) {
      await pay.click();
    } else if (await see.isVisible()) {
      await see.click();
    } else {
      await expect(page.getByTestId('tenant-contract-no-payment')).toBeVisible();
      await page.getByRole('link', { name: 'Canoni' }).click();
      await expect(page.getByTestId('tenant-dues')).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: 'Canoni' })).toBeVisible();
    const detail = page.getByTestId('tenant-due-detail');
    if (!(await detail.isVisible())) {
      const next = page.getByRole('link', { name: 'Paga questa scadenza' });
      if (await next.isVisible()) await next.click();
      else await page.locator('[data-testid^="tenant-due-"]').first().click();
    }
    await expect(page.getByTestId('tenant-due-detail')).toBeVisible();

    const sepa = page.getByTestId('tenant-sepa');
    const manual = page.getByTestId('tenant-manual');
    const settled = page.getByTestId('tenant-due-settled');
    const foreign = page.getByTestId('tenant-sepa-unavailable');
    await expect(sepa.or(manual).or(settled).or(foreign)).toBeVisible();
    if (await sepa.isVisible()) {
      await expect(sepa).toContainText('euro');
      await expect(page.getByTestId('stripe-link-account')).toBeVisible();
    }
    if (await manual.isVisible()) {
      await expect(page.getByTestId('tenant-manual')).toContainText('Bonifico manuale');
    }
  });
});
