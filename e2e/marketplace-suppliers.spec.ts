import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import { mockServiceCategoriesApi } from './helpers/service-categories-mock';
import type { Page } from '@playwright/test';

const PROPERTY_ID = 'prop-marketplace-e2e';
const SUPPLIER_ORG_ID = 'sup-org-marketplace-e2e';
const SERVICE_ID = 'svc-marketplace-e2e';
const STAY_ID = 'booking-marketplace-e2e';

/** A future stay of the property: short-rent requests are for a stay (SU-07, D2). */
const sampleStay = {
  id: STAY_ID,
  propertyId: PROPERTY_ID,
  checkInDate: '2099-10-01T00:00:00Z',
  checkOutDate: '2099-10-05T00:00:00Z',
  numberOfGuests: 2,
  status: 'Confirmed',
  source: 'Direct',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com', phone: '', country: 'IT' },
};

// The suppliers are searched by the comune chosen from the official list: a property without one is asked to add it (SR-09a).
const sampleProperty = buildCreatedProperty({
  id: PROPERTY_ID,
  name: 'Casa Marketplace',
  city: 'H501',
  comuneIstatCode: '058091',
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
      services: [
        { id: SERVICE_ID, name: 'Pulizia profonda', category: 'cleaning', durationMinutes: 150, priceFromCents: 9000, priceUnit: 'PerJob', requiresQuote: false },
      ],
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
  await mockServiceCategoriesApi(page);

  await page.route('**/api/suppliers**', async (route) => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/')) {
      await route.fallback();
      return;
    }
    const url = new URL(route.request().url());
    // The page of one supplier (MKT): the same entry, every service.
    if (url.pathname === `/api/suppliers/${SUPPLIER_ORG_ID}` && url.searchParams.get('propertyId') === PROPERTY_ID) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(sampleSuppliers.items[0]),
      });
      return;
    }
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

  await page.route('**/api/bookings**', async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/') || route.request().method() !== 'GET' || url.pathname !== '/api/bookings') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(url.searchParams.get('propertyId') === PROPERTY_ID ? [sampleStay] : []),
    });
  });

  await page.route('**/api/service-requests**', async (route) => {
    if (!new URL(route.request().url()).pathname.startsWith('/api/')) {
      await route.fallback();
      return;
    }
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 50 }),
      });
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body.propertyId).toBe(PROPERTY_ID);
      expect(body.supplierOrgId).toBe(SUPPLIER_ORG_ID);
      expect(body.category).toBe('cleaning');
      // D2: the request is for the stay chosen in the dialog.
      expect(body.bookingId).toBe(STAY_ID);
      expect(body.durationMinutes).toBe(120);
      expect(body.scheduledStartUtc).toEqual(expect.any(String));
      expect(body.chargeToGuest).toBeUndefined();

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sr-created-e2e',
          orgId: 'org-e2e',
          bookingId: STAY_ID,
          rentalContext: 'ShortRent',
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
  test('AC6: browse suppliers → request service for a stay → success', async ({ page }) => {
    await mockMarketplaceApis(page);
    await page.goto(demoUrl(`/app/short-rent/marketplace?propertyId=${PROPERTY_ID}`, 'short-stay'));

    // Scopri: «Fornitori CasaZen» has a row for each category the suppliers offer (MKT: the marketplace has pages of its own).
    await expect(page.getByTestId('marketplace-property-select')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('marketplace-category-row-cleaning')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(`marketplace-supplier-${SUPPLIER_ORG_ID}`)).toBeVisible();

    // Categorie → a category → the suppliers that offer it.
    await page.getByTestId('marketplace-section-categories').click();
    await page.getByTestId('marketplace-category-cleaning').click();
    await expect(page).toHaveURL(/\/marketplace\/categories\/cleaning/);
    await expect(page.getByTestId('marketplace-supplier-grid')).toBeVisible();

    // The search: Enter on Scopri leads to the page of the search, which asks the suppliers with the words.
    await page.getByTestId('marketplace-section-discover').click();
    const searched = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/api/suppliers' && new URL(request.url()).searchParams.get('q') === 'pulizie',
    );
    await page.getByTestId('marketplace-search').fill('pulizie');
    await page.getByTestId('marketplace-search').press('Enter');
    await expect(page).toHaveURL(/\/marketplace\/search\?.*q=pulizie/);
    await searched;
    await expect(page.getByTestId('marketplace-supplier-grid')).toBeVisible();

    // The supplier opens in the drawer (UI-15), which is named by the supplier.
    await page.getByTestId(`marketplace-supplier-${SUPPLIER_ORG_ID}`).click();
    await expect(page.getByTestId('marketplace-supplier-detail')).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Pulizie Express Srl')).toBeVisible();

    await page.getByTestId('marketplace-request-service-btn').click();
    await expect(page.getByTestId('service-request-dialog')).toBeVisible();
    // Without a stay the request cannot be sent (D2).
    await expect(page.getByTestId('submit-service-request')).toBeDisabled();
    await page.getByTestId('service-request-stay').selectOption(STAY_ID);
    await page.getByTestId('service-request-start-time').fill('10:00');
    await page.getByTestId('service-request-duration').selectOption('120');
    await expect(page.getByTestId('submit-service-request')).toBeEnabled();

    const createResp = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/service-requests'),
    );
    await page.getByTestId('submit-service-request').click();
    expect((await createResp).status()).toBe(201);

    // The page of the supplier (MKT), which can be shared: every service has its own «Richiedi», and the request is for that service.
    await page.goto(demoUrl(`/app/short-rent/marketplace/suppliers/${SUPPLIER_ORG_ID}?propertyId=${PROPERTY_ID}`, 'short-stay'));
    await expect(page.getByTestId('marketplace-supplier-page')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId(`marketplace-request-service-${SERVICE_ID}`).click();
    await expect(page.getByTestId('service-request-service')).toContainText('Pulizia profonda');
    await expect(page.getByTestId('service-request-duration')).toHaveValue('150');
  });
});
