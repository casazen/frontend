import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

/**
 * UI-02: the form of "new payment" is the pilot page of the UI primitives (Field, Select, Alert, Button loading and
 * the loading / error / empty states of the list of bookings). L2 (demo mode, mocked API).
 */

const BOOKING_ID = 'b1000000-1111-2222-3333-444444444444';
const OTA_BOOKING_ID = 'b2000000-1111-2222-3333-444444444444';
const CREATE_URL = demoUrl('/app/short-rent/payments/create', 'short-stay');

const bookings = [
  {
    id: BOOKING_ID,
    propertyId: 'prop-1',
    status: 'Confirmed',
    checkInDate: '2026-08-01',
    checkOutDate: '2026-08-07',
    numberOfGuests: 2,
    totalPrice: 930,
    currency: 'EUR',
    source: 'Direct',
    guest: { firstName: 'Giulia', lastName: 'Bianchi', email: 'giulia@example.com' },
  },
  {
    id: OTA_BOOKING_ID,
    propertyId: 'prop-1',
    status: 'Confirmed',
    checkInDate: '2026-09-01',
    checkOutDate: '2026-09-04',
    numberOfGuests: 2,
    totalPrice: 450,
    currency: 'EUR',
    source: 'Airbnb',
    guest: { firstName: 'Marco', lastName: 'Rossi', email: 'marco@example.com' },
  },
];

async function mockBookings(page: Page, body: unknown, status = 200): Promise<void> {
  await page.route(/\/api\/bookings(\/|\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test.describe('Pilot of the UI primitives: new payment (UI-02)', () => {
  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
  });

  test('AC-U1: the fields have a label, and the old ids the other specs use are kept', async ({ page }) => {
    await mockBookings(page, bookings);
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });

    const booking = page.getByLabel('Prenotazione *');
    await expect(booking).toBeVisible({ timeout: 15_000 });
    await expect(booking).toHaveAttribute('id', 'bookingId');
    await expect(page.getByLabel('Importo *')).toHaveAttribute('id', 'amount');
    await expect(page.getByLabel('Metodo di pagamento *')).toHaveAttribute('id', 'method');
    await expect(page.getByLabel('Valuta')).toHaveValue('EUR');
    await expect(booking.locator('option')).toHaveText(['Seleziona una prenotazione', 'Giulia Bianchi - b1000000', 'Marco Rossi - b2000000']);
  });

  test('AC-U2: an empty form says what is missing next to each field and puts the focus on the first one', async ({ page }) => {
    await mockBookings(page, bookings);
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Crea pagamento' }).click();

    const booking = page.getByLabel('Prenotazione *');
    await expect(booking).toHaveAttribute('aria-invalid', 'true');
    await expect(booking).toBeFocused();
    await expect(page.getByLabel('Importo *')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Metodo di pagamento *')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Valuta')).not.toHaveAttribute('aria-invalid', 'true');
    // Each message is tied to its field and drawn with an icon (not only red text).
    await expect(booking).toHaveAccessibleDescription("La prenotazione e' obbligatoria");
    const alert = page.getByRole('alert').filter({ hasText: "La prenotazione e' obbligatoria" });
    await expect(alert).toBeVisible();
    await expect(alert.locator('svg')).toHaveCount(1);
  });

  test('AC-U3: the withholding hint of an OTA booking is an info notice that appears and goes away', async ({ page }) => {
    await mockBookings(page, bookings);
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });

    const hint = page.getByTestId('fiscal-ota-withholding-hint');
    await expect(hint).toHaveCount(0);
    await page.locator('#bookingId').selectOption(OTA_BOOKING_ID);
    await expect(hint).toBeVisible();
    await expect(hint).toHaveAttribute('role', 'status');
    await page.locator('#bookingId').selectOption(BOOKING_ID);
    await expect(hint).toHaveCount(0);
  });

  test('AC-U4: while the payment is being saved the button is busy and a second click sends nothing', async ({ page }) => {
    await mockBookings(page, bookings);
    let posts = 0;
    let postedBody: Record<string, unknown> | null = null;
    await page.route('**/api/payments', async (route) => {
      if (route.request().method() === 'POST') {
        posts += 1;
        postedBody = route.request().postDataJSON() as Record<string, unknown>;
        // Long enough for the busy button to be seen and pressed again, even on a slow runner.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'pay-1', bookingId: BOOKING_ID, amount: 120.5, currency: 'EUR', status: 'Pending', method: 'BankTransfer', createdAt: '2026-07-01T10:00:00Z' }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });

    await page.locator('#bookingId').selectOption(BOOKING_ID);
    await page.locator('#amount').fill('120.5');
    await page.locator('#method').selectOption('BankTransfer');
    const submit = page.getByRole('button', { name: 'Crea pagamento' });
    await submit.click();

    const busy = page.getByRole('button', { name: 'Creazione...' });
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await busy.click({ force: true });
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/app\/short-rent\/payments(\?|$)/, { timeout: 10_000 });
    expect(posts).toBe(1);
    expect(postedBody).toMatchObject({ bookingId: BOOKING_ID, amount: 120.5, method: 'BankTransfer' });
  });

  test('AC-U5: with no bookings the page explains why and points to creating one', async ({ page }) => {
    await mockBookings(page, []);
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Non ci sono prenotazioni' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Prenotazione *')).toHaveCount(0);
    await page.getByRole('link', { name: 'Nuova prenotazione' }).click();
    await expect(page).toHaveURL(/\/app\/short-rent\/bookings\/create/);
  });

  test('AC-U6: when the bookings cannot be loaded the page says so and retries on request', async ({ page }) => {
    let failing = true;
    await page.route(/\/api\/bookings(\/|\?|$)/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      if (failing) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ title: 'Server error' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(bookings) });
    });
    await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });

    const error = page.getByTestId('error-state');
    await expect(error).toBeVisible({ timeout: 20_000 });
    await expect(error).toContainText('Impossibile caricare le prenotazioni');
    await expect(page.getByLabel('Prenotazione *')).toHaveCount(0);

    failing = false;
    await error.getByRole('button', { name: 'Riprova' }).click();
    await expect(page.getByLabel('Prenotazione *')).toBeVisible({ timeout: 15_000 });
    await expect(error).toHaveCount(0);
  });

  for (const width of [360, 390]) {
    test(`AC-U7: the form with its errors fits a ${width}px phone`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mockBookings(page, bookings);
      await page.goto(CREATE_URL, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Crea pagamento' }).click();
      await expect(page.getByLabel('Importo *')).toHaveAttribute('aria-invalid', 'true');

      // Not the whole page (its header is not ours): the form, its fields and its messages stay inside the screen.
      const sticksOut = await page.evaluate(() => {
        const form = document.querySelector('form');
        if (!form) return ['no form'];
        const limit = document.documentElement.clientWidth;
        const offenders: string[] = [];
        for (const element of [form, ...Array.from(form.querySelectorAll('input, select, textarea, [role="alert"], label, button'))]) {
          const box = element.getBoundingClientRect();
          if (box.right > limit + 0.5) offenders.push(`${element.tagName} ends at ${Math.round(box.right)} > ${limit}`);
        }
        if (form.scrollWidth > form.clientWidth + 1) offenders.push(`form scrolls: ${form.scrollWidth} > ${form.clientWidth}`);
        return offenders;
      });
      expect(sticksOut).toEqual([]);
    });
  }
});
