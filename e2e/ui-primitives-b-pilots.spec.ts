import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { DEMO_BOOKING_ID, mockAlloggiatiApi, mockBookingDetailApi } from './helpers/alloggiati-mock';
import { demoUrl } from './helpers/demo-profile';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import {
  WIDER_LETTERS,
  expectInsideTheScreen,
  expectNoAxeViolations,
  expectNothingSticksOut,
  untilStill,
} from './helpers/ui-checks';

/**
 * UI-07: the pages that adopt the new primitives (a pilot each), with the API of the demo mode mocked. The primitives
 * themselves, one by one, are in `ui-primitives-b.spec.ts`.
 */

const PHONES = [360, 390] as const;

// ---------------------------------------------------------------------------------------------------------------------------
// DataView: the list of guests

interface GuestSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  city: string;
  country: string;
  createdAt: string;
}

const GUESTS: GuestSummary[] = [
  { id: 'g1', firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com', phoneNumber: '', city: 'Roma', country: 'IT', createdAt: '2026-09-20T10:00:00Z' },
  {
    id: 'g2',
    firstName: 'Anna Maria Giuseppina',
    lastName: 'Bianchi Montefeltro Della Rovere',
    email: 'anna.maria.giuseppina.bianchi.montefeltro.della.rovere@un-dominio-di-posta-molto-lungo.example.org',
    phoneNumber: '',
    city: 'Montefiascone',
    country: 'IT',
    createdAt: '2026-09-21T10:00:00Z',
  },
  { id: 'g3', firstName: 'Luigi', lastName: 'Verdi', email: 'luigi@example.com', phoneNumber: '', city: '', country: 'IT', createdAt: '2026-09-22T10:00:00Z' },
];

async function mockGuestsList(page: Page, guests: GuestSummary[] = GUESTS) {
  await page.route('**/api/guests**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/\/$/, '');
    // `**/api/guests**` also matches the Vite module `/src/api/guests.api.ts`: only the list of the API is answered.
    if (path !== '/api/guests' || route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: guests, totalCount: guests.length, page: 1, pageSize: 20 }),
    });
  });
}

