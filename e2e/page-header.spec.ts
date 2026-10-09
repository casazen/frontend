import type { Locator, Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { resetE2eStorage } from './helpers/locale';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { chooseLanguage } from './helpers/profile-menu';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

/**
 * UI-05: the new page header on its pilot page (the detail of a long-term property) and the title of the tab. The trail
 * and the menu "⋯" for a computer; a link back and the primary action fixed above the bottom bar for a phone. Demo mode (L2):
 * the API is mocked, no stack.
 */
const PROPERTY_ID = 'prop-lr-1';
const PROPERTY_PATH = `/app/long-rent/properties/${PROPERTY_ID}`;

async function openPilot(page: Page) {
  await mockLeasesApiEmpty(page);
  await mockPropertiesApi(page, [
    buildCreatedProperty({ id: PROPERTY_ID, name: 'Bilocale Monza', city: 'Monza', address: 'Via Italia 1', postalCode: '20900', description: '' }),
  ]);
  // Registered after the mock above: the documents of the property (the properties mock leaves them to the spec).
  await page.route(`**/api/properties/${PROPERTY_ID}/documents`, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.goto(demoUrl(PROPERTY_PATH, 'long-term'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Bilocale Monza' })).toBeVisible();
}

/** The box of an element that slides into place (a toast does): once it has stopped. */
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

/** True when the page scrolls sideways: nothing of the header may make it do that. */
const scrollsSideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

test.describe('PageHeader v2: the pilot page (UI-05)', () => {
  test.describe('Computer', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ page }) => {
      await resetE2eStorage(page, 'it');
    });

    test('the trail says where the page sits, and its steps lead there', async ({ page }) => {
      await openPilot(page);

      const trail = page.getByRole('navigation', { name: 'Percorso di navigazione' });
      await expect(trail).toBeVisible();
      await expect(trail.getByRole('listitem')).toHaveText(['Affitti lunghi', 'Immobili', 'Bilocale Monza']);
      await expect(trail.getByText('Bilocale Monza')).toHaveAttribute('aria-current', 'page');
      // The way back of a phone is not there.
      await expect(page.getByTestId('back-link')).toBeHidden();

      await trail.getByRole('link', { name: 'Immobili' }).click();
      await expect(page).toHaveURL(/\/app\/long-rent\/properties(\?|$)/);
    });

    test('one primary action next to the title, the others in the menu of the three dots', async ({ page }) => {
      await openPilot(page);

      const primary = page.getByTestId('long-rent-property-new-lease');
      await expect(primary).toBeVisible();
      await expect(primary).toHaveText('Nuovo contratto');
      await expect(primary).toHaveAttribute('href', `/app/long-rent/leases/new?propertyId=${PROPERTY_ID}`);
      // Not the fixed bar of a phone: it sits in the header, on the right of the title.
      expect(await page.getByTestId('page-header-primary').evaluate((element) => getComputedStyle(element).position)).not.toBe('fixed');

      await expect(page.getByTestId('long-rent-property-edit')).toHaveCount(0);
      await page.getByRole('button', { name: 'Altre azioni' }).click();
      const edit = page.getByRole('menuitem', { name: 'Modifica' });
      await expect(edit).toBeVisible();
      await edit.click();

      await expect(page).toHaveURL(new RegExp(`/app/long-rent/properties/${PROPERTY_ID}/edit$`));
    });

    test('the menu of the three dots works from the keyboard and gives the focus back', async ({ page }) => {
      await openPilot(page);
      const more = page.getByRole('button', { name: 'Altre azioni' });

      await more.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('menuitem', { name: 'Modifica' })).toBeFocused();
      await page.keyboard.press('Escape');

      await expect(page.getByRole('menu')).toBeHidden();
      await expect(more).toBeFocused();
    });

    test('the tab carries the title of the page, the area and the brand, in the language in use', async ({ page }) => {
      await openPilot(page);
      await expect(page).toHaveTitle('Bilocale Monza · Affitti lunghi · CasaZen');

      await chooseLanguage(page, 'English');

      await expect(page).toHaveTitle('Bilocale Monza · Long-term rentals · CasaZen');
    });

    test('the header and the title stay in place under the sticky header when the page is anchored', async ({ page }) => {
      await openPilot(page);

      // The header is the one height of the app (--header-height), and the page header starts below it.
      const header = await page.locator('header').boundingBox();
      const title = await page.getByRole('heading', { level: 1, name: 'Bilocale Monza' }).boundingBox();
      expect(header!.height).toBe(64);
      expect(title!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    });
  });

  for (const width of [390, 360]) {
    test.describe(`Phone, ${width} px wide`, () => {
      test.use({ viewport: { width, height: 800 } });

      test.beforeEach(async ({ page }) => {
        await resetE2eStorage(page, 'it');
      });

      test('a link back takes the place of the trail', async ({ page }) => {
        await openPilot(page);

        await expect(page.getByTestId('page-crumbs')).toBeHidden();
        const back = page.getByRole('link', { name: 'Torna a Immobili' });
        await expect(back).toBeVisible();
        const box = await back.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);

        await back.click();
        await expect(page).toHaveURL(/\/app\/long-rent\/properties(\?|$)/);
      });

      test('the primary action is fixed above the bottom bar, as wide as the screen and a finger tall', async ({ page }) => {
        await openPilot(page);

        const primary = page.getByTestId('long-rent-property-new-lease');
        await expect(primary).toBeVisible();
        const wrapper = page.getByTestId('page-header-primary');
        expect(await wrapper.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');

        const button = (await primary.boundingBox())!;
        const bar = (await page.getByRole('navigation', { name: 'Navigazione mobile' }).boundingBox())!;
        const viewport = page.viewportSize()!;
        expect(button.height).toBeGreaterThanOrEqual(44);
        // Over the bottom bar, not behind it; inside the screen with a margin on each side.
        expect(button.y + button.height).toBeLessThanOrEqual(bar.y);
        expect(button.x).toBeGreaterThanOrEqual(8);
        expect(button.x + button.width).toBeLessThanOrEqual(viewport.width - 8);
        expect(button.width).toBeGreaterThan(viewport.width - 48);

        // It stays where it is while the page scrolls.
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const afterScroll = (await primary.boundingBox())!;
        expect(Math.round(afterScroll.y)).toBe(Math.round(button.y));
      });

      test('the page makes room for the fixed action: its last line is not hidden under it', async ({ page }) => {
        await openPilot(page);

        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const primary = (await page.getByTestId('long-rent-property-new-lease').boundingBox())!;
        const lastCard = (await page.locator('main > div').last().locator('> *').last().boundingBox())!;
        expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(primary.y + 1);
      });

      test('nothing makes the page scroll sideways', async ({ page }) => {
        await openPilot(page);

        expect(await scrollsSideways(page)).toBe(false);
      });

      test('nothing makes the page scroll sideways with letters much wider than the ones of this machine', async ({ page }) => {
        await openPilot(page);

        // Verdana with extra spacing is far wider than Segoe UI and than the fonts of the Linux machines of the CI: the check does
        // not depend on the fonts installed (the header, the buttons of the cards and the bar all have to give way).
        await page.addStyleTag({
          content: '* { font-family: Verdana, "DejaVu Sans", sans-serif !important; letter-spacing: 0.04em !important; word-spacing: 0.1em !important; }',
        });
        await page.waitForTimeout(300);

        expect(await scrollsSideways(page)).toBe(false);
      });

      test('a toast comes up above the fixed action, not behind it', async ({ page }) => {
        await openPilot(page);
        // A save that fails shows the server's reason in a toast (the form of the cadastral data).
        await page.route(`**/api/properties/${PROPERTY_ID}/cadastral`, async (route) => {
          await route.fulfill({
            status: 422,
            contentType: 'application/problem+json',
            body: JSON.stringify({ status: 422, title: 'Dati non validi', detail: 'Dati catastali non validi' }),
          });
        });

        await page.getByTestId('property-cadastral').getByRole('button', { name: 'Modifica' }).click();
        await page.getByRole('button', { name: 'Salva' }).click();

        const toast = page.locator('[data-sonner-toast]').first();
        await expect(toast).toBeVisible();
        const primary = (await page.getByTestId('long-rent-property-new-lease').boundingBox())!;
        const box = await settled(toast);
        expect(box.y + box.height).toBeLessThanOrEqual(primary.y);
        // And over the bar, which is under the action: the whole stack is clear of the bottom of the screen.
        expect(box.y + box.height).toBeLessThan(page.viewportSize()!.height - 64);
      });

      test('the menu of the three dots is a finger tall and opens inside the screen', async ({ page }) => {
        await openPilot(page);

        const more = page.getByRole('button', { name: 'Altre azioni' });
        const trigger = (await more.boundingBox())!;
        expect(trigger.width).toBeGreaterThanOrEqual(44);
        expect(trigger.height).toBeGreaterThanOrEqual(44);

        await more.click();
        const item = page.getByRole('menuitem', { name: 'Modifica' });
        const box = (await item.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      });
    });
  }
});

test.describe('The title of the tab (UI-05)', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('every page puts its own name on the tab, with the area it is in', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Cruscotto' })).toBeVisible();
    await expect(page).toHaveTitle('Cruscotto · Affitti brevi · CasaZen');

    await page.getByRole('complementary', { name: 'Navigazione principale' }).getByRole('link', { name: 'Prenotazioni' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeVisible();
    await expect(page).toHaveTitle('Prenotazioni · Affitti brevi · CasaZen');
    // And what the screen reader announces at the change of page is the heading, as before.
    await expect(page.getByTestId('route-announcer')).toHaveText('Prenotazioni');
  });
});
