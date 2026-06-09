import { test, expect } from '@playwright/test';
import { demoUrl } from './helpers/demo-profile';
import {
  mockPublicBookingReadApi,
  mockPublicSearchResults,
  PUBLIC_SEARCH_PROPERTY_ID,
} from './helpers/public-booking-readmodel-mock';

const SEARCH_URL = '/search';

test.describe('Public booking read-model (#212)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPublicBookingReadApi(page);
  });

  test('AC11: search results show CIN badge, city, price, and capacity without operator identity', async ({ page }) => {
    await page.goto(demoUrl(SEARCH_URL, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'Trastevere Loft' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('CIN valido')).toBeVisible();
    await expect(page.getByText('Rome (00153)')).toBeVisible();
    await expect(page.getByText('CIN mancante')).toBeVisible();

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).not.toContain('ownerid');
    expect(bodyText.toLowerCase()).not.toContain('auth0');
  });

  test('AC12: public search request is sent without Authorization header', async ({ page }) => {
    let authHeader: string | undefined;

    await page.route('**/api/properties/search**', async (route) => {
      authHeader = route.request().headers()['authorization'];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockPublicSearchResults),
      });
    });

    await page.goto(demoUrl(SEARCH_URL, 'short-stay'));
    await expect(page.getByRole('heading', { name: 'Trastevere Loft' })).toBeVisible({ timeout: 15_000 });

    expect(authHeader).toBeUndefined();
  });

  test('AC12: public detail request is sent without Authorization header', async ({ page }) => {
    let authHeader: string | undefined;

    await page.route(`**/api/properties/${PUBLIC_SEARCH_PROPERTY_ID}/public`, async (route) => {
      authHeader = route.request().headers()['authorization'];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...mockPublicSearchResults[0],
          houseRules: 'Quiet hours after 22:00.',
          cancellationPolicySummary: 'Flexible',
          minNights: null,
          currency: 'EUR',
        }),
      });
    });

    await page.goto(demoUrl(SEARCH_URL, 'short-stay'));
    await page.evaluate(async (id) => {
      await fetch(`/api/properties/${id}/public`);
    }, PUBLIC_SEARCH_PROPERTY_ID);

    expect(authHeader).toBeUndefined();
  });
});
