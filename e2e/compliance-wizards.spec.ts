import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import {
  DEMO_CHECKOUT_BOOKING_ID,
  DEMO_PROPERTY_ID,
  mockComplianceApi,
} from './helpers/compliance-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

async function mockDashboardApis(page: import('@playwright/test').Page): Promise<void> {
  await page.route('**/api/dashboard/kpis**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        period: { kind: 'Month', from: '2026-09-01', to: '2026-09-30', nights: 30 },
        today: '2026-09-25',
        propertyCount: 1,
        occupancy: { occupiedNights: 0, availableNights: 30, closedNights: 0, rate: 0 },
        revenue: { amount: 0, currency: 'EUR', stayCount: 0 },
        arrivalsToday: { count: 0, items: [] },
        departuresToday: { count: 0, items: [] },
        upcomingCheckIns: { count: 0, items: [] },
        recentBookings: [],
      }),
    });
  });

  await page.route('**/api/dashboard/ical-feeds**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/bookings**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/payments**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/ota/integrations**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });
}

test.describe('Compliance wizards (#295)', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    const property = buildCreatedProperty({
      id: DEMO_PROPERTY_ID,
      name: 'Appartamento Centro',
      complianceStatus: 'Pending',
    });

    await mockDashboardApis(page);
    await mockComplianceApi(page);
    await mockPropertiesApi(page, [property]);

    await page.route(`**/api/properties/${DEMO_PROPERTY_ID}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(property),
      });
    });

    await page.route(`**/api/properties/${DEMO_PROPERTY_ID}/detail`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: property.id,
          ownerId: property.ownerId,
          name: property.name,
          description: property.description,
          address: property.address,
          city: property.city,
          postalCode: property.postalCode,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          maxGuests: property.maxGuests,
          nightlyRate: property.nightlyRate,
          cleaningFee: 0,
          damageDeposit: 0,
          cinCode: null,
          cinStatus: 'Missing',
          timezone: 'Europe/Rome',
          amenities: property.amenities,
          photoUrls: [],
          houseRules: '',
          isActive: false,
          createdAt: property.createdAt,
          updatedAt: property.updatedAt,
          documents: [],
          otaIntegrations: [],
          bookingsSummary: {
            totalBookings: 0,
            upcomingBookings: 0,
            activeBookings: 0,
            nextCheckIn: null,
            nextCheckOut: null,
          },
          pricingAdapterSummary: {
            isEnabled: false,
            lastAdaptedAt: null,
            nextRunOn: null,
          },
        }),
      });
    });
  });

  test('AC11: dashboard loads compliance summary counts from API', async ({ page }) => {
    const summaryPromise = page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.url().includes('/api/compliance/summary'),
      { timeout: 30_000 },
    );
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
    const summaryResp = await summaryPromise;
    expect(summaryResp.status()).toBe(200);

    await expect(page.getByTestId('compliance-summary-widget')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('compliance-summary-properties-count')).toHaveText('1');
    await expect(page.getByTestId('compliance-summary-checkouts-count')).toHaveText('1');
    await expect(page.getByTestId('compliance-summary-checkins-count')).toHaveText('1');
  });

  test('AC12: property edit links to multi-step activation wizard with progress bar', async ({ page }) => {
    const propertyPromise = page.waitForResponse(
      (r) => r.request().method() === 'GET' && r.url().includes(`/api/properties/${DEMO_PROPERTY_ID}`),
      { timeout: 30_000 },
    );
    await page.goto(demoUrl(`/app/short-rent/properties/${DEMO_PROPERTY_ID}/edit`, 'short-stay'), {
      waitUntil: 'domcontentloaded',
    });
    await propertyPromise;

    await expect(page.getByTestId('property-activation-cta')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('property-activation-cta').getByRole('link').click();

    await expect(page).toHaveURL(new RegExp(`/properties/${DEMO_PROPERTY_ID}/activation`));
    await expect(page.getByTestId('property-activation-wizard')).toBeVisible();
    await expect(page.getByTestId('activation-wizard-progress')).toBeVisible();
    await expect(page.getByTestId('activation-step-cin')).toBeVisible();
    await expect(page.getByTestId('compliance-status-badge')).toHaveText(/Pending|In attesa/i);
  });

  // The mock has the contract of the API (action + target, CO-04): the routes come from the app, not from the mock.
  test('AC13: summary widget rows deep-link to relevant wizards', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('compliance-summary-widget')).toBeVisible({ timeout: 15_000 });

    const propertyLink = page.getByTestId('compliance-summary-properties-link').first();
    await propertyLink.click();
    await expect(page).toHaveURL(new RegExp(`/app/short-rent/properties/${DEMO_PROPERTY_ID}/activation$`));
    await expect(page.getByTestId('property-activation-wizard')).toBeVisible();

    const openFromCockpit = async (testId: string, url: string) => {
      await page.goto(demoUrl('/app/short-rent/compliance', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('compliance-summary-page')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId(testId).first().click();
      await expect(page).toHaveURL((current) => `${current.pathname}${current.search}` === url);
    };

    await openFromCockpit(
      'compliance-summary-checkouts-link',
      `/app/short-rent/bookings/${DEMO_CHECKOUT_BOOKING_ID}/checkout`,
    );
    await openFromCockpit(
      'compliance-summary-checkins-link',
      `/app/short-rent/bookings/${DEMO_CHECKOUT_BOOKING_ID}?tab=alloggiati`,
    );
    await openFromCockpit(
      'compliance-summary-alloggiati-manual-link',
      `/app/short-rent/bookings/${DEMO_CHECKOUT_BOOKING_ID}?tab=alloggiati`,
    );
  });
});
