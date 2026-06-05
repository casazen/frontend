import { test, expect } from '@playwright/test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertyDetailApi, PROPERTY_DETAIL_ID } from './helpers/property-detail-mock';

const DETAIL_URL = `/properties/${PROPERTY_DETAIL_ID}`;

test.describe('Property detail page (#152)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPropertyDetailApi(page);
  });

  test('AC8: renders all detail sections from aggregate endpoint', async ({ page }) => {
    await page.goto(demoUrl(DETAIL_URL, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'Villa Mare E2E' })).toBeVisible();
    await expect(page.getByText('CIN valido')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dettagli proprietà' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Servizi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documenti' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Integrazioni OTA' })).toBeVisible();
    await expect(page.getByText('Airbnb')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Riepilogo prenotazioni' })).toBeVisible();
    const bookingsSection = page.getByRole('heading', { name: 'Riepilogo prenotazioni' }).locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');
    await expect(bookingsSection.getByText('12', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prezzi AI' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Gestisci prezzi AI/i })).toBeVisible();
  });

  test('AC9: CIN badge click shows regulatory tooltip', async ({ page }) => {
    await page.goto(demoUrl(DETAIL_URL, 'short-stay'));

    await page.getByRole('button', { name: /Stato CIN: CIN valido/i }).click();
    await expect(page.getByRole('tooltip')).toContainText('D.L. 145/2023');
  });

  test('AC10: document upload dialog opens with drag-drop zone', async ({ page }) => {
    await page.goto(demoUrl(DETAIL_URL, 'short-stay'));

    await page.getByRole('button', { name: 'Carica documento' }).click();
    await expect(page.getByRole('heading', { name: 'Carica documento' })).toBeVisible();
    await expect(page.getByText('Trascina un file qui o clicca per selezionare')).toBeVisible();
  });

  test('AC12: OTA section does not expose apiKey', async ({ page }) => {
    await page.goto(demoUrl(DETAIL_URL, 'short-stay'));

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).not.toContain('apikey');
    expect(bodyText.toLowerCase()).not.toContain('apisecret');
  });
});
