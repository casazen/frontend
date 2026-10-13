import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import { demoUrl, type DemoProfile } from './helpers/demo-profile';
import { mockLeasesApiEmpty } from './helpers/lease-api-mock';
import { pinE2eLocale } from './helpers/locale';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import {
  WIDER_LETTERS,
  expectInsideTheScreen,
  expectNoAxeViolations,
  expectNothingSticksOut,
  untilStill,
} from './helpers/ui-checks';

/**
 * UI-06: the global search, Ctrl/Cmd+K. It opens from the keyboard and from the header, finds the pages of the menus, the
 * actions and the properties, bookings and guests the pages have already loaded, shows only what the user may open, goes
 * where the result says, and works from the keyboard and with a screen reader. The API of the demo mode is mocked, and the
 * palette makes no request of its own.
 */

const palette = (page: Page) => page.getByRole('dialog', { name: 'Cerca' });
const box = (page: Page) => palette(page).getByRole('combobox');
const options = (page: Page) => palette(page).getByRole('option');
const group = (page: Page, name: string) => palette(page).getByRole('group', { name });
const trigger = (page: Page) => page.getByTestId('command-palette-trigger');
const menuLink = (page: Page, area: string, name: string) =>
  page.getByRole('navigation', { name: `Menu ${area}` }).getByRole('link', { name });

/** The page is up (the header says the workspace is loaded) on the page of `path`, for the person of `profile`. */
async function openPage(page: Page, path: string, profile: DemoProfile) {
  await page.goto(demoUrl(path, profile), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('app-ready')).toBeVisible();
}

/** Ctrl+K, and the box of the palette is there with the focus in it. */
async function openFromKeyboard(page: Page) {
  await page.keyboard.press('Control+K');
  await expect(palette(page)).toBeVisible();
  await expect(box(page)).toBeFocused();
  await untilStill(page);
}

async function search(page: Page, text: string) {
  await box(page).fill(text);
}

const LAGO = buildCreatedProperty({ id: 'prop-lago', name: 'Casa del Lago', city: 'Como' });
const MARE = buildCreatedProperty({ id: 'prop-mare', name: 'Villa Mare', city: 'Roma' });

