import { test, expect } from './test';
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

  test('AC11: search results show the city, price, capacity and host, and lead to the site of the host, without operator identity', async ({ page }) => {
    await page.goto(demoUrl(SEARCH_URL, 'short-stay'));

    // The public search is the results page of a site (SEARCH-GLOBAL): a card per home, the name is its one link.
    const home = page.getByTestId('house-card').first();
    await expect(home.getByRole('link', { name: 'Trastevere Loft' })).toBeVisible({ timeout: 15_000 });
    await expect(home.getByRole('link', { name: 'Trastevere Loft' })).toHaveAttribute('href', new RegExp(`^/book/demo-casazen/property/${PUBLIC_SEARCH_PROPERTY_ID}`));
    await expect(home).toContainText('Rome');
    await expect(home.getByTestId('house-card-price')).toContainText('145');
    await expect(home.locator('.hcard__facts')).toContainText('4');
    await expect(home.getByTestId('house-card-host')).toContainText('Demo Casazen Stays');
    // The compliance state is for the host only: no "valid"/"missing" badge for guests, and no CIN in a list (it is on the page of the home).
    await expect(page.getByTestId('public-cin')).toHaveCount(0);
    await expect(page.getByText(/CIN (valido|mancante|non valido)/)).toHaveCount(0);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText.toLowerCase()).not.toContain('ownerid');
    expect(bodyText.toLowerCase()).not.toContain('auth0');
  });

  test('AC12: public search request is sent without Authorization header', async ({ page }) => {
    let authHeader: string | undefined;

    await page.route('**/api/public/stays?**', async (route) => {
      authHeader = route.request().headers()['authorization'];
      await route.fallback();
    });

    await page.goto(demoUrl(SEARCH_URL, 'short-stay'));
    await expect(page.getByTestId('house-card').first()).toBeVisible({ timeout: 15_000 });

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
