import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { resetE2eStorage } from './helpers/locale';

test.describe('Mobile navigation (#252)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'en');
  });

  test('short-rent bottom tabs visible and navigate', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

    const bottomNav = page.getByRole('navigation', { name: 'Mobile navigation' });
    await expect(bottomNav).toBeVisible();

    await expect(bottomNav.getByRole('link', { name: /Dashboard|Cruscotto/i })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: /Prenotazioni|Bookings/i })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: /Immobili|Properties/i })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: /Altro|More/i })).toBeVisible();

    await bottomNav.getByRole('link', { name: /Prenotazioni|Bookings/i }).click();
    await expect(page).toHaveURL(/\/app\/short-rent\/bookings/);

    await bottomNav.getByRole('link', { name: /Immobili|Properties/i }).click();
    await expect(page).toHaveURL(/\/app\/short-rent\/properties/);
  });

  test('drawer opens from hamburger and closes on route change', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /Open navigation menu|Apri menu di navigazione/i }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Finanza|Finance/i)).toBeVisible();

    await drawer.getByRole('link', { name: /Incassi|Payments/i }).click();
    await expect(page).toHaveURL(/\/app\/short-rent\/payments/);
    await expect(drawer).not.toBeVisible();
  });

  test('drawer shows disambiguated payment labels', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /Open navigation menu|Apri menu di navigazione/i }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('link', { name: /Incassi|Payments/i })).toBeVisible();
    await expect(drawer.getByRole('link', { name: /Stripe Connect/i })).toBeVisible();
  });

  test('no horizontal overflow on dashboard', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test('hamburger meets minimum touch target size', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

    const hamburger = page.getByRole('button', { name: /Open navigation menu|Apri menu di navigazione/i });
    const box = await hamburger.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('dual-role user sees workspace switcher on mobile', async ({ page }) => {
    await mockLeasesApiEmpty(page);
    await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: /Open navigation menu|Apri menu di navigazione/i }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer.getByRole('tab', { name: 'Affitti brevi' })).toBeVisible();
    await expect(drawer.getByRole('tab', { name: 'Affitti lungo termine' })).toBeVisible();
  });
});
