import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { resetE2eStorage } from './helpers/locale';
import { emptyPropertyList } from './fixtures/properties.fixtures';

async function mockPropertiesApiEmpty(page: import('@playwright/test').Page): Promise<void> {
  await page.route(/\/api\/properties(\?.*)?$/, (route) => {
    if (route.request().method() !== 'GET') {
      route.fallback();
      return;
    }
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(emptyPropertyList) });
  });
}

test.describe('Context workspace switcher (#189)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('redirects legacy /leases to canonical long-rent route', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/leases', 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
  });

  test('short-rent profile uses canonical context path', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/profile', 'short-stay'));
    await expect(page).toHaveURL(/\/app\/short-rent\/profile/);
  });

  test('long-rent user cannot access short-rent routes', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/app/short-rent/bookings', 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
  });

  // A7-06: the long-rent context has its own property pages (list, new, detail with the APE).
  test('long-rent user manages properties inside the long-rent context', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await mockPropertiesApiEmpty(page);
    await page.goto(demoUrl('/app/long-rent/properties', 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/long-rent\/properties/);
    await expect(page.getByRole('link', { name: /^(Immobili|Properties)$/ }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Nessun immobile|No properties/i })).toBeVisible({ timeout: 15_000 });
  });

  test('long-rent user is still kept out of the short-rent property pages', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/app/short-rent/properties', 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
  });

  // UI-04a: the area switcher (a button with a menu) replaces the icon tabs of the sidebar.
  test('dual-role user can switch between contexts', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });
    const switcher = page.getByTestId('area-switcher');
    await expect(switcher).toBeVisible();
    await expect(switcher).toHaveAttribute('aria-label', /Affitti brevi|Short-term rentals/);

    await switcher.click();
    await page.getByRole('menuitemradio', { name: /Affitti lunghi|Long-term rentals/ }).click();
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
    await expect(switcher).toHaveAttribute('aria-label', /Affitti lunghi|Long-term rentals/);

    await switcher.click();
    await page.getByRole('menuitemradio', { name: /Affitti brevi|Short-term rentals/ }).click();
    await expect(page).toHaveURL(/\/app\/short-rent/);
  });

  test('admin-only user lands in admin context', async ({ page }) => {
    // The dashboard of the console reads its numbers from the API: unanswered, the dev server answers with the page of the
    // app and the dashboard fails while the test looks at the menu (a race that made this test flaky).
    await page.route('**/api/admin/stats', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalProperties: 0,
          activeProperties: 0,
          totalBookings: 0,
          bookingsThisMonth: 0,
          upcomingCheckIns: 0,
          totalRevenue: 0,
          cinCompliance: { total: 0, valid: 0, missing: 0, invalid: 0 },
          otaSyncHealth: { synced: 0, failed: 0, neverSynced: 0 },
        }),
      }),
    );
    await page.goto(demoUrl('/app/choose-context', 'admin'));
    await expect(page).toHaveURL(/\/app\/admin/);
    await expect(page.getByRole('link', { name: 'Utenti' })).toBeVisible();
  });
});
