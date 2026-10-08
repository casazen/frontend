import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { resetE2eStorage } from './helpers/locale';

test.describe('Navigation (#252 / #259)', () => {
  test.describe('Desktop layout', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('sidebar shows grouped sections', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      // UI-04a: seven main entries in three named groups, the rest in "Altro".
      const sidebar = page.getByRole('complementary', { name: 'Navigazione principale' });
      await expect(sidebar.getByText(/Ogni giorno|Every day/i)).toBeVisible();
      await expect(sidebar.getByText(/La tua offerta|Your offer/i)).toBeVisible();
      await expect(sidebar.getByText(/Gestione|Management/i)).toBeVisible();
    });

    test('calendar route highlights Calendario not Prenotazioni in sidebar', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/bookings/calendar', 'short-stay'), {
        waitUntil: 'domcontentloaded',
      });

      const sidebar = page.getByRole('complementary', { name: 'Navigazione principale' });
      const calendarLink = sidebar.getByRole('link', { name: /Calendario|Calendar/i });
      const bookingsLink = sidebar.getByRole('link', { name: /Prenotazioni|Bookings/i });

      await expect(calendarLink).toHaveAttribute('aria-current', 'page');
      await expect(bookingsLink).not.toHaveAttribute('aria-current', 'page');
    });

    test('revenue page uses app shell with sidebar', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/payments/revenue', 'short-stay'), {
        waitUntil: 'domcontentloaded',
      });

      await expect(page.getByRole('complementary', { name: 'Navigazione principale' })).toBeVisible();
      await expect(page.getByRole('heading', { name: /Analisi ricavi|Revenue Analytics/i })).toBeVisible();
    });

    test('CIN page uses app shell with sidebar', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/compliance/cin', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await expect(page.getByRole('complementary', { name: 'Navigazione principale' })).toBeVisible();
      await expect(page.getByTestId('cin-compliance-page')).toBeVisible();
    });
  });

  test.describe('Mobile layout', () => {
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
      // "Incassi" is a main entry that is not one of the four destinations of the bottom bar: the drawer lists it (UI-04a).
      await expect(drawer.getByText(/Gestione|Management/i)).toBeVisible();

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

    test('dual-role user sees the area switcher on mobile', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      await page.getByRole('button', { name: /Open navigation menu|Apri menu di navigazione/i }).click();
      const drawer = page.getByRole('dialog');
      await drawer.getByTestId('area-switcher').click();
      await expect(page.getByRole('menuitemradio', { name: /Affitti brevi|Short-term rentals/i })).toBeVisible();
      await expect(page.getByRole('menuitemradio', { name: /Affitti lunghi|Long-term rentals/i })).toBeVisible();
    });

    test('area switcher is not in header on dual-role mobile', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      const header = page.locator('header');
      await expect(header.getByTestId('area-switcher')).toHaveCount(0);

      await page.getByRole('button', { name: 'Open navigation menu' }).click();
      await expect(page.getByRole('dialog').getByTestId('area-switcher')).toBeVisible();
    });
  });
});