const BOOKING = {
  id: 'booking-e2e-0001',
  propertyId: LAGO.id,
  propertyName: LAGO.name,
  userId: 'auth0|demo-e2e',
  checkInDate: '2026-11-20',
  checkOutDate: '2026-11-23',
  numberOfGuests: 2,
  totalPrice: 450,
  currency: 'EUR',
  status: 'Confirmed',
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com', phone: '+39 333 1234567', country: 'IT' },
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const GUEST = {
  id: 'guest-e2e-0001',
  firstName: 'Mario',
  lastName: 'Rossi',
  email: 'mario.rossi@example.com',
  phoneNumber: '+39 333 1234567',
  city: 'Roma',
  country: 'IT',
  createdAt: '2026-09-20T10:00:00Z',
};

/** The list of bookings and the list of guests, answered the way the API answers (a page). */
async function mockBookingsAndGuests(page: Page) {
  const answerWith = (path: string, body: unknown) =>
    page.route(`**${path}**`, async (route) => {
      // `**/api/bookings**` also matches the Vite module `/src/api/bookings.api.ts`: only the list of the API is answered.
      if (new URL(route.request().url()).pathname.replace(/\/$/, '') !== path || route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
  await answerWith('/api/bookings', { items: [BOOKING], totalCount: 1, page: 1, pageSize: 10 });
  await answerWith('/api/guests', { items: [GUEST], totalCount: 1, page: 1, pageSize: 20 });
}

test.describe('Command palette (UI-06)', () => {
  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
  });

  test.describe('Desktop', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('Ctrl+K opens it from anywhere with the focus in the box, Esc closes it and gives the focus back', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      const link = menuLink(page, 'Affitti brevi', 'Prenotazioni');
      await link.focus();

      await openFromKeyboard(page);
      await expect(box(page)).toHaveAttribute('aria-expanded', 'true');
      await expect(box(page)).toHaveAttribute('aria-autocomplete', 'list');
      // The page behind is out of reach of assistive technology while the dialog is open; nothing has moved.
      await expect(page).toHaveURL(/\/app\/short-rent(\?|$)/);

      await page.keyboard.press('Escape');
      await expect(palette(page)).toBeHidden();
      await expect(link).toBeFocused();
    });

    test('the search of the header opens it too, and Ctrl+K closes it again with the focus on the search', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');

      await expect(trigger(page)).toHaveAccessibleName('Cerca immobili, prenotazioni, ospiti, pagine…');
      await expect(trigger(page)).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
      await trigger(page).click();
      await expect(palette(page)).toBeVisible();
      await expect(box(page)).toBeFocused();

      await page.keyboard.press('Control+K');
      await expect(palette(page)).toBeHidden();
      await expect(trigger(page)).toBeFocused();
    });

    test('the search of the header is reached with Tab and opens with Enter or Space', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');

      await trigger(page).focus();
      await page.keyboard.press('Enter');
      await expect(palette(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(trigger(page)).toBeFocused();

      await page.keyboard.press('Space');
      await expect(palette(page)).toBeVisible();
      await expect(box(page)).toBeFocused();
    });

    test('there is no keyboard trap: Tab leaves the box for the close button, Shift+Tab comes back, Esc closes', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await page.keyboard.press('Tab');
      await expect(palette(page).getByRole('button', { name: 'Chiudi' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(box(page)).toBeFocused();
      // The focus does not escape to the page behind while the dialog is open.
      for (let tabs = 0; tabs < 4; tabs += 1) await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.closest('[role="dialog"]') !== null)).toBe(true);

      await page.keyboard.press('Escape');
      await expect(palette(page)).toBeHidden();
    });

    test('it opens from a text field and Esc brings the focus back to the field', async ({ page }) => {
      await mockBookingsAndGuests(page);
      await openPage(page, '/app/short-rent/bookings', 'short-stay');
      await expect(page.getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeVisible();
      const field = page.getByRole('main').getByRole('textbox').first();
      await field.focus();

      await openFromKeyboard(page);
      await page.keyboard.press('Escape');
      await expect(palette(page)).toBeHidden();
      await expect(field).toBeFocused();
    });

    test('with nothing typed it suggests a few actions and pages of the area, and says nothing else', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await expect(box(page)).toHaveAttribute('placeholder', 'Cerca immobili, prenotazioni, ospiti, pagine…');
      await expect(group(page, 'Azioni').getByRole('option')).toHaveText([/Crea una prenotazione/, /Aggiungi un immobile/, /Registra un pagamento/]);
      await expect(group(page, 'Pagine').getByRole('option').first()).toContainText('Cruscotto');
      // The actions of the account (language, sign out) are found by typing, they are not offered here.
      await expect(palette(page)).not.toContainText('Esci');
      await expect(palette(page).getByRole('status')).toHaveText('');
    });

    test('a page is found by a part of its name, Enter opens it and the heading of the page takes the focus', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await search(page, 'preno');
      const first = options(page).first();
      await expect(first).toContainText('Prenotazioni');
      await expect(first).toHaveAttribute('aria-selected', 'true');
      await expect(box(page)).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id')) ?? '');
      // Only what was typed is underlined.
      await expect(first.locator('[data-match]')).toHaveText('Preno');

      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/app\/short-rent\/bookings$/);
      await expect(palette(page)).toBeHidden();
      await expect(page.getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeFocused();

      // It remembers what was chosen, by the id of the item, and offers it first the next time.
      await page.keyboard.press('Control+K');
      await expect(group(page, 'Recenti').getByRole('option')).toHaveText([/Prenotazioni/]);
    });

    test('a word that is not the name of the page finds it too (synonyms), and an action is found by its words', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await search(page, 'oggi');
      await expect(group(page, 'Pagine').getByRole('option').first()).toContainText('Cruscotto');

      await search(page, 'nuova prenotazione');
      await expect(group(page, 'Azioni').getByRole('option').first()).toContainText('Crea una prenotazione');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/app\/short-rent\/bookings\/create$/);
    });

    test('singular and plural, capitals and accents do not matter', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await search(page, 'IMMOBILE');
      await expect(group(page, 'Pagine').getByRole('option').first()).toContainText('Immobili');
      await search(page, 'disponibilita');
      await expect(group(page, 'Pagine').getByRole('option').first()).toContainText('Calendario');
    });

    test('the arrows, Home and End move through the results and the box keeps the focus', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      const all = options(page);
      const count = await all.count();
      expect(count).toBeGreaterThan(3);
      const activeIndex = async () => all.evaluateAll((rows) => rows.findIndex((row) => row.getAttribute('aria-selected') === 'true'));

      expect(await activeIndex()).toBe(0);
      await page.keyboard.press('ArrowDown');
      expect(await activeIndex()).toBe(1);
      await page.keyboard.press('End');
      expect(await activeIndex()).toBe(count - 1);
      await page.keyboard.press('ArrowDown');
      expect(await activeIndex()).toBe(0);
      await page.keyboard.press('ArrowUp');
      expect(await activeIndex()).toBe(count - 1);
      await page.keyboard.press('Home');
      expect(await activeIndex()).toBe(0);

      await expect(box(page)).toBeFocused();
      const active = all.nth(1);
      await page.keyboard.press('ArrowDown');
      await expect(box(page)).toHaveAttribute('aria-activedescendant', (await active.getAttribute('id')) ?? '');
    });

    test('the mouse moves the cursor over the results and a click chooses', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);
      await search(page, 'incass');

      // Two results: the page and, after it, the page of the revenue ("Ricavi" is found by the words of the earnings).
      const row = options(page).first();
      await expect(row).toContainText('Incassi');
      await row.hover();
      await expect(row).toHaveAttribute('aria-selected', 'true');
      await options(page).last().hover();
      await expect(options(page).last()).toHaveAttribute('aria-selected', 'true');
      await expect(row).toHaveAttribute('aria-selected', 'false');
      await row.click();
      await expect(page).toHaveURL(/\/app\/short-rent\/payments(\?|$)/);
      await expect(palette(page)).toBeHidden();
    });

    test('what the pages have loaded is found: properties, then bookings and guests, with no request of its own', async ({ page }) => {
      await mockPropertiesApi(page, [LAGO, MARE]);
      await mockBookingsAndGuests(page);
      await openPage(page, '/app/short-rent/properties', 'short-stay');
      await expect(page.getByText('Casa del Lago').first()).toBeVisible();

      const requests: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).pathname.startsWith('/api/')) requests.push(request.url());
      });

      await openFromKeyboard(page);
      await search(page, 'lago');
      const property = group(page, 'Immobili').getByRole('option');
      await expect(property).toHaveCount(1);
      await expect(property).toContainText('Casa del Lago');
      await expect(property).toContainText('Como');
      // The city finds it too, a little lower than the name.
      await search(page, 'como');
      await expect(group(page, 'Immobili').getByRole('option')).toContainText('Casa del Lago');
      // Nobody has loaded the bookings yet: they are not here.
      await search(page, 'rossi');
      await expect(palette(page).getByTestId('command-palette-empty')).toContainText('Nessun risultato per «rossi»');
      expect(requests, 'the palette asked the server for nothing').toEqual([]);

      // Going to the bookings and the guests with the palette itself (the page is not reloaded: the cache stays).
      await search(page, 'prenotazioni');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { level: 1, name: 'Prenotazioni' })).toBeFocused();
      await expect(page.getByText('Mario Rossi').first()).toBeVisible();
      await page.keyboard.press('Control+K');
      await expect(palette(page)).toBeVisible();
      await search(page, 'ospiti');
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { level: 1, name: 'Ospiti' })).toBeFocused();
      await expect(page.getByTestId('guest-list')).toBeVisible();

      await page.keyboard.press('Control+K');
      await expect(palette(page)).toBeVisible();
      await search(page, 'rossi');
      const booking = group(page, 'Prenotazioni').getByRole('option');
      await expect(booking).toHaveCount(1);
      await expect(booking).toContainText('Mario Rossi');
      await expect(booking).toContainText('Casa del Lago');
      await expect(booking).toContainText('20 nov');
      const guest = group(page, 'Ospiti').getByRole('option');
      await expect(guest).toHaveCount(1);
      await expect(guest).toContainText('Mario Rossi');

      // Privacy: a name and nothing else of a person is on the screen, and the palette keeps nothing it was told.
      const text = (await palette(page).innerText()).toLowerCase();
      for (const secret of ['mario.rossi@example.com', '333 1234567', 'example.com']) expect(text).not.toContain(secret);

      await guest.click();
      await expect(page).toHaveURL(/\/app\/short-rent\/guests\/guest-e2e-0001$/);
      const stored = await page.evaluate(() => Object.entries(localStorage).map(([key, value]) => `${key}=${value}`).join('\n'));
      const recents = await page.evaluate(() =>
        Object.entries(localStorage)
          .filter(([key]) => key.startsWith('casazen:palette'))
          .map(([, value]) => value)
          .join('\n'),
      );
      expect(recents).toContain('guest:guest-e2e-0001');
      expect(recents.toLowerCase()).not.toContain('rossi');
      expect(stored.toLowerCase()).not.toContain('rossi');
    });

    test('a property found goes to its page', async ({ page }) => {
      await mockPropertiesApi(page, [LAGO, MARE]);
      await openPage(page, '/app/short-rent/properties', 'short-stay');
      await expect(page.getByText('Villa Mare').first()).toBeVisible();

      await openFromKeyboard(page);
      await search(page, 'villa');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/app\/short-rent\/properties\/prop-mare$/);
    });

    test('nothing found says so, in the box and for a screen reader', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await search(page, 'qwxz');
      await expect(palette(page).getByTestId('command-palette-empty')).toContainText('Nessun risultato per «qwxz»');
      await expect(box(page)).toHaveAttribute('aria-expanded', 'false');
      await expect(palette(page).getByRole('status')).toHaveText('Nessun risultato');

      await search(page, 'pren');
      await expect(palette(page).getByRole('status')).toHaveText(/\d+ risultati disponibili/);
    });

    test('it has no accessibility violation, contrast included, with results, with none and with the suggestions', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);
      await expectNoAxeViolations(page, { include: '[data-testid="command-palette"]' });

      await search(page, 'prenotazione');
      await expect(options(page).first()).toBeVisible();
      await expectNoAxeViolations(page, { include: '[data-testid="command-palette"]' });

      await search(page, 'qwxz');
      await expect(palette(page).getByTestId('command-palette-empty')).toBeVisible();
      await expectNoAxeViolations(page, { include: '[data-testid="command-palette"]' });
    });

    test('the keys of the language and of the area do what they say', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await openPage(page, '/app/short-rent', 'dual');
      await openFromKeyboard(page);

      // With two areas the same page of each is told apart by the area in its second line.
      await search(page, 'immobili');
      const pages = group(page, 'Pagine').getByRole('option');
      await expect(pages).toHaveCount(2);
      await expect(pages.nth(0)).toContainText('Affitti brevi');
      await expect(pages.nth(1)).toContainText('Affitti lunghi');

      await search(page, 'lunghi');
      await expect(group(page, 'Azioni').getByRole('option').first()).toContainText('Cambia area: Affitti lunghi');
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(/\/app\/long-rent\/leases/);

      await page.keyboard.press('Control+K');
      await search(page, 'inglese');
      await expect(options(page).first()).toContainText("Passa all'inglese");
      await page.keyboard.press('Enter');
      await expect(palette(page)).toBeHidden();
      // The whole app, the palette included, is in English now.
      await page.keyboard.press('Control+K');
      const english = page.getByRole('dialog', { name: 'Search' });
      await expect(english).toBeVisible();
      await expect(english.getByRole('combobox')).toHaveAttribute('placeholder', 'Search properties, bookings, guests, pages…');
      await english.getByRole('combobox').fill('italian');
      await expect(english.getByRole('option').first()).toContainText('Switch to Italian');
    });
  });

  test.describe('Who may see what', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('a landlord of long rentals finds the leases and not the pages and actions of the short rentals', async ({ page }) => {
      await mockLeasesApiEmpty(page);
      await openPage(page, '/app/long-rent/leases', 'long-term');
      await openFromKeyboard(page);

      await search(page, 'contratti');
      await expect(group(page, 'Pagine').getByRole('option').first()).toContainText('Contratti');
      // One area only: the second line does not repeat its name.
      await expect(group(page, 'Pagine').getByRole('option').first()).not.toContainText('Affitti lunghi');
      await expect(group(page, 'Azioni').getByRole('option').first()).toContainText('Nuovo contratto');

      for (const outside of ['prenotazioni', 'incassi', 'calendario', 'ospiti', 'fornitori']) {
        await search(page, outside);
        await expect(palette(page).getByTestId('command-palette-empty'), `"${outside}" is not for this person`).toBeVisible();
      }
    });

    test('an owner of short rentals does not find the leases or the console of the platform', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      for (const outside of ['contratti', 'processi', 'locazione', 'inquilini']) {
        await search(page, outside);
        await expect(palette(page).getByTestId('command-palette-empty'), `"${outside}" is not for this person`).toBeVisible();
      }
      await search(page, 'incassi');
      await expect(options(page).first()).toContainText('Incassi');
    });

    test('the staff of the platform finds its console and nothing of the rentals', async ({ page }) => {
      await openPage(page, '/app/admin/suppliers/invite', 'admin');
      await openFromKeyboard(page);

      await search(page, 'utenti');
      await expect(options(page).first()).toContainText('Utenti');
      for (const outside of ['prenotazioni', 'contratti', 'incassi']) {
        await search(page, outside);
        await expect(palette(page).getByTestId('command-palette-empty'), `"${outside}" is not for this person`).toBeVisible();
      }
    });

    test('a supplier finds its requests and nothing of the hosts', async ({ page }) => {
      await mockSupplierConsoleApi(page, { active: true });
      await openPage(page, '/app/supplier/inbox', 'supplier');
      await openFromKeyboard(page);

      await search(page, 'richieste');
      await expect(options(page).first()).toContainText('Richieste');
      for (const outside of ['prenotazioni', 'immobili', 'contratti']) {
        await search(page, outside);
        await expect(palette(page).getByTestId('command-palette-empty'), `"${outside}" is not for this person`).toBeVisible();
      }
    });

    test('what is behind a feature flag that is off is not found: the channels of the OTA', async ({ page }) => {
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await search(page, 'airbnb');
      await expect(palette(page).getByTestId('command-palette-empty')).toBeVisible();
    });

    test('with the flag on the page of the channels and the action that connects one are found', async ({ page }) => {
      await page.route('**/api/public/features', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ otaPartnerApi: true }) }),
      );
      await openPage(page, '/app/short-rent', 'short-stay');
      await openFromKeyboard(page);

      await search(page, 'airbnb');
      await expect(group(page, 'Pagine').getByRole('option').first()).toContainText('OTA');
      await expect(group(page, 'Azioni').getByRole('option').first()).toContainText('Collega Airbnb o Booking.com');
    });
  });

  test.describe('A phone', () => {
    for (const width of [360, 390] as const) {
      test(`at ${width} px the search is an icon of the header, the palette a sheet from the bottom, and nothing sticks out`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await openPage(page, '/app/short-rent', 'short-stay');
        await page.addStyleTag({ content: WIDER_LETTERS });

        const icon = trigger(page);
        await expect(icon).toBeVisible();
        const iconBox = (await icon.boundingBox())!;
        expect(iconBox.width, 'a target a finger can hit').toBeGreaterThanOrEqual(44);
        expect(iconBox.height).toBeGreaterThanOrEqual(44);
        await expectInsideTheScreen(page, icon, `${width} px, the search`);
        await expect(icon).toHaveAccessibleName('Cerca immobili, prenotazioni, ospiti, pagine…');
        // The header still has the name of the area and the profile: the icon did not push them out of the screen.
        await expect(page.getByTestId('header-area')).toBeVisible();
        const area = (await page.getByTestId('header-area').boundingBox())!;
        expect(area.x + area.width, 'the name of the area ends before the search').toBeLessThanOrEqual(iconBox.x + 0.5);
        await expectNothingSticksOut(page, `${width} px, the header`, 'header');

        await icon.click();
        await expect(palette(page)).toBeVisible();
        await expect(box(page)).toBeFocused();
        await untilStill(page);
        const sheet = (await palette(page).boundingBox())!;
        expect(Math.round(sheet.x), 'as wide as the screen').toBe(0);
        expect(Math.round(sheet.width)).toBe(width);
        expect(Math.round(sheet.y + sheet.height), 'on the bottom edge').toBe(800);
        await expectNothingSticksOut(page, `${width} px, the palette`, '[data-testid="command-palette"]');

        await search(page, 'pren');
        await expect(options(page).first()).toBeVisible();
        for (const row of await options(page).all()) await expectInsideTheScreen(page, row, `${width} px, a result`);
        await expectNothingSticksOut(page, `${width} px, the palette with results`, '[data-testid="command-palette"]');
        await expect(palette(page).getByTestId('command-palette-body')).not.toContainText('Invio per aprire');

        // A tap chooses.
        await options(page).first().click();
        await expect(page).toHaveURL(/\/app\/short-rent\/bookings$/);
        await expect(palette(page)).toBeHidden();
      });
    }

    test('the close button of the sheet, 44 px, closes it and gives the focus back to the search', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openPage(page, '/app/short-rent', 'short-stay');
      await trigger(page).click();
      await expect(palette(page)).toBeVisible();
      await untilStill(page);

      const close = palette(page).getByRole('button', { name: 'Chiudi' });
      const closeBox = (await close.boundingBox())!;
      expect(closeBox.width).toBeGreaterThanOrEqual(44);
      await close.click();
      await expect(palette(page)).toBeHidden();
      await expect(trigger(page)).toBeFocused();
    });

    test('Ctrl+K does not open it over the sheet "Altro", which is a dialog already', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openPage(page, '/app/short-rent', 'short-stay');
      await page.locator('[data-more-trigger]').click();
      await expect(page.getByRole('dialog', { name: 'Altro' })).toBeVisible();

      await page.keyboard.press('Control+K');
      await expect(palette(page)).toBeHidden();
      await expect(page.getByRole('dialog', { name: 'Altro' })).toBeVisible();
    });
  });
});
