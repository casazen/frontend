import { test, expect } from './test';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgPropertyId,
} from './helpers/branded-booking-mock';
import { futureStay, mockDirectCheckoutApi } from './helpers/direct-checkout-mock';

const { checkIn, checkOut } = futureStay(30, 3);
const checkoutUrl = `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}/checkout?checkin=${checkIn}&checkout=${checkOut}&guests=2`;

test.describe('Direct checkout (#226)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await mockDirectCheckoutApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('AC10/AC13: guest step shows consent, price breakdown, and Italian labels', async ({ page }) => {
    await page.goto(checkoutUrl);

    await expect(page.getByTestId('direct-checkout-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('price-breakdown')).toBeVisible();
    await expect(page.getByTestId('gdpr-consent')).toBeVisible();
    await expect(page.getByTestId('price-breakdown').getByText('Tassa di soggiorno', { exact: true })).toBeVisible();
    await expect(page.getByText('Acconsento al trattamento')).toBeVisible();
  });

  test('AC11/AC12: createDirectBooking without auth and demo payment confirmation', async ({ page }) => {
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
        }),
      });
    });

    await page.goto(checkoutUrl);

    await expect(page.getByTestId('checkout-guest-step')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Paga subito' }).click();
    await page.locator('#firstName').fill('Mario');
    await page.locator('#lastName').fill('Rossi');
    await page.locator('#email').fill('mario.rossi@example.com');
    await page.locator('#phone').fill('+393331234567');
    await page.locator('#country').selectOption('DE');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Continua' }).click();

    await expect(page.getByTestId('checkout-payment-step')).toBeVisible();
    expect(bookingAuthHeader).toBeUndefined();

    await page.getByRole('button', { name: 'Paga ora' }).click();
    await expect(page.getByTestId('checkout-confirmation')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prenotazione confermata/i })).toBeVisible();
  });

  test('A3-34: invalid email and past dates are reported and block Continue', async ({ page }) => {
    const past = futureStay(-3, 2);
    await page.goto(
      `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}/checkout?checkin=${past.checkIn}&checkout=${past.checkOut}&guests=2`,
    );

    await expect(page.getByTestId('checkout-guest-step')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('La data di check-in non può essere nel passato')).toBeVisible();

    await page.getByRole('button', { name: 'Paga subito' }).click();
    await page.locator('#firstName').fill('Mario');
    await page.locator('#lastName').fill('Rossi');
    await page.locator('#email').fill('mario.rossi@');
    await page.locator('#email').blur();
    await expect(page.getByText('Inserisci un indirizzo email valido')).toBeVisible();
    await page.locator('#country').selectOption('IT');
    await page.getByRole('checkbox').click();
    await expect(page.getByRole('button', { name: 'Continua' })).toBeDisabled();

    await page.locator('#email').fill('mario.rossi@example.com');
    await page.locator('#checkout-check-in').fill(checkIn);
    await page.locator('#checkout-check-out').fill(checkOut);
    await expect(page.getByRole('button', { name: 'Continua' })).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`checkin=${checkIn}&checkout=${checkOut}`));
  });

  test('A3-34: unavailable dates show the server message instead of the generic error', async ({ page }) => {
    await page.route('**/api/public/bookings', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Property not available for selected dates' }),
      });
    });

    await page.goto(checkoutUrl);
    await expect(page.getByTestId('checkout-guest-step')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Paga subito' }).click();
    await page.locator('#firstName').fill('Mario');
    await page.locator('#lastName').fill('Rossi');
    await page.locator('#email').fill('mario.rossi@example.com');
    await page.locator('#country').selectOption('IT');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Continua' }).click();

    await expect(page.getByTestId('checkout-error')).toHaveText('Property not available for selected dates');
  });
});