async function openGuests(page: Page, width: number, height = 800) {
  await mockGuestsList(page);
  await page.setViewportSize({ width, height });
  await page.goto(demoUrl('/app/short-rent/guests', 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Ospiti' })).toBeVisible();
  await expect(page.getByTestId('guest-list')).toBeVisible();
}

test.describe('DataView in the list of guests (pilot)', () => {
  test('on a desktop the guests are a table with the name as header of the row', async ({ page }) => {
    await openGuests(page, 1280);

    const table = page.getByRole('table', { name: 'Ospiti' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('rowheader')).toHaveText(['Mario Rossi', 'Anna Maria Giuseppina Bianchi Montefeltro Della Rovere', 'Luigi Verdi']);
    await expect(table.getByRole('link', { name: 'Dettagli' }).first()).toHaveAttribute('href', '/app/short-rent/guests/g1');
    await expect(page.getByRole('list', { name: 'Ospiti' })).toBeHidden();
    await expectNothingSticksOut(page, '1280 px, guests', 'main');
  });

  for (const width of PHONES) {
    test(`at ${width} px the guests are cards, each the link to the guest, and the page does not scroll sideways, even with wider letters`, async ({ page }) => {
      await openGuests(page, width);
      await page.addStyleTag({ content: WIDER_LETTERS });

      await expect(page.getByRole('table', { name: 'Ospiti' })).toBeHidden();
      const cards = page.getByRole('list', { name: 'Ospiti' });
      await expect(cards).toBeVisible();
      await expect(cards.getByRole('listitem')).toHaveCount(3);
      await expectInsideTheScreen(page, cards, `${width} px, the cards`);
      // The email that has no place to break is broken, not pushed out.
      await expectNothingSticksOut(page, `${width} px, guests with wider letters`);

      await cards.getByRole('link', { name: /Mario Rossi/ }).click();
      await expect(page).toHaveURL(/\/app\/short-rent\/guests\/g1$/);
    });
  }

  test('on a tablet and a small laptop (768 px, 1024 px) the guests are still cards: with the sidebar the table needs 1280 px', async ({ page }) => {
    await openGuests(page, 768, 900);
    await expect(page.getByRole('list', { name: 'Ospiti' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Ospiti' })).toBeHidden();
    await expectNothingSticksOut(page, '768 px, guests', 'main');

    await page.setViewportSize({ width: 1024, height: 800 });
    await expect(page.getByRole('list', { name: 'Ospiti' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Ospiti' })).toBeHidden();
    await expectNothingSticksOut(page, '1024 px, guests', 'main');

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole('table', { name: 'Ospiti' })).toBeVisible();
  });

  test('the list has no accessibility violation, on a desktop and on a phone', async ({ page }) => {
    await openGuests(page, 1280);
    await expectNoAxeViolations(page, { include: '[data-testid="guest-list"]' });

    await page.setViewportSize({ width: 390, height: 800 });
    await expectNoAxeViolations(page, { include: '[data-testid="guest-list"]' });
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Segmented (the status filter) and toastUndo (pausing a property): the list of properties

function propertiesWithPause(initial: Array<{ id: string; name: string; paused: boolean }>) {
  const state = new Map(initial.map((entry) => [entry.id, entry.paused]));
  return {
    state,
    list: () =>
      initial.map((entry) =>
        buildCreatedProperty({ id: entry.id, name: entry.name, city: 'Roma', ...({ isPaused: state.get(entry.id) ?? false } as object) }),
      ),
  };
}

async function openProperties(page: Page, width = 1280) {
  const store = propertiesWithPause([
    { id: 'prop-a', name: 'Casa Alfa', paused: false },
    { id: 'prop-b', name: 'Casa Beta', paused: false },
    { id: 'prop-c', name: 'Casa Gamma', paused: true },
  ]);
  const calls: string[] = [];
  await mockPropertiesApi(page, []);
  // Later routes are tried first: the list, and the pause and the activation, with a state that follows them.
  await page.route('**/api/properties', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store.list()) });
  });
  await page.route(/\/api\/properties\/([^/]+)\/(pause|activate)$/, async (route) => {
    const [, id, action] = route.request().url().match(/\/api\/properties\/([^/]+)\/(pause|activate)$/)!;
    calls.push(`${action}:${id}`);
    store.state.set(id, action === 'pause');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isPaused: action === 'pause', pausedAt: action === 'pause' ? '2026-10-09T08:00:00Z' : null }),
    });
  });
  await page.setViewportSize({ width, height: 800 });
  await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Immobili' })).toBeVisible();
  await expect(page.getByTestId('property-filter-all')).toBeVisible();
  return { calls };
}

test.describe('Segmented in the status filter of the properties (pilot)', () => {
  test('the filter is one control: the pressed button says so, and a click shows only that status', async ({ page }) => {
    await openProperties(page);
    const filter = page.getByRole('group', { name: 'Filtra per stato' });
    const rows = page.getByRole('row');

    await expect(filter.getByRole('button')).toHaveText(['Tutti (3)', 'Attivi (2)', 'In pausa (1)']);
    await expect(page.getByTestId('property-filter-all')).toHaveAttribute('aria-pressed', 'true');
    await expect(rows).toHaveCount(4);

    await page.getByTestId('property-filter-paused').click();
    await expect(page.getByTestId('property-filter-paused')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('property-filter-all')).toHaveAttribute('aria-pressed', 'false');
    await expect(rows).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Casa Gamma', exact: true })).toBeVisible();

    await page.getByTestId('property-filter-active').click();
    await expect(page.getByRole('link', { name: 'Casa Alfa', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Casa Gamma', exact: true })).toHaveCount(0);
  });

  test('on a phone the filter fits the screen and each button is a finger wide', async ({ page }) => {
    await openProperties(page, 390);
    await page.addStyleTag({ content: WIDER_LETTERS });

    const filter = page.getByRole('group', { name: 'Filtra per stato' });
    await expectInsideTheScreen(page, filter, 'the filter');
    for (const button of await filter.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(36);
    }
  });

  test('the filter has no accessibility violation', async ({ page }) => {
    await openProperties(page);

    await expectNoAxeViolations(page, { include: '[role="group"][aria-label="Filtra per stato"]' });
  });
});

test.describe('toastUndo when a property is paused (pilot)', () => {
  const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]', { hasText: text });
  const rowOf = (page: Page, name: string) => page.getByRole('row', { name: new RegExp(name) });

  test('pausing offers Annulla, and Annulla reactivates the property on the server', async ({ page }) => {
    const { calls } = await openProperties(page);
    await expect(rowOf(page, 'Casa Alfa')).toContainText('Attivo');

    await rowOf(page, 'Casa Alfa').getByRole('button', { name: 'Pausa' }).click();

    const paused = toast(page, 'Immobile messo in pausa');
    await expect(paused).toBeVisible();
    await expect(rowOf(page, 'Casa Alfa')).toContainText('In pausa');
    expect(calls).toEqual(['pause:prop-a']);

    await paused.getByRole('button', { name: 'Annulla' }).click();

    await expect(toast(page, 'Immobile riattivato')).toBeVisible();
    await expect(rowOf(page, 'Casa Alfa')).toContainText('Attivo');
    expect(calls).toEqual(['pause:prop-a', 'activate:prop-a']);
  });

  test('the toast is there for about six seconds and then the pause stays', async ({ page }) => {
    const { calls } = await openProperties(page);

    await rowOf(page, 'Casa Beta').getByRole('button', { name: 'Pausa' }).click();
    const paused = toast(page, 'Immobile messo in pausa');
    await expect(paused).toBeVisible();

    await expect(paused).toHaveCount(0, { timeout: 10_000 });
    await expect(rowOf(page, 'Casa Beta')).toContainText('In pausa');
    expect(calls).toEqual(['pause:prop-b']);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Tabs: the booking detail

async function openBooking(page: Page, width: number, search = '') {
  await mockAlloggiatiApi(page);
  await mockBookingDetailApi(page);
  await page.setViewportSize({ width, height: 800 });
  await page.goto(demoUrl(`/app/short-rent/bookings/${DEMO_BOOKING_ID}${search}`, 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Prenotazione', { timeout: 15_000 });
}

test.describe('Tabs in the booking detail (pilot)', () => {
  test('the tabs are links with the tab in the address, and the test ids of the Golden Journey are on them', async ({ page }) => {
    await openBooking(page, 1280);
    const tabs = page.getByRole('tablist', { name: 'Sezioni della prenotazione' });

    await expect(tabs.getByRole('tab')).toHaveText(['Dettagli', 'Ospite', 'Pagamento', 'Alloggiati']);
    await expect(page.getByTestId('booking-tab-details')).toHaveAttribute('aria-selected', 'true');
    // The other parameters of the address (here the profile of the demo) are kept, in their order.
    await expect(page.getByTestId('booking-tab-guest')).toHaveAttribute('href', `/app/short-rent/bookings/${DEMO_BOOKING_ID}?demoProfile=short-stay&tab=guest`);
    await expect(page.getByTestId('booking-tab-details')).toHaveAttribute('href', `/app/short-rent/bookings/${DEMO_BOOKING_ID}?demoProfile=short-stay`);

    await page.getByTestId('booking-tab-guest').click();
    await expect(page).toHaveURL(/tab=guest/);
    await expect(page.getByTestId('booking-tab-guest')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Ospite');
    await expect(page.getByText('mario.rossi@example.com').first()).toBeVisible();
  });

  test('a link to ?tab=alloggiati opens that tab, as the links of the arrival and the cockpit do', async ({ page }) => {
    await openBooking(page, 1280, '?tab=alloggiati');

    await expect(page.getByTestId('booking-tab-alloggiati')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('booking-alloggiati-section')).toBeVisible({ timeout: 15_000 });
  });

  test('the keyboard moves along the tabs and Enter opens one', async ({ page }) => {
    await openBooking(page, 1280);

    await page.getByTestId('booking-tab-details').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('booking-tab-payment')).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/tab=payment/);
    await expect(page.getByTestId('booking-tab-payment')).toHaveAttribute('aria-selected', 'true');
  });

  for (const width of PHONES) {
    test(`at ${width} px the tabs are a menu and choosing one opens its tab`, async ({ page }) => {
      await openBooking(page, width);
      await page.addStyleTag({ content: WIDER_LETTERS });

      await expect(page.getByRole('tablist')).toHaveCount(0);
      const menu = page.getByTestId('booking-tabs-select');
      await expectInsideTheScreen(page, menu, `${width} px, the menu of the tabs`);

      await menu.selectOption('alloggiati');
      await expect(page).toHaveURL(/tab=alloggiati/);
      await expect(page.getByTestId('booking-alloggiati-section')).toBeVisible({ timeout: 15_000 });
      await expectNothingSticksOut(page, `${width} px, booking detail`, 'main');
    });
  }

  test('the tabs have no accessibility violation', async ({ page }) => {
    await openBooking(page, 1280);

    await expectNoAxeViolations(page, { include: '[role="tablist"]' });
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// HelpTip: the iCal dialog of the supplier

async function openSupplierCalendar(page: Page, width: number) {
  await mockSupplierConsoleApi(page, { active: true });
  await page.setViewportSize({ width, height: 844 });
  await page.goto(demoUrl('/app/supplier/calendar', 'supplier'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Sincronizzazione Calendario' })).toBeVisible();
  await page.getByRole('button', { name: 'Incolla link iCal' }).click();
  const dialog = page.getByRole('dialog', { name: 'Collega feed iCal' });
  await expect(dialog).toBeVisible();
  await untilStill(page);
  return dialog;
}

test.describe('HelpTip in the iCal dialog of the supplier (pilot)', () => {
  test('on a desktop the "?" next to the label opens a bubble over the dialog with the link to the help of the console', async ({ page }) => {
    const dialog = await openSupplierCalendar(page, 1280);

    await dialog.getByRole('button', { name: 'Aiuto iCal' }).click();

    const bubble = page.getByRole('dialog', { name: 'Aiuto iCal' });
    await expect(bubble).toBeVisible();
    await expect(bubble).toContainText('Non sai dove trovare il link iCal?');
    await expectInsideTheScreen(page, bubble, 'the bubble');
    await expect(bubble.getByRole('link', { name: 'Scopri come fare' })).toHaveAttribute('href', '/app/supplier/help/ical');

    await page.keyboard.press('Escape');
    await expect(bubble).toBeHidden();
    await expect(dialog).toBeVisible();
  });

  test('the link of the tip goes to the help page of the supplier console', async ({ page }) => {
    const dialog = await openSupplierCalendar(page, 1280);
    await dialog.getByRole('button', { name: 'Aiuto iCal' }).click();

    await page.getByRole('dialog', { name: 'Aiuto iCal' }).getByRole('link', { name: 'Scopri come fare' }).click();

    await expect(page).toHaveURL(/\/app\/supplier\/help\/ical/);
  });

  for (const width of PHONES) {
    test(`at ${width} px the dialog is a sheet and the tip a second sheet over it, nothing sticks out`, async ({ page }) => {
      const height = 844;
      const dialog = await openSupplierCalendar(page, width);
      const sheet = await dialog.boundingBox();
      expect(sheet!.y + sheet!.height, 'the dialog rests on the bottom edge').toBeCloseTo(height, 0);

      await dialog.getByRole('button', { name: 'Aiuto iCal' }).click();
      const tip = page.getByRole('dialog', { name: 'Aiuto iCal' });
      await expect(tip).toBeVisible();
      await untilStill(page);
      const tipBox = await tip.boundingBox();
      expect(tipBox!.y + tipBox!.height, 'the tip rests on the bottom edge').toBeCloseTo(height, 0);
      await page.addStyleTag({ content: WIDER_LETTERS });
      await expectNothingSticksOut(page, `${width} px, tip over dialog`);

      await tip.getByRole('button', { name: 'Chiudi' }).click();
      await expect(tip).toBeHidden();
      await expect(dialog).toBeVisible();
    });
  }

  test('the dialog and the tip, open together, have no accessibility violation', async ({ page }) => {
    const dialog = await openSupplierCalendar(page, 1280);
    await dialog.getByRole('button', { name: 'Aiuto iCal' }).click();
    await expect(page.getByRole('dialog', { name: 'Aiuto iCal' })).toBeVisible();
    await untilStill(page);

    await expectNoAxeViolations(page, { include: '[role="dialog"]' });
  });
});

// ---------------------------------------------------------------------------------------------------------------------------
// Dialog: the existing dialogs

test.describe('the dialogs that already existed', () => {
  test('the form to add a property is a sheet on a phone, scrolls inside, and the page does not scroll sideways', async ({ page }) => {
    await mockPropertiesApi(page, []);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^(Aggiungi immobile|Aggiungi il primo immobile)$/ }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo immobile' });
    await expect(dialog).toBeVisible();
    await untilStill(page);

    const box = (await dialog.boundingBox())!;
    expect(box.x).toBeCloseTo(0, 0);
    expect(box.width).toBeCloseTo(390, 0);
    expect(box.y + box.height).toBeCloseTo(844, 0);
    expect(await dialog.evaluate((element) => element.scrollHeight > element.clientHeight), 'the long form scrolls inside the sheet').toBe(true);
    await page.addStyleTag({ content: WIDER_LETTERS });
    await expectNothingSticksOut(page, '390 px, add a property');

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('on a tablet and a desktop it is in the middle as it always was', async ({ page }) => {
    await mockPropertiesApi(page, []);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /^(Aggiungi immobile|Aggiungi il primo immobile)$/ }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Nuovo immobile' });
    await expect(dialog).toBeVisible();
    await untilStill(page);

    const box = (await dialog.boundingBox())!;
    expect(box.x + box.width / 2).toBeCloseTo(640, 0);
    expect(box.y + box.height / 2).toBeCloseTo(400, 0);
    expect(box.width).toBeGreaterThan(700);
  });
});
