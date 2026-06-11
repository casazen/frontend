import { test, expect } from './test';
import { waitForAppReady } from './helpers/auth';

test.describe.skip('Long-term layer (real Auth0 + API)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);
  });

  test('AC0 user has LongTermLandlord role and can open /leases', async ({ page }) => {
    await page.goto('/leases');

    const onLeases = /\/leases/.test(page.url());
    const hasLongTermShell = await page.getByText(/long-term rental/i).isVisible().catch(() => false);

    expect(
      onLeases && hasLongTermShell,
      'User lacks LongTermLandlord role — assign it in Auth0 for auth0|6a209c92984357dfe61c45ac and ensure Login Action sets https://casazen.app/roles on tokens'
    ).toBeTruthy();
  });

  test('AC1 shows long-term shell on /leases with sidebar and heading', async ({ page }) => {
    await page.goto('/leases');
    await expect(page).toHaveURL(/\/leases/, { timeout: 30_000 });
    await expect(page.getByText(/long-term rental/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leases' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /long-term leases/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  test('AC2 layer switcher moves between short-stay and long-term when available', async ({
    page,
  }) => {
    await page.goto('/leases');
    await expect(page.getByText(/long-term rental/i)).toBeVisible({ timeout: 30_000 });

    const switcher = page.getByRole('tablist', { name: 'Application layer' });
    const hasSwitcher = await switcher.isVisible().catch(() => false);

    if (!hasSwitcher) {
      test.skip(true, 'User is long-term-only; layer switcher not expected.');
    }

    await page.getByRole('tab', { name: 'Short-stay' }).click();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByText(/property manager|short-term rentals|affitti brevi/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Long-term' }).click();
    await expect(page).toHaveURL(/\/leases/, { timeout: 15_000 });
    await expect(page.getByText(/long-term rental/i)).toBeVisible();
  });

  test('AC3 navigates create-lease form and validates required fields', async ({ page }) => {
    await page.goto('/leases/new');
    await expect(page.getByRole('heading', { name: /create lease/i })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: /create lease draft/i }).click();

    await expect(page.getByText(/property is required/i)).toBeVisible();
    await expect(page.getByText(/start date is required/i)).toBeVisible();
    await expect(page.getByText(/end date is required/i)).toBeVisible();
  });

  test('AC4 creates a lease draft when a property with APE is available', async ({ page }) => {
    await page.goto('/leases/new');
    await expect(page.getByRole('heading', { name: /create lease/i })).toBeVisible({
      timeout: 30_000,
    });

    const propertySelect = page.locator('#propertyId');
    const optionCount = await propertySelect.locator('option').count();
    if (optionCount <= 1) {
      test.skip(true, 'No properties available for the authenticated user.');
    }

    await propertySelect.selectOption({ index: 1 });
    await page.waitForTimeout(1500);

    const apeAlert = page.getByRole('alert');
    if (await apeAlert.isVisible().catch(() => false)) {
      test.skip(true, 'Selected property is missing an APE document required for lease creation.');
    }

    const startDate = '2026-07-01';
    const endDate = '2027-06-30';

    await page.locator('#startDate').fill(startDate);
    await page.locator('#endDate').fill(endDate);
    await page.locator('#monthlyRent').fill('1200');

    await page.locator('[id="landlord.firstName"]').fill('Mario');
    await page.locator('[id="landlord.lastName"]').fill('Rossi');
    await page.locator('[id="landlord.fiscalCode"]').fill('RSSMRA80A01H501U');
    await page.locator('[id="landlord.citizenship"]').fill('IT');
    await page.locator('[id="landlord.contactEmail"]').fill('landlord@example.com');

    await page.locator('[id="tenant.firstName"]').fill('Luigi');
    await page.locator('[id="tenant.lastName"]').fill('Verdi');
    await page.locator('[id="tenant.fiscalCode"]').fill('VRDLGU85C15F205X');
    await page.locator('[id="tenant.citizenship"]').fill('IT');
    await page.locator('[id="tenant.contactEmail"]').fill('tenant@example.com');

    await page.getByRole('button', { name: /create lease draft/i }).click();

    await expect(page).toHaveURL(/\/leases\/[0-9a-f-]+/i, { timeout: 30_000 });
    await expect(page.getByText(/draft/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('AC5 profile page is reachable from long-term shell', async ({ page }) => {
    await page.goto('/leases');
    await expect(page.getByText(/long-term rental/i)).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: 'Profile' }).click();
    await expect(page).toHaveURL(/\/profile/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /profile information/i })).toBeVisible();
  });

  test('AC6 short-stay routes stay hidden in long-term-only navigation', async ({ page }) => {
    await page.goto('/leases');
    await expect(page.getByText(/long-term rental/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Bookings' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'OTA Sync' })).toHaveCount(0);
  });
});
