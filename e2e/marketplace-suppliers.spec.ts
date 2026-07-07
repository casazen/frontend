import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import type { Page } from '@playwright/test';

const PROPERTY_ID = 'prop-marketplace-e2e';
const SUPPLIER_ORG_ID = 'sup-org-marketplace-e2e';

const sampleProperty = buildCreatedProperty({
  id: PROPERTY_ID,
  name: 'Casa Marketplace',
  city: 'H501',
});

const sampleSuppliers = {
  items: [
    {
      orgId: SUPPLIER_ORG_ID,
      legalName: 'Pulizie Express Srl',
      phone: '+39 06 111111',
      email: 'info@pulizie.test',
      categories: ['cleaning'],
      comuni: ['H501'],
      bio: 'Pulizie professionali per affitti brevi.',
      photoUrls: [],
    },
  ],
  totalCount: 1,
  page: 1,
  pageSize: 1,
};

async function mockMarketplaceApis(page: Page) {
  await mockPropertiesApi(page, [sampleProperty]);
  await mockCurrentUserWithOrg(page);
  await mockEntitlement(page);

  await page.route('**/api/suppliers**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('propertyId') === PROPERTY_ID) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleSuppliers),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 0 }),
    });
  });

  await page.route('**/api/service-requests**', async (route) => {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 50 }),
      });
      return;
    }
    if (method === 'POST' && route.request().url().includes('/match-supplier')) {
      await route.fallback();
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.propertyId).toBe(PROPERTY_ID);
      expect(body.supplierOrgId).toBe(SUPPLIER_ORG_ID);
      expect(body.bookingId).toBeUndefined();
      expect(body.chargeToGuest).toBeUndefined();

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sr-created-e2e',
          orgId: 'org-e2e',
          propertyId: PROPERTY_ID,
          propertyName: sampleProperty.name,
          supplierOrgId: SUPPLIER_ORG_ID,
          supplierName: sampleSuppliers.items[0].legalName,
          category: 'cleaning',
          urgency: 'Normal',
          status: 'Richiesto',
          chargeToGuest: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
      });
      return;
    }
    await route.fallback();
  });
}

test.describe('Marketplace suppliers (#340)', () => {
  test('AC6: browse suppliers → request service → success', async ({ page }) => {
    await mockMarketplaceApis(page);
    await page.goto(demoUrl(`/app/short-rent/marketplace?propertyId=${PROPERTY_ID}`, 'short-stay'));

    await expect(page.getByTestId('marketplace-property-select')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('marketplace-supplier-grid')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`marketplace-supplier-${SUPPLIER_ORG_ID}`)).toBeVisible();

    await page.getByTestId(`marketplace-supplier-${SUPPLIER_ORG_ID}`).click();
    await expect(page.getByTestId('marketplace-supplier-detail')).toBeVisible();
    await expect(page.getByText('Pulizie Express Srl')).toBeVisible();

    await page.getByTestId('marketplace-request-service-btn').click();
    await expect(page.getByTestId('service-request-dialog')).toBeVisible();

    const createResp = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/service-requests') && !r.url().includes('match-supplier'),
    );
    await page.getByTestId('submit-service-request').click();
    expect((await createResp).status()).toBe(201);
  });
});
