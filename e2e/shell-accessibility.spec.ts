import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';
import { chooseLanguage, moreOfTheBar, openProfileMenu, profileMenuTrigger } from './helpers/profile-menu';

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

    test('<html lang> follows the language chosen in the profile menu', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', 'it');

      await chooseLanguage(page, 'English');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      await chooseLanguage(page, 'Italiano');
      await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    });

    test('the profile menu works from the keyboard: the arrows, Enter on a language, Escape and the focus back', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();
      const avatar = profileMenuTrigger(page);

      // The name of the avatar says whose menu it is, and it opens with Enter.
      await expect(avatar).toHaveAttribute('aria-label', /^Menu utente: /);
      await avatar.focus();
      await page.keyboard.press('Enter');
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible();
      await expect(menu.getByRole('menuitem')).toHaveText(['Profilo', 'Esci']);
      await expect(menu.getByRole('menuitemradio')).toHaveText(['Italiano', 'English', 'Affitti brevi', 'Affitti lunghi']);

      // Home and End walk the rows, Escape closes the menu and the focus is back on the avatar.
      await page.keyboard.press('End');
      await expect(menu.getByRole('menuitem', { name: 'Esci' })).toBeFocused();
      await page.keyboard.press('Home');
      await expect(menu.getByRole('menuitem', { name: 'Profilo' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(avatar).toBeFocused();

      // A language is chosen with the keyboard too: the whole page, and <html lang>, follow.
      await page.keyboard.press('Enter');
      await menu.getByRole('menuitemradio', { name: 'English' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
      await expect(avatar).toBeFocused();
    });

    test('the profile menu offers the areas of the user and goes to the one chosen', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();

      const menu = await openProfileMenu(page);
      await expect(menu.getByRole('menuitemradio', { name: 'Affitti brevi' })).toHaveAttribute('aria-checked', 'true');
      await menu.getByRole('menuitemradio', { name: 'Affitti lunghi' }).click();

      await expect(page).toHaveURL(/\/app\/long-rent/);
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

      await moreOfTheBar(page).click();
      const sheet = page.getByRole('dialog');
      // "Incassi" is a secondary entry: it is in the sheet "Altro", not in the bottom bar (see navigation.spec.ts).
      await sheet.getByRole('link', { name: /Incassi|Payments/i }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/payments/);
      await expect(sheet).not.toBeVisible();
      await expect(page.getByRole('heading', { level: 1, name: /Pagamenti|Payments/i })).toBeFocused();
      await expect(page.getByTestId('route-announcer')).not.toBeEmpty();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
      ).toBe(true);
    });

    test('the sheet "Altro" ends with the account: the profile, the language in buttons a finger tall, and the exit', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();

      await moreOfTheBar(page).click();
      const sheet = page.getByRole('dialog');
      const row = sheet.getByTestId('sheet-account').getByRole('button', { name: /Profilo e lingua/ });
      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'true');

      const account = sheet.getByTestId('sheet-account');
      await expect(account.getByRole('link', { name: 'Profilo' })).toBeVisible();
      await expect(account.getByRole('button', { name: 'Esci' })).toBeVisible();
      for (const name of ["Passa all'italiano", "Passa all'inglese"]) {
        const box = await account.getByRole('button', { name }).boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(44);
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }

      await account.getByRole('button', { name: "Passa all'inglese" }).click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
      await expect(sheet.getByRole('heading', { name: 'More' })).toBeVisible();
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
