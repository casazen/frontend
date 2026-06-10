import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { NEW_PROPERTY_ID } from './fixtures/properties.fixtures';

const PROPERTIES_URL = '/app/short-rent/properties';

test.describe('Property create and detail flow (#152)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPropertiesApi(page);
  });

  test('creates a property from the list dialog and shows it in the table', async ({ page }) => {
    await page.goto(demoUrl(PROPERTIES_URL, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible();
    await expect(page.getByText('No properties yet')).toBeVisible();

    await page.getByRole('button', { name: 'Add Your First Property' }).click();
    await expect(page.getByRole('heading', { name: 'Add New Property' })).toBeVisible();

    await page.getByLabel('Property Name *').fill('Casa E2E Flow');
    await page.getByLabel('Description *').fill('Proprietà creata dal test E2E property flow.');
    await page.getByLabel('Address *').fill('Via Roma 10');
    await page.getByLabel('City *').fill('Roma');
    await page.getByLabel('Country *').fill('IT');
    await page.getByLabel('ZIP Code *').fill('00100');
    await page.getByLabel('Bedrooms *').fill('2');
    await page.getByLabel('Bathrooms *').fill('1');
    await page.getByLabel('Max Guests *').fill('4');
    await page.getByLabel('Price per Night *').fill('120');

    const createResponse = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/api/properties'),
    );
    await page.getByRole('button', { name: 'Create Property' }).click();
    const response = await createResponse;
    expect(response.status()).toBe(201);

    await expect(page.getByText('Property created successfully')).toBeVisible();
    await expect(page.getByText('No properties yet')).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'Casa E2E Flow' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Roma, IT' })).toBeVisible();
  });

  test('navigates to property detail and renders aggregate sections', async ({ page }) => {
    await page.goto(demoUrl(PROPERTIES_URL, 'short-stay'));

    await page.getByRole('button', { name: 'Add Property' }).click();
    await page.getByLabel('Property Name *').fill('Casa E2E Flow');
    await page.getByLabel('Description *').fill('Proprietà creata dal test E2E property flow.');
    await page.getByLabel('Address *').fill('Via Roma 10');
    await page.getByLabel('City *').fill('Roma');
    await page.getByLabel('Country *').fill('IT');
    await page.getByLabel('ZIP Code *').fill('00100');
    await page.getByLabel('Bedrooms *').fill('2');
    await page.getByLabel('Bathrooms *').fill('1');
    await page.getByLabel('Max Guests *').fill('4');
    await page.getByLabel('Price per Night *').fill('120');
    const createResponse = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().includes('/api/properties'),
    );
    await page.getByRole('button', { name: 'Create Property' }).click();
    expect((await createResponse).status()).toBe(201);

    await expect(page.getByRole('link', { name: 'Casa E2E Flow' })).toBeVisible();
    await page.getByRole('link', { name: 'Casa E2E Flow' }).click();

    await expect(page).toHaveURL(new RegExp(`/properties/${NEW_PROPERTY_ID}`));
    await expect(page.getByRole('heading', { name: 'Casa E2E Flow' })).toBeVisible();
    await expect(page.getByText('CIN mancante')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Dettagli proprietà' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Documenti' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Integrazioni OTA' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Riepilogo prenotazioni' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prezzi AI' })).toBeVisible();
  });
});
