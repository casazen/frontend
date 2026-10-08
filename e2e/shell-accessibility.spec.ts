import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';

/**
 * UI-03: one shell for every area, the window scrolls, and the shell takes care of the keyboard and screen reader user
 * at every change of page. Roles, names and test ids of the shell that the other specs read are left as they were.
 */
test.describe('Shell: window scroll and accessibility (UI-03)', () => {
  test.describe('Desktop', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ page }) => {
      await resetE2eStorage(page, 'it');
    });

    test('the skip link is the first tab stop and moves the focus to the content', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/bookings', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeVisible();

      const skipLink = page.getByRole('link', { name: 'Vai al contenuto' });
      // Out of the screen until it has the focus.
      const hidden = await skipLink.boundingBox();
      expect(hidden).not.toBeNull();
      expect(hidden!.y + hidden!.height).toBeLessThanOrEqual(0);

      await page.keyboard.press('Tab');
      await expect(skipLink).toBeFocused();
      const shown = await skipLink.boundingBox();
      expect(shown!.y).toBeGreaterThanOrEqual(0);

      const addressBefore = page.url();
      await page.keyboard.press('Enter');
      await expect(page.locator('main#main-content')).toBeFocused();
      // The link does not add `#main-content` to the address or to the history.
      expect(page.url()).toBe(addressBefore);
    });

    test('a change of page moves the focus to the h1, announces the title and keeps the header mounted', async ({
      page,
    }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();
      await page.evaluate(() => {
        document.querySelector('header')?.setAttribute('data-e2e-mounted', 'yes');
        document.querySelector('aside')?.setAttribute('data-e2e-mounted', 'yes');
      });

      await page.getByRole('complementary', { name: 'Navigazione principale' }).getByRole('link', { name: 'Prenotazioni' }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/bookings/);
      await expect(page.getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeFocused();
      await expect(page.getByTestId('route-announcer')).toHaveText('Prenotazioni');
      // One shell: the header and the sidebar are the same elements as before the click.
      await expect(page.locator('header')).toHaveAttribute('data-e2e-mounted', 'yes');
      await expect(page.locator('aside')).toHaveAttribute('data-e2e-mounted', 'yes');
      await expect(page.getByTestId('app-shell')).toHaveCount(1);
    });

    test('<html lang> follows the language chosen in the header', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'it');

      await page.getByTestId('language-switcher').locator('button', { hasText: 'EN' }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      await page.getByTestId('language-switcher').locator('button', { hasText: 'IT' }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    });

    test('the window scrolls while the header and the sidebar stay in place', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/payments/revenue', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: /Analisi ricavi|Revenue Analytics/i })).toBeVisible();

      // It is the window that scrolls, not an inner region.
      expect(
        await page.evaluate(() => document.documentElement.scrollHeight > document.documentElement.clientHeight),
      ).toBe(true);
      expect(await page.locator('main').evaluate((main) => getComputedStyle(main).overflowY)).toBe('visible');

      await page.evaluate(() => window.scrollTo(0, 300));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(300);

      const positions = await page.evaluate(() => ({
        header: document.querySelector('header')!.getBoundingClientRect().top,
        sidebarTop: document.querySelector('aside')!.getBoundingClientRect().top,
        sidebarHeight: document.querySelector('aside')!.getBoundingClientRect().height,
        viewportHeight: window.innerHeight,
      }));
      expect(positions.header).toBe(0);
      expect(positions.sidebarTop).toBe(0);
      expect(positions.sidebarHeight).toBe(positions.viewportHeight);
    });
  });

  test.describe('Mobile', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
      await resetE2eStorage(page, 'it');
    });

    test('opening a page from the menu leaves the focus on its heading, with no horizontal scroll', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();

      await page.getByRole('button', { name: 'Apri menu di navigazione' }).click();
      const drawer = page.getByRole('dialog');
      // "Incassi" is a secondary entry: it is in the menu, not in the bottom bar (see navigation.spec.ts).
      await drawer.getByRole('link', { name: /Incassi|Payments/i }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/payments/);
      await expect(drawer).not.toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: /Pagamenti|Payments/i })).toBeFocused();
      await expect(page.getByTestId('route-announcer')).not.toBeEmpty();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      ).toBe(true);
    });

    test('the bottom bar stays at the bottom of the screen while the window scrolls', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/payments/revenue', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: /Analisi ricavi|Revenue Analytics/i })).toBeVisible();

      await page.evaluate(() => window.scrollTo(0, 500));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);

      const bottomNav = await page.getByRole('navigation', { name: 'Navigazione mobile' }).boundingBox();
      const viewport = page.viewportSize()!;
      expect(bottomNav).not.toBeNull();
      expect(Math.round(bottomNav!.y + bottomNav!.height)).toBe(viewport.height);
      expect((await page.locator('header').boundingBox())!.y).toBe(0);
    });
  });
});
