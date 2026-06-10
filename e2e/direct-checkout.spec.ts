import { test, expect } from '@playwright/test';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockOrgPropertyId,
} from './helpers/branded-booking-mock';
import { mockDirectCheckoutApi } from './helpers/direct-checkout-mock';

test.describe('Direct checkout (#226)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await mockDirectCheckoutApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
    });
  });

  test('AC10/AC13: guest step shows consent, price breakdown, and Italian labels', async ({ page }) => {
    await page.goto(
      `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}/checkout?checkIn=2026-07-01&checkOut=2026-07-04`,
    );

    await expect(page.getByTestId('direct-checkout-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('price-breakdown')).toBeVisible();
    await expect(page.getByTestId('gdpr-consent')).toBeVisible();
    await expect(page.getByText('Tassa di soggiorno')).toBeVisible();
    await expect(page.getByText('Acconsento al trattamento')).toBeVisible();
  });

  test('AC11/AC12: createDirectBooking without auth and demo payment confirmation', async ({ page }) => {
    let bookingAuthHeader: string | undefined;

    await page.route('**/api/public/bookings', async (route) => {
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
        }),
      });
    });

    await page.goto(
      `/book/${DEMO_ORG_SLUG}/property/${mockOrgPropertyId}/checkout?checkIn=2026-07-01&checkOut=2026-07-04`,
    );

    await expect(page.getByTestId('checkout-guest-step')).toBeVisible({ timeout: 15_000 });

    await page.locator('#firstName').fill('Mario');
    await page.locator('#lastName').fill('Rossi');
    await page.locator('#email').fill('mario.rossi@example.com');
    await page.locator('#phone').fill('+393331234567');
    await page.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Continua al pagamento' }).click();

    await expect(page.getByTestId('checkout-payment-step')).toBeVisible();
    expect(bookingAuthHeader).toBeUndefined();

    await page.getByRole('button', { name: 'Paga ora' }).click();
    await expect(page.getByTestId('checkout-confirmation')).toBeVisible();
    await expect(page.getByText('Prenotazione confermata')).toBeVisible();
  });
});
