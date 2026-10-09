import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';

/**
 * UI-05: the filters of the list of bookings are in the address, and the way back from a booking leads to the list as the
 * user left it (the breadcrumb on a computer, the link back on a phone). Demo mode (L2): the API is mocked.
 */
const LIST = '/app/short-rent/bookings';

function booking(id: string, firstName: string, status: string) {
  return {
    id,
    propertyId: 'property-1',
    userId: 'auth0|host',
    checkInDate: '2026-08-01T00:00:00Z',
    checkOutDate: '2026-08-05T00:00:00Z',
    numberOfGuests: 2,
    totalPrice: 450,
    currency: 'EUR',
    status,
    guest: { firstName, lastName: 'Rossi', email: `${id}@example.com`, phone: '', country: 'IT' },
    source: 'Manual',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
  };
}

const BOOKINGS = [booking('bk-1', 'Mario', 'Confirmed'), booking('bk-2', 'Giulia', 'Pending'), booking('bk-3', 'Luca', 'Cancelled')];

async function mockBookings(page: Page) {
  await page.route('**/api/bookings', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKINGS) });
  });
  await page.route(/\/api\/bookings\/bk-\d$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const id = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOKINGS.find((b) => b.id === id)) });
  });
}

const rows = (page: Page) => page.locator('tbody tr').filter({ hasText: 'Rossi' });
const search = (page: Page) => page.getByPlaceholder(/Cerca|Search/);

/** Filters the list: the "Confermata" tab and "mar" in the search. */
async function filterTheList(page: Page) {
  await page.goto(demoUrl(LIST, 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(rows(page)).toHaveCount(3);

  await page.getByRole('button', { name: 'Confermata' }).click();
  await expect(page).toHaveURL(/status=Confirmed/);
  // The list has drawn itself with the tab (only the confirmed booking is left) before the search is typed, as a person does.
  await expect(rows(page)).toHaveCount(1);
  await search(page).fill('mar');
  await expect(page).toHaveURL(/q=mar/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Mario Rossi');
}

test.describe('Filters of the list in the address (UI-05)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
    await mockBookings(page);
  });

  test.describe('Computer', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('the tab and the search are in the address and filter the list', async ({ page }) => {
      await filterTheList(page);

      const url = new URL(page.url());
      expect(url.searchParams.get('status')).toBe('Confirmed');
      expect(url.searchParams.get('q')).toBe('mar');
      await expect(rows(page).first()).toContainText('Mario Rossi');
    });

    test('the address with filters opens the list as it was left', async ({ page }) => {
      await page.goto(demoUrl(`${LIST}?status=Pending&q=giu`, 'short-stay'), { waitUntil: 'domcontentloaded' });

      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText('Giulia Rossi');
      await expect(search(page)).toHaveValue('giu');
    });

    test('the breadcrumb of the booking leads back to the list with the filters', async ({ page }) => {
      await filterTheList(page);

      await rows(page).first().click();
      await expect(page).toHaveURL(/\/app\/short-rent\/bookings\/bk-1/);
      const trail = page.getByRole('navigation', { name: 'Percorso di navigazione' });
      await expect(trail.getByRole('listitem')).toHaveText(['Affitti brevi', 'Prenotazioni', 'Prenotazione bk-1']);

      await trail.getByRole('link', { name: 'Prenotazioni' }).click();

      await expect(page).toHaveURL(/\/app\/short-rent\/bookings\?/);
      const url = new URL(page.url());
      expect(url.searchParams.get('status')).toBe('Confirmed');
      expect(url.searchParams.get('q')).toBe('mar');
      await expect(rows(page)).toHaveCount(1);
      await expect(search(page)).toHaveValue('mar');
    });

    test('the Back button of the browser gives the list as it was left too', async ({ page }) => {
      await filterTheList(page);
      await rows(page).first().click();
      await expect(page).toHaveURL(/\/bookings\/bk-1/);

      await page.goBack();

      await expect(rows(page)).toHaveCount(1);
      await expect(search(page)).toHaveValue('mar');
    });

    test('the menu opens the plain list again: the way back from a booking is the way back, not a trap', async ({ page }) => {
      await filterTheList(page);
      await rows(page).first().click();
      await expect(page).toHaveURL(/\/bookings\/bk-1/);

      await page.getByRole('complementary', { name: 'Navigazione principale' }).getByRole('link', { name: 'Prenotazioni' }).click();

      await expect(rows(page)).toHaveCount(3);
      await expect(search(page)).toHaveValue('');
      expect(new URL(page.url()).searchParams.get('status')).toBeNull();
    });

    test('changing a filter does not scroll the page to the top', async ({ page }) => {
      // Many bookings, so that the page scrolls.
      await page.route('**/api/bookings', async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback();
          return;
        }
        const many = Array.from({ length: 40 }, (_unused, index) => booking(`bk-${index + 10}`, `Ospite${index}`, index % 2 ? 'Confirmed' : 'Pending'));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(many) });
      });
      await page.goto(demoUrl(LIST, 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(rows(page).first()).toBeVisible();
      const tab = page.getByRole('button', { name: 'Confermata' });
      await tab.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 120));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(120);

      await tab.click();

      await expect(page).toHaveURL(/status=Confirmed/);
      expect(await page.evaluate(() => window.scrollY)).toBe(120);
    });
  });

  test.describe('Phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the link back of the booking leads to the list with the filters', async ({ page }) => {
      await filterTheList(page);
      await rows(page).first().click();
      await expect(page).toHaveURL(/\/bookings\/bk-1/);
      await expect(page.getByTestId('page-crumbs')).toBeHidden();

      await page.getByRole('link', { name: 'Torna a Prenotazioni' }).click();

      await expect(rows(page)).toHaveCount(1);
      await expect(search(page)).toHaveValue('mar');
      expect(new URL(page.url()).searchParams.get('status')).toBe('Confirmed');
    });
  });
});
