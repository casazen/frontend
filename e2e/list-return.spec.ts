import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';

/**
 * UI-05, on the list of bookings of SR-04: the chip, the search and the filters are in the address, and the way back from a
 * booking leads to the list as the user left it (the breadcrumb on a computer, the link back on a phone). Demo mode (L2): the
 * API is mocked, and the mock does what the server does: it narrows the rows by the chip (`view`) and by the text (`q`).
 */
const LIST = '/app/short-rent/bookings';

function booking(id: string, firstName: string, status: string) {
  return {
    id,
    bookingCode: `ZEN${id.toUpperCase()}`,
    propertyId: 'property-1',
    userId: 'auth0|host',
    checkInDate: '2026-08-01T00:00:00Z',
    checkOutDate: '2026-08-05T00:00:00Z',
    numberOfGuests: 2,
    totalPrice: 450,
    currency: 'EUR',
    status,
    channel: 'Manual',
    paymentState: 'None',
    guest: { firstName, lastName: 'Rossi', email: `${id}@example.com`, phone: '', country: 'IT' },
    source: 'Manual',
    createdAt: '2026-06-01T08:00:00Z',
    updatedAt: '2026-06-01T08:00:00Z',
  };
}

const BOOKINGS = [booking('bk-1', 'Mario', 'Confirmed'), booking('bk-2', 'Giulia', 'Pending'), booking('bk-3', 'Luca', 'Cancelled')];
/** The chip each booking is in. */
const VIEW_OF: Record<string, string> = { 'bk-1': 'upcoming', 'bk-2': 'toConfirm', 'bk-3': 'cancelled' };

/** The bookings of the mock that a request asks for: the chip and the text, as the server reads them. */
function answer(url: URL, all = BOOKINGS, viewOf = VIEW_OF) {
  const view = url.searchParams.get('view') ?? 'all';
  const text = (url.searchParams.get('q') ?? '').toLowerCase();
  const named = all.filter((b) => !text || `${b.guest.firstName} ${b.guest.lastName}`.toLowerCase().includes(text));
  return { named, items: named.filter((b) => view === 'all' || viewOf[b.id] === view) };
}

async function mockBookings(page: Page, all = BOOKINGS, viewOf = VIEW_OF) {
  await page.route('**/api/bookings/search**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const { items } = answer(new URL(route.request().url()), all, viewOf);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, totalCount: items.length, page: 1, pageSize: 20 }) });
  });
  await page.route('**/api/bookings/counts**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const { named } = answer(new URL(route.request().url()), all, viewOf);
    const inView = (view: string) => named.filter((b) => viewOf[b.id] === view).length;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        all: named.length,
        toConfirm: inView('toConfirm'),
        upcoming: inView('upcoming'),
        inProgress: inView('inProgress'),
        completed: inView('completed'),
        cancelled: inView('cancelled'),
      }),
    });
  });
  await page.route(/\/api\/bookings\/bk-\d$/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const id = new URL(route.request().url()).pathname.split('/').pop();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(all.find((b) => b.id === id)) });
  });
}

const rows = (page: Page) => page.locator('tbody tr').filter({ hasText: 'Rossi' });
const search = (page: Page) => page.getByPlaceholder(/Cerca|Search/);
const chip = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
/** The booking of Mario, whichever way the list shows it (a row of the table, a card on a phone). */
const marioLink = (page: Page) => page.getByRole('link', { name: 'Mario Rossi' }).first();

/** Filters the list: the "Tutte" chip (the list starts from "In arrivo") and "mar" in the search. */
async function filterTheList(page: Page) {
  await page.goto(demoUrl(LIST, 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(rows(page)).toHaveCount(1);

  await chip(page, 'Tutte').click();
  await expect(page).toHaveURL(/chip=all/);
  // The list has drawn itself with the chip (the three bookings) before the search is typed, as a person does.
  await expect(rows(page)).toHaveCount(3);
  await search(page).fill('mar');
  await expect(page).toHaveURL(/q=mar/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText('Mario Rossi');
}

test.describe('Filters of the list in the address (UI-05, SR-04)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
    await mockBookings(page);
  });

  test.describe('Computer', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test('the chip and the search are in the address and filter the list', async ({ page }) => {
      await filterTheList(page);

      const url = new URL(page.url());
      expect(url.searchParams.get('chip')).toBe('all');
      expect(url.searchParams.get('q')).toBe('mar');
      await expect(rows(page).first()).toContainText('Mario Rossi');
    });

    test('the address with filters opens the list as it was left', async ({ page }) => {
      await page.goto(demoUrl(`${LIST}?chip=toConfirm&q=giu`, 'short-stay'), { waitUntil: 'domcontentloaded' });

      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText('Giulia Rossi');
      await expect(search(page)).toHaveValue('giu');
    });

    test('an address of the list as it was before (?status=) opens the chip it stands for', async ({ page }) => {
      await page.goto(demoUrl(`${LIST}?status=Cancelled`, 'short-stay'), { waitUntil: 'domcontentloaded' });

      await expect(rows(page)).toHaveCount(1);
      await expect(rows(page).first()).toContainText('Luca Rossi');
      const url = new URL(page.url());
      expect(url.searchParams.get('chip')).toBe('cancelled');
      expect(url.searchParams.get('status')).toBeNull();
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
      expect(url.searchParams.get('chip')).toBe('all');
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

      // The plain list is the one that starts from "In arrivo".
      await expect(rows(page)).toHaveCount(1);
      await expect(search(page)).toHaveValue('');
      expect(new URL(page.url()).searchParams.get('chip')).toBeNull();
      await expect(chip(page, 'In arrivo')).toHaveAttribute('aria-pressed', 'true');
    });

    test('changing a chip does not scroll the page to the top', async ({ page }) => {
      // Many bookings, so that the page scrolls: a page of 20 rows.
      const many = Array.from({ length: 40 }, (_unused, index) => booking(`bk-${index + 10}`, `Ospite${index}`, 'Confirmed'));
      const viewOf = Object.fromEntries(many.map((b) => [b.id, 'upcoming']));
      await mockBookings(page, many, viewOf);
      await page.goto(demoUrl(LIST, 'short-stay'), { waitUntil: 'domcontentloaded' });
      await expect(rows(page).first()).toBeVisible();
      const inProgress = chip(page, 'In corso');
      await inProgress.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, 120));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(120);

      await inProgress.click();

      await expect(page).toHaveURL(/chip=inProgress/);
      expect(await page.evaluate(() => window.scrollY)).toBe(120);
    });
  });

  test.describe('Phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('the link back of the booking leads to the list with the filters', async ({ page }) => {
      await filterTheList(page);
      await marioLink(page).click();
      await expect(page).toHaveURL(/\/bookings\/bk-1/);
      await expect(page.getByTestId('page-crumbs')).toBeHidden();

      await page.getByRole('link', { name: 'Torna a Prenotazioni' }).click();

      await expect(rows(page)).toHaveCount(1);
      await expect(search(page)).toHaveValue('mar');
      expect(new URL(page.url()).searchParams.get('chip')).toBe('all');
    });
  });
});
