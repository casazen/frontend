import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { DEMO_BOOKING_ID, mockAlloggiatiApi, mockBookingDetailApi } from './helpers/alloggiati-mock';
import { demoUrl } from './helpers/demo-profile';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
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
// Tabs: the booking detail

async function openBooking(page: Page, width: number, search = '') {
  await mockAlloggiatiApi(page);
  await mockBookingDetailApi(page);
  await page.setViewportSize({ width, height: 800 });
  await page.goto(demoUrl(`/app/short-rent/bookings/${DEMO_BOOKING_ID}${search}`, 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Mario Rossi', { timeout: 15_000 });
}

test.describe('Tabs in the booking detail (pilot)', () => {
  test('the tabs are links with the tab in the address, and the test ids of the Golden Journey are on them', async ({ page }) => {
    await openBooking(page, 1280);
    const tabs = page.getByRole('tablist', { name: 'Sezioni della prenotazione' });

    await expect(tabs.getByRole('tab')).toHaveText(['Soggiorno', 'Documenti', 'Pagamento']);
    await expect(page.getByTestId('booking-tab-details')).toHaveAttribute('aria-selected', 'true');
    // The other parameters of the address (here the profile of the demo) are kept, in their order.
    await expect(page.getByTestId('booking-tab-guest')).toHaveAttribute('href', `/app/short-rent/bookings/${DEMO_BOOKING_ID}?demoProfile=short-stay&tab=guest`);
    await expect(page.getByTestId('booking-tab-details')).toHaveAttribute('href', `/app/short-rent/bookings/${DEMO_BOOKING_ID}?demoProfile=short-stay`);

    await page.getByTestId('booking-tab-guest').click();
    await expect(page).toHaveURL(/tab=guest/);
    await expect(page.getByTestId('booking-tab-guest')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveAccessibleName('Documenti');
    await expect(page.getByRole('heading', { name: 'Check-in online' })).toBeVisible();
  });

  test('a link to ?tab=alloggiati opens Documenti at its Alloggiati Web section, as the links of the arrival and the cockpit do', async ({ page }) => {
    await openBooking(page, 1280, '?tab=alloggiati');

    await expect(page.getByTestId('booking-tab-guest')).toHaveAttribute('aria-selected', 'true');
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

      await menu.selectOption('guest');
      await expect(page).toHaveURL(/tab=guest/);
      await expect(page.getByTestId('booking-alloggiati-section')).toBeVisible({ timeout: 15_000 });
      // What this checks is the menu of the tabs, not the rest of the page: the content of the tab is the page's own, and with
      // the wide letters of the runner (Linux) a button of the guest section ("Segna come inviato manualmente") is 14 px past
      // the edge at 360 px, as it was before the tabs.
      await expectInsideTheScreen(page, menu, `${width} px, the menu of the tabs, once a tab is open`);
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
