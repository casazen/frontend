import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { resetE2eStorage } from './helpers/locale';

/**
 * UI-04b: navigation of the phone and of the tablet. On a phone the bottom bar has the four destinations of the area and
 * "Altro", which opens a sheet from the bottom with the rest and the area switcher; on a tablet the sidebar is a rail of
 * icons whose names show on hover and on keyboard focus. The old menu that slid in from the left is gone: the sheet is the
 * one menu of the phone (and the menu button of the header opens it too).
 *
 * While the sheet is open the page behind it is hidden from assistive technology (a modal dialog), the bar included:
 * what the specs read from the bar in that state they read by selector, not by role.
 */

const bar = (page: Page) => page.getByRole('navigation', { name: 'Navigazione mobile' });
/** "Altro" of the bar, in any state (by role it is not there while the modal sheet hides the page). */
const more = (page: Page) => page.locator('[data-more-trigger]');
const sheet = (page: Page) => page.getByRole('dialog', { name: 'Altro' });
const handle = (page: Page) => sheet(page).getByTestId('sheet-handle');

/**
 * How far the page scrolls sideways. What the specs ask is that what opens (the sheet, the menu) does not add to it: the
 * page behind may be wider than a phone with the font of the machine (the dashboard is, on Linux), and that is its own
 * business, not the navigation's.
 */
const pageWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

/** True when something inside the element is wider than it (it would scroll or stick out sideways). */
const sticksOut = (locator: Locator) => locator.evaluate((element) => element.scrollWidth > element.clientWidth);

/** The box of an element that slides (the sheet comes up in 280 ms): once it has stopped. */
async function settled(locator: Locator) {
  let previous = '';
  await expect
    .poll(async () => {
      const box = await locator.boundingBox();
      const key = box ? [box.x, box.y, box.width, box.height].map(Math.round).join(',') : '';
      const same = key !== '' && key === previous;
      previous = key;
      return same;
    })
    .toBe(true);
  return (await locator.boundingBox())!;
}

/** `count` "pay at the property" requests waiting for the host (the counter of Prenotazioni reads their number). */
async function waitingRequests(page: Page, count: number) {
  await page.route('**/api/bookings/approval-requests**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Array.from({ length: count }, (_unused, index) => ({ id: `request-${index + 1}` }))),
    }),
  );
}

async function dragDown(page: Page, grip: Locator, distance: number, { release = true } = {}) {
  const box = (await grip.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + distance, { steps: 8 });
  if (release) await page.mouse.up();
}

