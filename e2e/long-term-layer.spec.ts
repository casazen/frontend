import { test, expect } from '@playwright/test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';

test.describe('Long-term UI layer (#182 acceptance criteria)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('AC1 PropertyOwner-only sees short-stay shell without long-term nav', async ({ page }) => {
    await page.goto(demoUrl('/', 'short-stay'));

    await expect(page.getByText(/property manager/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bookings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leases' })).toHaveCount(0);
    await expect(page.getByText(/long-term rental/i)).toHaveCount(0);
  });

  test('AC2 LongTermLandlord-only sees long-term shell and lease home', async ({ page }) => {
    await page.goto(demoUrl('/', 'long-term'), { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/leases(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByText(/long-term rental/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leases' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Bookings' })).toHaveCount(0);
  });

  test('AC3 dual-role user can switch layers with persistent switcher', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/', 'dual'), { waitUntil: 'networkidle' });

    const switcher = page.getByRole('tablist', { name: 'Application layer' });
    await expect(switcher).toBeVisible();

    await page.getByRole('tab', { name: 'Long-term' }).click();
    await expect(page).toHaveURL(/\/leases/, { timeout: 15_000 });
    await expect(page.getByText(/long-term rental/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Short-stay' }).click();
    await expect(page).toHaveURL(/\/(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByText(/property manager/i)).toBeVisible();
  });

  test('AC4 long-term layer renders leases list route', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/leases', 'long-term'), { waitUntil: 'networkidle' });

    await expect(page.getByText(/long-term rental/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /long-term leases/i })).toBeVisible({ timeout: 15_000 });
  });

  test('AC5 PropertyOwner-only is redirected away from /leases', async ({ page }) => {
    await page.goto(demoUrl('/leases', 'short-stay'), { waitUntil: 'networkidle' });

    await expect(page).not.toHaveURL(/\/leases/, { timeout: 15_000 });
    await expect(page.getByText(/property manager/i)).toBeVisible();
  });

  test('AC6 dual-role deep link to /leases stays in long-term shell', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/leases', 'dual'), { waitUntil: 'networkidle' });

    await expect(page.getByText(/long-term rental/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Leases' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Long-term' })).toHaveAttribute('aria-selected', 'true');
  });
});
