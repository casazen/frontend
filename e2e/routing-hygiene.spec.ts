import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { waitForAppReady } from './helpers/auth';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import { resetE2eStorage } from './helpers/locale';

/**
 * UI-00: the app-ready test id that the real-login setup waits for (instead of the title "Cruscotto"), the home of the
 * areas without a page at their bare address, the legacy redirect that keeps query and fragment, the profile of the
 * supplier. Demo mode (L2): no Auth0, the login itself (e2e/auth.setup.ts) only runs against a real tenant.
 */
test.describe('Routing hygiene and app-ready (UI-00)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test.describe('app-ready', () => {
    test('short-rent: the header of the shell is the app-ready element', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await waitForAppReady(page);
      await expect(page.locator('header[data-testid="app-ready"]')).toBeVisible();
      await expect(page.getByTestId('app-ready')).toHaveCount(1);
    });

    test('long-rent: the header of the shell is the app-ready element', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/long-rent/leases', 'long-term'), { waitUntil: 'domcontentloaded' });

      await waitForAppReady(page);
      await expect(page.locator('header[data-testid="app-ready"]')).toBeVisible();
    });

    test('supplier: the header of the shell is the app-ready element', async ({ page }) => {
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await waitForAppReady(page);
      await expect(page.locator('header[data-testid="app-ready"]')).toBeVisible();
    });

    test('admin: the header of the shell is the app-ready element', async ({ page }) => {
      await page.route('**/api/comuni/status', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ datasetAvailable: false }) }),
      );
      await page.goto(demoUrl('/app/admin/suppliers/invite', 'admin'), { waitUntil: 'domcontentloaded' });

      await waitForAppReady(page);
      await expect(page.locator('header[data-testid="app-ready"]')).toBeVisible();
    });

    test('a user with several areas lands on the picker, which is app-ready too', async ({ page }) => {
      await page.goto(demoUrl('/app/choose-context', 'dual'), { waitUntil: 'domcontentloaded' });

      await waitForAppReady(page);
      await expect(page).toHaveURL(/\/app\/choose-context/);
      await expect(page.getByTestId('app-ready')).toBeVisible();
      await expect(page.getByRole('button', { name: /Affitti brevi/i })).toBeVisible();
    });

    test('a user who has not finished the onboarding is ready at the wizard', async ({ page }) => {
      await page.goto(demoUrl('/onboarding', 'onboarding'), { waitUntil: 'domcontentloaded' });

      await waitForAppReady(page);
      await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
      await expect(page.getByTestId('app-ready')).toHaveCount(0);
    });
  });

  test.describe('areas without a page at their bare address', () => {
    test('/app/long-rent opens the contracts', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/long-rent', 'long-term'), { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
      await expect(page.locator('header[data-testid="app-ready"]')).toBeVisible();
    });

    test('/app/supplier opens the dashboard', async ({ page }) => {
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier', 'supplier'), { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/app\/supplier\/dashboard/);
      await expect(page.locator('header[data-testid="app-ready"]')).toBeVisible();
    });
  });

  test.describe('legacy addresses', () => {
    test('a legacy address keeps its query and fragment on the way to the canonical page', async ({ page }) => {
      // The Stripe return pages (?checkout=success, ?stripe_return=1) and the links of the emails come through here.
      await page.goto('/bookings?checkout=success&demoProfile=short-stay#details', { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/app\/short-rent\/bookings\?checkout=success&demoProfile=short-stay#details$/);
    });
  });

  test.describe('profile of the supplier', () => {
    test('the profile entry of the user menu opens the profile of the supplier console', async ({ page }) => {
      await mockSupplierConsoleApi(page, { active: true });
      await page.goto(demoUrl('/app/supplier/inbox', 'supplier'), { waitUntil: 'domcontentloaded' });

      await page.locator('header button[aria-haspopup="menu"]').click();
      await page.getByRole('menuitem', { name: /^(Profilo|Profile)$/ }).click();

      await expect(page).toHaveURL(/\/app\/supplier\/profile/);
    });
  });
});