test.describe('Mobile navigation (UI-04b)', () => {
  test.describe('Phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test.beforeEach(async ({ page }) => {
      await resetE2eStorage(page, 'it');
    });

    test('"Altro" opens the sheet from the bottom, a page of it is reached, and Back comes back', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();

      await expect(more(page)).toHaveAttribute('aria-haspopup', 'dialog');
      await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
      await more(page).click();

      // The sheet is a dialog from the bottom edge, as wide as the screen, with the focus on it.
      await expect(sheet(page)).toBeVisible();
      await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(sheet(page)).toBeFocused();
      const box = await settled(sheet(page));
      expect(Math.round(box.x)).toBe(0);
      expect(Math.round(box.width)).toBe(390);
      expect(Math.round(box.y + box.height)).toBe(844);

      // What the bar does not list, in the groups of the sidebar; the area is named, with the organization.
      await expect(sheet(page).getByRole('group', { name: 'La tua offerta' })).toBeVisible();
      await expect(sheet(page).getByRole('group', { name: 'Gestione' })).toBeVisible();
      await expect(sheet(page).getByRole('group', { name: 'Altro' })).toBeVisible();
      await expect(sheet(page).getByTestId('area-header')).toContainText('Affitti brevi');
      await expect(sheet(page).getByRole('link', { name: 'Cruscotto' })).toHaveCount(0);

      // A page of "Altro" opens, the sheet goes, the heading of the page has the focus, "Altro" is the marked tab.
      await sheet(page).getByRole('link', { name: 'Profilo' }).click();
      await expect(page).toHaveURL(/\/app\/short-rent\/profile$/);
      await expect(sheet(page)).toBeHidden();
      await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
      await expect(more(page)).toHaveAttribute('aria-current', 'page');
      await expect(bar(page).getByRole('link', { name: 'Cruscotto' })).not.toHaveAttribute('aria-current');

      await page.goBack();
      await expect(page).toHaveURL(/\/app\/short-rent(\?.*)?$/);
      await expect(bar(page).getByRole('link', { name: 'Cruscotto' })).toHaveAttribute('aria-current', 'page');
      await expect(more(page)).not.toHaveAttribute('aria-current');
    });

    test('a page of the main menu that the bar does not list is reached from the sheet too', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await more(page).click();
      await sheet(page).getByRole('link', { name: 'Incassi' }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/payments$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Pagamenti' })).toBeFocused();
      await more(page).click();
      await expect(sheet(page).getByRole('link', { name: 'Incassi' })).toHaveAttribute('aria-current', 'page');
    });

    test('the keyboard opens the sheet, Tab stays inside it, Esc closes it and the focus goes back to "Altro"', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await more(page).focus();
      await page.keyboard.press('Enter');
      await expect(sheet(page)).toBeFocused();

      // The first Tab reaches the first tile; the focus never leaves the sheet (a trap).
      await page.keyboard.press('Tab');
      await expect(sheet(page).getByRole('link', { name: 'Sito di prenotazione' })).toBeFocused();
      for (let i = 0; i < 14; i += 1) {
        await page.keyboard.press('Tab');
        expect(await sheet(page).evaluate((element) => element.contains(document.activeElement))).toBe(true);
      }

      await page.keyboard.press('Escape');
      await expect(sheet(page)).toBeHidden();
      await expect(more(page)).toBeFocused();
      await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    });

    test('a tap on the dimmed page, the close button and the menu button of the header close it as well', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await more(page).click();
      await expect(sheet(page)).toBeVisible();
      await page.mouse.click(195, 60);
      await expect(sheet(page)).toBeHidden();

      await more(page).click();
      await sheet(page).getByRole('button', { name: 'Chiudi' }).click();
      await expect(sheet(page)).toBeHidden();
      await expect(more(page)).toBeFocused();

      // The menu button of the header (until the header is redrawn) opens the same sheet; the focus goes back to it.
      const menuButton = page.getByRole('button', { name: 'Apri menu di navigazione' });
      await menuButton.click();
      await expect(sheet(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet(page)).toBeHidden();
      await expect(menuButton).toBeFocused();
    });

    test('pulling the handle down follows the finger and closes the sheet; a short pull brings it back', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await more(page).click();
      const resting = await settled(sheet(page));

      // A short pull: it follows the pointer, and goes back when let go.
      await dragDown(page, handle(page), 20, { release: false });
      expect(Math.round((await sheet(page).boundingBox())!.y - resting.y)).toBe(20);
      await page.mouse.up();
      await expect.poll(async () => Math.round((await sheet(page).boundingBox())!.y)).toBe(Math.round(resting.y));
      await expect(sheet(page)).toBeVisible();

      // A long one closes it.
      await dragDown(page, handle(page), 220);
      await expect(sheet(page)).toBeHidden();
      await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    });

    test('a sheet taller than the screen scrolls inside itself and leaves the page visible above it', async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 480 });
      await page.goto(demoUrl('/app/short-rent/profile', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const before = await pageWidth(page);
      await more(page).click();

      const box = await settled(sheet(page));
      expect(box.height).toBeLessThanOrEqual(480 * 0.85 + 1);
      expect(Math.round(box.y + box.height)).toBe(480);

      const last = sheet(page).getByRole('link', { name: 'Organizzazione' });
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      // It scrolls up and down, never sideways, and the page behind does not get wider.
      expect(await sticksOut(sheet(page).locator('div.overflow-y-auto'))).toBe(false);
      expect(await pageWidth(page)).toBeLessThanOrEqual(before);
    });

    test('nothing sticks out at 360 and 390 px: the bar, the sheet and the open area switcher', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      for (const width of [360, 390]) {
        await page.setViewportSize({ width, height: 740 });
        await page.goto(demoUrl('/app/short-rent/profile', 'dual'), { waitUntil: 'domcontentloaded' });
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(bar(page)).toBeVisible();
        const before = await pageWidth(page);
        expect(await sticksOut(bar(page))).toBe(false);

        await more(page).click();
        await settled(sheet(page));
        expect(await pageWidth(page)).toBeLessThanOrEqual(before);
        expect(await sticksOut(sheet(page))).toBe(false);
        expect(await sticksOut(sheet(page).locator('div.overflow-y-auto'))).toBe(false);
        // Every tile is inside the sheet, which is inside the screen.
        for (const tile of await sheet(page).getByRole('link').all()) {
          const tileBox = (await tile.boundingBox())!;
          expect(tileBox.x).toBeGreaterThanOrEqual(0);
          expect(tileBox.x + tileBox.width).toBeLessThanOrEqual(width);
        }

        await sheet(page).getByTestId('area-switcher').click();
        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible();
        const menuBox = await settled(menu);
        expect(menuBox.x).toBeGreaterThanOrEqual(0);
        expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(width);
        expect(await pageWidth(page)).toBeLessThanOrEqual(before);
      }
    });

    test('the bar: four destinations and "Altro", each a touch target as tall as the bar, side by side without overflow', async ({ page }) => {
      for (const width of [360, 390]) {
        await page.setViewportSize({ width, height: 740 });
        await page.goto(demoUrl('/app/short-rent/profile', 'short-stay'), { waitUntil: 'domcontentloaded' });

        const tabs = bar(page).locator('a, button');
        await expect(tabs).toHaveCount(5);
        const boxes = await Promise.all((await tabs.all()).map((tab) => tab.boundingBox()));
        for (const tabBox of boxes) {
          expect(tabBox!.width).toBeGreaterThanOrEqual(44);
          expect(tabBox!.height).toBeGreaterThanOrEqual(44);
        }
        // A fifth of the screen each, inside it.
        expect(Math.round(boxes[0]!.x)).toBe(0);
        expect(Math.round(boxes[4]!.x + boxes[4]!.width)).toBe(width);
        expect(Math.abs(boxes[0]!.width - boxes[4]!.width)).toBeLessThan(1);
        expect(await sticksOut(bar(page))).toBe(false);
      }
    });

    test('requests waiting for the host show on the icon of "Prenotazioni", and the name says it', async ({ page }) => {
      await waitingRequests(page, 3);
      await page.goto(demoUrl('/app/short-rent/profile', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const bookings = bar(page).getByRole('link', { name: /Prenotazioni/ });
      await expect(bookings.getByTestId('nav-count')).toHaveText(/3/);
      await expect(bookings).toHaveAccessibleName(/^Prenotazioni\s*,\s*3 richieste da approvare$/);
      // The counter sits on the corner of the icon, inside the tab.
      const tabBox = (await bookings.boundingBox())!;
      const countBox = (await bookings.getByTestId('nav-count').boundingBox())!;
      expect(countBox.x).toBeGreaterThanOrEqual(tabBox.x);
      expect(countBox.x + countBox.width).toBeLessThanOrEqual(tabBox.x + tabBox.width);
      expect(countBox.y).toBeGreaterThanOrEqual(tabBox.y);
    });

    test('a toast shows above the bar, centered, and the bar is not covered by it', async ({ page }) => {
      // The profile of the staff console has a button that always answers with a toast (it copies a token).
      await page.goto(demoUrl('/app/admin/profile', 'admin'), { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Copia token' }).click();

      const toast = page.locator('[data-sonner-toast]').first();
      await expect(toast).toBeVisible();
      const barBox = (await bar(page).boundingBox())!;
      // The toast comes up from below: once it has settled it is above the bar, and inside the screen.
      await expect
        .poll(async () => {
          const box = (await toast.boundingBox())!;
          return Math.round(box.y + box.height);
        })
        .toBeLessThanOrEqual(Math.round(barBox.y));
      const toastBox = await settled(toast);
      expect(toastBox.x).toBeGreaterThanOrEqual(0);
      expect(toastBox.x + toastBox.width).toBeLessThanOrEqual(390);
      await expect(page.locator('[data-sonner-toaster]')).toHaveAttribute('data-y-position', 'bottom');
    });

    test('the staff console has its four destinations in the bar and the rest in the sheet', async ({ page }) => {
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
      await page.goto(demoUrl('/app/admin', 'admin'), { waitUntil: 'domcontentloaded' });

      await expect(bar(page).getByRole('link')).toHaveText(['Cruscotto', 'Utenti', 'Fornitori', 'Processi']);
      await more(page).click();
      await expect(sheet(page).getByRole('link', { name: 'SEO & Contenuti' })).toBeVisible();
      await expect(sheet(page).getByRole('link', { name: 'Conformità' })).toBeVisible();
      await expect(sheet(page).getByRole('link', { name: 'Profilo' })).toBeVisible();
    });

    test('a phone turned sideways keeps the bar; the sheet closes when the window grows to a tablet', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/profile', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await more(page).click();
      await expect(sheet(page)).toBeVisible();
      // By selector: the sheet is a modal dialog, which hides the page behind it from the accessibility tree.
      const phoneBar = page.locator('nav[aria-label="Navigazione mobile"]');
      const sidebarElement = page.locator('aside');

      await page.setViewportSize({ width: 700, height: 390 });
      await expect(sheet(page)).toBeVisible();
      await expect(phoneBar).toBeVisible();
      await expect(sidebarElement).toBeHidden();

      await page.setViewportSize({ width: 820, height: 1180 });
      await expect(sheet(page)).toBeHidden();
      await expect(phoneBar).toBeHidden();
      await expect(sidebarElement).toBeVisible();
      // And the page is usable again: nothing is left locking its scroll or hiding it.
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('#root')).not.toHaveAttribute('aria-hidden', 'true');
    });
  });

  test.describe('Tablet', () => {
    test.use({ viewport: { width: 768, height: 1024 } });

    test.beforeEach(async ({ page }) => {
      await resetE2eStorage(page, 'it');
    });

    const sidebar = (page: Page) => page.getByRole('complementary', { name: 'Navigazione principale' });
    const tooltip = (page: Page) => page.getByTestId('rail-tooltip');

    test('the sidebar is a rail of icons and the page keeps the width', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      await expect(sidebar(page)).toHaveAttribute('data-collapsed', 'true');
      expect((await sidebar(page).boundingBox())!.width).toBe(72);
      // No bar on a tablet; no names on the screen, no button to widen it (the window decides), no horizontal scroll.
      await expect(bar(page)).toBeHidden();
      await expect(sidebar(page).getByText('Ogni giorno')).toHaveCount(0);
      await expect(sidebar(page).getByTestId('sidebar-collapse-toggle')).toHaveCount(0);
      expect((await page.getByRole('main').boundingBox())!.width).toBeGreaterThan(768 - 72 - 1);

      // The names are still there for a screen reader, and the open page is marked.
      const dashboard = sidebar(page).getByRole('link', { name: 'Cruscotto' });
      await expect(dashboard).toBeVisible();
      await expect(dashboard).toHaveAttribute('aria-current', 'page');
      await expect(dashboard).not.toHaveAttribute('title');
    });

    test('the name of an icon shows on keyboard focus and on hover, one at a time, and Esc puts it away', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });

      // By keyboard: Tab from the first icon to the next one.
      await menu.getByRole('link', { name: 'Cruscotto' }).focus();
      await page.keyboard.press('Tab');
      await expect(menu.getByRole('link', { name: 'Calendario' })).toBeFocused();
      await expect(tooltip(page)).toHaveText('Calendario');
      // Beside the rail, level with its icon, in front of the page.
      const iconBox = (await menu.getByRole('link', { name: 'Calendario' }).boundingBox())!;
      const tipBox = (await tooltip(page).boundingBox())!;
      expect(tipBox.x).toBeGreaterThanOrEqual(72);
      expect(Math.abs(tipBox.y + tipBox.height / 2 - (iconBox.y + iconBox.height / 2))).toBeLessThan(2);

      // Esc hides it, the focus stays.
      await page.keyboard.press('Escape');
      await expect(tooltip(page)).toHaveCount(0);
      await expect(menu.getByRole('link', { name: 'Calendario' })).toBeFocused();

      // Moving on shows the next one's name only.
      await page.keyboard.press('Tab');
      await expect(tooltip(page)).toHaveText('Prenotazioni');

      // With the mouse on another icon, that one is the one that shows, and alone.
      await menu.getByRole('link', { name: 'Immobili' }).hover();
      await expect(tooltip(page)).toHaveText('Immobili');
      await expect(tooltip(page)).toHaveCount(1);
      await page.mouse.move(600, 600);
      await expect(tooltip(page)).toHaveCount(0);
    });

    test('"Altro" opens in the rail, its icons have names too, and a page of it opens', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      const menu = page.getByRole('navigation', { name: 'Menu Affitti brevi' });

      const other = menu.getByRole('button', { name: 'Altro' });
      await other.focus();
      await expect(tooltip(page)).toHaveText('Altro');
      await page.keyboard.press('Enter');
      await expect(other).toHaveAttribute('aria-expanded', 'true');

      await page.keyboard.press('Tab');
      await expect(menu.getByRole('link', { name: 'Ospiti' })).toBeFocused();
      await expect(tooltip(page)).toHaveText('Ospiti');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/app\/short-rent\/guests$/);
      await expect(menu.getByRole('link', { name: 'Ospiti' })).toHaveAttribute('aria-current', 'page');
    });

    test('with several areas the switcher is the icon of the area, with its name, and it works', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await page.goto(demoUrl('/app/short-rent', 'dual'), { waitUntil: 'domcontentloaded' });

      const switcher = sidebar(page).getByTestId('area-switcher');
      await expect(switcher).toHaveAccessibleName('Area attuale: Affitti brevi. Cambia area');
      expect((await switcher.boundingBox())!.width).toBeLessThanOrEqual(72);
      await switcher.focus();
      await expect(tooltip(page)).toHaveText('Affitti brevi');

      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitemradio', { name: /Affitti lunghi/ })).toBeVisible();
      await page.getByRole('menuitemradio', { name: /Affitti lunghi/ }).click();
      await expect(page).toHaveURL(/\/app\/long-rent\/leases/);
      await expect(page.getByRole('navigation', { name: 'Menu Affitti lunghi' })).toBeVisible();
    });

    test('with one area the heading of the rail is the icon, and it still says where the user is', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const heading = sidebar(page).getByTestId('area-header');
      await expect(heading).toContainText('Affitti brevi, Acme Stays');
      await heading.hover();
      await expect(tooltip(page)).toHaveText('Affitti brevi');
    });

    test('requests waiting for the host show as a counter on the icon, and the name still says it', async ({ page }) => {
      await waitingRequests(page, 2);
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });

      const bookings = sidebar(page).getByRole('link', { name: /Prenotazioni/ });
      await expect(bookings.getByTestId('nav-count')).toHaveText(/2/);
      await expect(bookings).toHaveAccessibleName(/^Prenotazioni\s*,\s*2 richieste da approvare$/);
      // Beside the icon it is the tooltip that shows, and it says the name only.
      await bookings.focus();
      await expect(tooltip(page)).toHaveText('Prenotazioni');
    });

    test('the sidebar is wide again from 1024 px and the rail comes back when the window narrows', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      expect((await sidebar(page).boundingBox())!.width).toBe(72);

      await page.setViewportSize({ width: 1024, height: 768 });
      await expect(sidebar(page)).toHaveAttribute('data-collapsed', 'false');
      await expect.poll(async () => (await sidebar(page).boundingBox())!.width).toBe(256);
      await expect(sidebar(page).getByText('Ogni giorno')).toBeVisible();
      await sidebar(page).getByRole('link', { name: 'Calendario' }).focus();
      await expect(tooltip(page)).toHaveCount(0);

      await page.setViewportSize({ width: 900, height: 768 });
      await expect(sidebar(page)).toHaveAttribute('data-collapsed', 'true');
      await expect.poll(async () => (await sidebar(page).boundingBox())!.width).toBe(72);
    });

    test('reduced by the user on a computer it is the same rail, and the preference survives a tablet', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
      await sidebar(page).getByRole('button', { name: 'Comprimi menu' }).click();
      await expect(sidebar(page)).toHaveAttribute('data-collapsed', 'true');

      // The click gave the toggle the focus; the keyboard goes back through the menu: the names show as tooltips.
      await page.keyboard.press('Shift+Tab');
      await expect(sidebar(page).getByRole('button', { name: 'Altro' })).toBeFocused();
      await expect(tooltip(page)).toHaveText('Altro');
      await page.keyboard.press('Shift+Tab');
      await expect(sidebar(page).getByRole('link', { name: 'Incassi' })).toBeFocused();
      await expect(tooltip(page)).toHaveText('Incassi');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await expect(sidebar(page).getByTestId('sidebar-collapse-toggle')).toBeFocused();
      await expect(tooltip(page)).toHaveText('Espandi menu');

      // Narrowed to a tablet and back, the preference is still there.
      await page.setViewportSize({ width: 820, height: 1000 });
      await expect(sidebar(page)).toHaveAttribute('data-collapsed', 'true');
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(sidebar(page)).toHaveAttribute('data-collapsed', 'true');
    });
  });
});
