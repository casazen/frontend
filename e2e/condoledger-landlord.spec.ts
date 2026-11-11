import { expect, test, type Page } from '@playwright/test';
import { loginViaAuth0 } from './helpers/auth';
import { pinE2eLocale } from './helpers/locale';

/**
 * Landlord CondoLedger on the web app pointed at the Railway test API
 * (`E2E_STAGING_API_URL`, default https://casazen-api-test.up.railway.app/api).
 * Run: E2E_CONDOLEDGER=1 npx playwright test e2e/condoledger-landlord.spec.ts
 * Missing login configuration fails this test. It is not a skip and not a component test.
 */
const REQUIRED = ['E2E_AUTH0_EMAIL', 'E2E_AUTH0_PASSWORD', 'VITE_AUTH0_DOMAIN', 'VITE_AUTH0_CLIENT_ID'] as const;

test.describe('CondoLedger landlord on the test app', () => {
  test.setTimeout(180_000);

  test('wizard, documents, and payments', async ({ page }) => {
    const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) {
      throw new Error(
        `Login blocked: ${missing.join(', ')} are not in the repo or this environment. ` +
          'The suite uses the test API https://casazen-api-test.up.railway.app and does not invent a user.',
      );
    }

    await pinE2eLocale(page, 'it');
    await loginViaAuth0(page);
    await page.goto('/app/long-rent/leases');
    await expect(page.getByRole('heading', { name: 'Contratti' })).toBeVisible({ timeout: 60_000 });

    await openCondominiumStep(page);
    const leaseId = await exerciseDocuments(page);
    await exercisePayments(page, leaseId);
  });
});

async function openCondominiumStep(page: Page): Promise<void> {
  await page.goto('/app/long-rent/leases/new?tipo=libero&come=casazen');
  const property = page.getByTestId('lease-property-select');
  const noProperties = page.getByTestId('lease-no-properties');
  await expect(property.or(noProperties)).toBeVisible({ timeout: 60_000 });
  if (await noProperties.isVisible()) {
    throw new Error('The test account has no long-rent property, so the condominium step of the wizard cannot open.');
  }

  const value = await property.locator('option').nth(1).getAttribute('value');
  if (!value) throw new Error('The property list has no option to start a contract.');
  await property.selectOption(value);
  await page.getByTestId('lease-wizard-next').click();
  await page.waitForURL(/\/leases\/[^/]+\/edit/, { timeout: 60_000 });

  const edit = new URL(page.url());
  edit.searchParams.set('step', '3');
  await page.goto(`${edit.pathname}?${edit.searchParams.toString()}`);
  const expenses = page.getByTestId('lease-condominium-expenses');
  await expect(expenses, 'The economic step must show the condominium proposal').toBeVisible({ timeout: 60_000 });
  await expect(expenses).toContainText('Spese condominiali');
  await expect(expenses.getByTestId('lease-condominium-proposed').or(expenses.getByTestId('lease-condominium-empty'))).toBeVisible();
  if (await expenses.getByTestId('lease-condominium-empty').isVisible()) {
    await expect(expenses.getByTestId('lease-condominium-limits')).toContainText('millesimi');
    await expenses.getByLabel('Importo a mano (€ al mese)').fill('80');
    await expenses.getByTestId('lease-condominium-manual').click();
    await expect(expenses.getByTestId('lease-condominium-saved')).toContainText('80,00');
    await expect(expenses.getByTestId('lease-condominium-accept')).toHaveCount(0);
  }
}

async function exerciseDocuments(page: Page): Promise<string> {
  const leaseId = page.url().match(/\/leases\/([^/]+)\/edit/)?.[1];
  if (!leaseId) throw new Error('The wizard did not open a lease, so Documenti cannot be checked.');
  await page.goto(`/app/long-rent/leases/${leaseId}?tab=documenti`);
  await expect(page.getByTestId('lease-tab-documenti')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('lease-documents-panel')).toBeVisible();

  const upload = page.getByRole('link', { name: 'Carica i documenti in CasaZen' });
  if (await upload.isVisible()) {
    await upload.click();
    // The documents tab opens /documents/upload?leaseId=…, so the contract id is no longer in the path.
    await expect(page).toHaveURL(/\/documents\/upload\?/);
    await expect(page.getByTestId('lease-documents-panel')).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'prova-condoledger.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'),
    });
    await page.getByRole('button', { name: 'Carica documento' }).click();
  }

  // The chosen file is named on the picker before the upload finishes. Wait for its delete control.
  const remove = page.getByRole('button', { name: 'Elimina prova-condoledger.pdf' });
  await expect(remove, 'An uploaded document must have a delete control next to Scarica').toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: 'Scarica' }).first()).toBeVisible();
  await remove.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Eliminare questo documento?');
  await dialog.getByRole('button', { name: 'Elimina' }).click();
  await expect(page.getByRole('button', { name: 'Elimina prova-condoledger.pdf' })).toHaveCount(0);
  return leaseId;
}

async function exercisePayments(page: Page, leaseId: string): Promise<void> {
  await page.goto(`/app/long-rent/leases/${leaseId}?tab=pagamenti`);
  await expect(page.getByTestId('lease-tab-pagamenti')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
  await expect(page.getByTestId('rent-not-on-contract')).toBeVisible();
  await page.getByRole('link', { name: 'Apri le spese condominiali' }).click();
  await expect(page).toHaveURL(/\/app\/long-rent\/payments$/);
  await expect(page.getByTestId('long-rent-payments')).toContainText('home banking');
  await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Collega il conto' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Apri i contratti' })).toBeVisible();
}
