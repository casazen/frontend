import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { resetE2eStorage } from './helpers/locale';

test.describe('Long-term UI layer (#182 acceptance criteria)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('AC1 PropertyOwner-only sees short-stay shell without long-term nav', async ({ page }) => {
    await page.goto(demoUrl('/', 'short-stay'));

    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Prenotazioni|Bookings/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Contratti|Leases/i })).toHaveCount(0);
  });

  test('AC2 LongTermLandlord-only sees long-term shell and lease home', async ({ page }) => {
    await page.goto(demoUrl('/', 'long-term'), { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/app\/long-rent\/leases(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByText(/affitti lungo termine|long-term rental/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Contratti|Leases/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Prenotazioni|Bookings/i })).toHaveCount(0);
  });

  test('AC3 dual-role user can switch layers with persistent switcher', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/', 'dual'), { waitUntil: 'domcontentloaded' });

    const switcher = page.getByRole('tablist', { name: /Workspace context|Contesto applicativo/i });
    await expect(switcher).toBeVisible();

    await page.getByRole('tab', { name: 'Affitti lungo termine' }).click();
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/, { timeout: 15_000 });
    await expect(page.getByText(/affitti lungo termine|long-term rental/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Affitti brevi' }).click();
    await expect(page).toHaveURL(/\/app\/short-rent(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByText(/property manager|short-term rentals|affitti brevi/i).first()).toBeVisible();
  });

  test('AC4 long-term layer renders leases list route', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/leases', 'long-term'), { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/affitti lungo termine|long-term rental/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Contratti lungo termine|long-term leases/i })).toBeVisible({ timeout: 15_000 });
  });

  test('AC5 PropertyOwner-only is redirected away from /leases', async ({ page }) => {
    await page.goto(demoUrl('/leases', 'short-stay'), { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
    await expect(page.getByText(/property manager|short-term rentals|affitti brevi/i).first()).toBeVisible();
  });

  test('AC6 dual-role deep link to /leases stays in long-term shell', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/leases', 'dual'), { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/affitti lungo termine|long-term rental/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Contratti|Leases/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Affitti lungo termine' })).toHaveAttribute('aria-selected', 'true');
  });
});
