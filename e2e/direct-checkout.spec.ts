import type { Page } from '@playwright/test';
import { test, expect } from './test';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgPropertyId,
} from './helpers/branded-booking-mock';
import { futureStay, mockDirectCheckoutApi } from './helpers/direct-checkout-mock';

const { checkIn, checkOut } = futureStay(30, 3);
const checkoutUrl = `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}/checkout?checkin=${checkIn}&checkout=${checkOut}&guests=2`;

/** Step 1 done: the stay is the one of the address, booked at once; the guest goes on to their details. */
async function passTheStay(page: Page): Promise<void> {
  await expect(page.getByTestId('checkout-step-stay')).toBeVisible({ timeout: 15_000 });
  // The button waits for the quote of this stay (the total of the server) and then leads to the second step.
  await expect(page.getByTestId('checkout-next')).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15_000 });
  await page.getByTestId('checkout-next').click();
  await expect(page.getByTestId('checkout-step-details')).toBeVisible();
}

/** Step 2 done: the guest who books, then the payment step. */
async function passTheDetails(page: Page): Promise<void> {
  await page.locator('#firstName').fill('Mario');
  await page.locator('#lastName').fill('Rossi');
  await page.locator('#email').fill('mario.rossi@example.com');
  await page.locator('#phone').fill('+393331234567');
  await page.locator('#country').selectOption('DE');
  await page.getByTestId('checkout-next').click();
  await expect(page.getByTestId('checkout-step-payment')).toBeVisible();
}

test.describe('Direct checkout (#226, DB-05)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await mockDirectCheckoutApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('AC10/AC13: the first step shows the summary with the total of the quote, in Italian', async ({ page }) => {
    await page.goto(checkoutUrl);

    await expect(page.getByTestId('direct-checkout-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-title')).toHaveText('Il tuo soggiorno');
    const summary = page.getByTestId('checkout-summary');
    await expect(summary.getByTestId('price-breakdown')).toBeVisible();
    // A calculated tax is a line of the quote and part of the total (BK-03); the total is the one of the server.
    await expect(summary.getByTestId('tourist-tax-line')).toContainText('Imposta di soggiorno');
    await expect(summary.getByTestId('price-breakdown-total')).toContainText('546');
    await expect(page.getByTestId('checkout-stay-summary')).toContainText('3 notti');
  });

  test('AC11/AC12: three steps, a booking without auth, the payment step and the confirmation', async ({ page }) => {
    let bookingAuthHeader: string | undefined;

    await page.route('**/api/public/bookings', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      bookingAuthHeader = route.request().headers()['authorization'];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          bookingId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          clientSecret: 'pi_test_secret_direct',
          connectedAccountPublishableContext: {
            publishableKey: 'pk_test_demo',
            stripeAccountId: 'acct_test_demo',
          },
          amount: 557,
          currency: 'EUR',
          touristTaxAmount: 6,
          basePrice: 551,
          paymentOption: 'Immediate',
          freeRefundDeadline: '2026-06-24T00:00:00Z',
          checkoutToken: 'tok_e2e_checkout',
        }),
      });
    });

    await page.goto(checkoutUrl);
    await passTheStay(page);
    await passTheDetails(page);

    // The personal data never reach the address; the step does.
    expect(page.url()).toContain('step=3');
    expect(page.url()).not.toContain('mario');

    await page.locator('#data-consent').click();
    await page.getByTestId('checkout-submit').click();

    // Only now the booking exists: the hold of the dates is promised and the payment is asked.
    await expect(page.getByTestId('checkout-payment-step')).toBeVisible();
    await expect(page.getByTestId('checkout-payment')).toContainText('30 minuti');
    expect(bookingAuthHeader).toBeUndefined();

    await page.getByRole('button', { name: 'Paga ora' }).click();
    // BK-07: the outcome page of the booking, confirmed only because the (mocked) backend says so.
    await expect(page).toHaveURL(/\/booking\/cccccccc-cccc-cccc-cccc-cccccccccccc\?token=tok_e2e_checkout$/);
    await expect(page.getByTestId('checkout-confirmation')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prenotazione confermata/i })).toBeVisible();
  });

  test('A3-34: past dates are reported, a wrong email is explained and blocks the next step', async ({ page }) => {
    const past = futureStay(-3, 2);
    await page.goto(
      `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}/checkout?checkin=${past.checkIn}&checkout=${past.checkOut}&guests=2`,
    );

    await expect(page.getByTestId('checkout-step-stay')).toBeVisible({ timeout: 15_000 });
    // No stay to price: the button waits and says why.
    await expect(page.getByTestId('checkout-next')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText('Scegli le date del soggiorno.')).toBeVisible();

    await page.goto(`${checkoutUrl}&step=2`);
    await expect(page.getByTestId('checkout-step-details')).toBeVisible({ timeout: 15_000 });
    await page.locator('#firstName').fill('Mario');
    await page.locator('#lastName').fill('Rossi');
    await page.locator('#email').fill('mario.rossi@');
    await page.locator('#email').blur();
    await expect(page.getByText('Inserisci un indirizzo email valido')).toBeVisible();
    await page.getByTestId('checkout-next').click();
    await expect(page.getByTestId('checkout-step-details')).toBeVisible();

    // A typo of a popular domain is met with a suggestion that one tap applies.
    await page.locator('#email').fill('mario.rossi@gmial.com');
    await expect(page.getByTestId('checkout-email-suggestion')).toContainText('mario.rossi@gmail.com');
    await page.getByTestId('checkout-email-suggestion').getByRole('button').click();
    await expect(page.locator('#email')).toHaveValue('mario.rossi@gmail.com');
  });

  test('A3-34/A3-15: unavailable dates show the message of their code instead of the generic error', async ({ page }) => {
    await page.route('**/api/public/bookings', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'booking_dates_unavailable', detail: 'Dates not available' }),
      });
    });

    await page.goto(checkoutUrl);
    await passTheStay(page);
    await passTheDetails(page);
    await page.locator('#data-consent').click();
    await page.getByTestId('checkout-submit').click();

    await expect(page.getByTestId('checkout-error')).toHaveText(
      "Le date scelte non sono disponibili: si sovrappongono a un'altra prenotazione o a un blocco del calendario.",
    );
  });
});
