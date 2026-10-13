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
    // The area name of the sidebar (UI-04a: "Affitti lunghi"; the backend still sends "Affitti lungo termine").
    await expect(page.getByText(/affitti lunghi|long-term rental/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Contratti|Leases/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Prenotazioni|Bookings/i })).toHaveCount(0);
  });

  test('AC3 dual-role user can switch layers with persistent switcher', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/', 'dual'), { waitUntil: 'domcontentloaded' });

    // UI-04a: the area switcher of the sidebar (a menu button) replaces the icon tabs.
    const switcher = page.getByTestId('area-switcher');
    await expect(switcher).toBeVisible();

    await switcher.click();
    await page.getByRole('menuitemradio', { name: /Affitti lunghi/ }).click();
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/, { timeout: 15_000 });
    await expect(page.getByText(/affitti lunghi|long-term rental/i)).toBeVisible();

    await switcher.click();
    await page.getByRole('menuitemradio', { name: /Affitti brevi/ }).click();
    await expect(page).toHaveURL(/\/app\/short-rent(?:\?.*)?$/, { timeout: 15_000 });
    await expect(page.getByText(/property manager|short-term rentals|affitti brevi/i).first()).toBeVisible();
  });

  test('AC4 long-term layer renders leases list route', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/leases', 'long-term'), { waitUntil: 'domcontentloaded' });

    await expect(page.getByText(/affitti lunghi|long-term rental/i)).toBeVisible();
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

    await expect(page.getByText(/affitti lunghi|long-term rental/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Contratti|Leases/i })).toBeVisible();
    // The switcher names the area the user is in.
    await expect(page.getByTestId('area-switcher')).toHaveAttribute('aria-label', /Affitti lunghi|Long-term rentals/);
  });
});
