import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import {
  mockCurrentUserWithOrg,
  mockEntitlement,
} from './helpers/org-api-mock';
import { mockPricingApiDefaults } from './helpers/api-mock';
import { PROPERTY_ID, configEnabled } from './fixtures/pricing.fixtures';

const NEW_PROP = 'prop-biz-e2e-001';
const BOOKING_ID = 'book-biz-e2e-001';
const PAYMENT_ID = 'pay-biz-e2e-001';

test.describe('Business Golden Path', () => {
  test('host onboarding → plan selection → short-rent dashboard', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Scegli' })).toHaveCount(3);

    await page.getByRole('button', { name: 'Scegli' }).first().click();
    await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
    await page.getByTestId('onboarding-plan-confirm').click();

    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
  });

  test('property create → detail shows CIN + OTA + pricing sections', async ({ page }) => {
    await mockPropertiesApi(page);
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page);

    await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'));

    await page.getByRole('button', { name: /Add|Aggiungi/i }).click();
    await page.getByLabel(/Property Name|Nome proprietà/i).fill('Casa Business');
    await page.getByLabel(/Description|Descrizione/i).fill('Golden path test property.');
    await page.getByLabel(/Address|Indirizzo/i).fill('Via Garibaldi 42');
    await page.getByLabel(/City|Città/i).fill('Milano');
    await page.getByLabel(/Country|Nazione/i).fill('IT');
    await page.getByLabel(/ZIP|CAP/i).fill('20100');
    await page.getByLabel(/Bedrooms|Camere/i).fill('3');
    await page.getByLabel(/Bathrooms|Bagni/i).fill('2');
    await page.getByLabel(/Max Guests|Ospiti max/i).fill('6');
    await page.getByLabel(/Price per Night|Prezzo per notte/i).fill('150');

    const resp = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/properties'),
    );
    await page.getByRole('button', { name: /Create|Crea/i }).click();
    expect((await resp).status()).toBe(201);

    // Navigate to detail
    await expect(page.getByRole('link', { name: 'Casa Business' })).toBeVisible();
    await page.getByRole('link', { name: 'Casa Business' }).click();

    await expect(page.getByRole('heading', { name: 'Casa Business' })).toBeVisible();
    await expect(page.getByText(/CIN mancante|Missing CIN/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Dettagli|Details/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /OTA|Integrazioni/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Prezzi|Pricing/i })).toBeVisible();
  });

  test('pricing AI: enable toggle → save config → verify Active badge', async ({ page }) => {
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page);
    await mockPricingApiDefaults(page);

    await page.goto(demoUrl(`/app/short-rent/properties/${PROPERTY_ID}/pricing`, 'short-stay'));

    await expect(page.getByRole('heading', { name: /AI Dynamic Pricing|Prezzi Dinamici AI/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /enable|attiva/i })).toBeVisible();

    // Override config to disabled state first
    await page.route(`**/api/pricing-adapter/config/${PROPERTY_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...configEnabled, isEnabled: false }),
        });
        return;
      }
      if (method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(configEnabled),
        });
        return;
      }
      await route.fallback();
    });

    // Reload to get disabled state
    await page.reload();
    await expect(page.getByRole('switch', { name: /enable|attiva/i })).not.toBeChecked();

    await page.getByRole('switch', { name: /enable|attiva/i }).click();
    await expect(page.getByText(/saved|salvata/i)).toBeVisible();
    await expect(page.getByText('Active')).toBeVisible();
  });

  test('booking create with tourist tax → verify on detail page', async ({ page }) => {
    await mockCurrentUserWithOrg(page);

    await page.route('**/api/bookings', async (route) => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: BOOKING_ID,
          propertyId: PROPERTY_ID,
          status: 'Confirmed',
          checkInDate: '2026-08-01',
          checkOutDate: '2026-08-07',
          numberOfGuests: 4,
          basePrice: 900,
          touristTax: 30,
          totalPrice: 930,
          currency: 'EUR',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.route(`**/api/bookings/${BOOKING_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: BOOKING_ID,
          propertyId: PROPERTY_ID,
          status: 'Confirmed',
          checkInDate: '2026-08-01',
          checkOutDate: '2026-08-07',
          numberOfGuests: 4,
          basePrice: 900,
          touristTax: 30,
          totalPrice: 930,
          currency: 'EUR',
        }),
      });
    });

    await page.route('**/api/bookings?**', async (route) => {
      if (route.request().method() !== 'GET') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto(demoUrl('/app/short-rent/bookings/create', 'short-stay'));

    await page.getByLabel(/Property|Proprietà/i).selectOption({ index: 1 });
    await page.getByLabel(/Check-in/i).fill('2026-08-01');
    await page.getByLabel(/Check-out/i).fill('2026-08-07');
    await page.getByLabel(/Guests|Ospiti/i).fill('4');

    const resp = page.waitForResponse(
      (r) => r.request().method() === 'POST' && r.url().includes('/api/bookings'),
    );
    await page.getByRole('button', { name: /Create|Crea/i }).click();
    expect((await resp).status()).toBe(201);

    // Should redirect to booking detail
    await expect(page.getByText(/30[,.]00/)).toBeVisible({ timeout: 10_000 });
  });

  test('payment create → process → verify completed', async ({ page }) => {
    await mockCurrentUserWithOrg(page);

    let paymentStatus = 'Pending';

    await page.route('**/api/payments', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PAYMENT_ID,
            bookingId: BOOKING_ID,
            amount: 930,
            refundedAmount: 0,
            status: 'Pending',
            method: 'Stripe',
            createdAt: new Date().toISOString(),
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route(`**/api/payments/${PAYMENT_ID}/process`, async (route) => {
      if (route.request().method() === 'POST') {
        paymentStatus = 'Completed';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: PAYMENT_ID,
            bookingId: BOOKING_ID,
            amount: 930,
            refundedAmount: 0,
            status: 'Completed',
            stripePaymentIntentId: 'pi_e2e_001',
            processedAt: new Date().toISOString(),
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route(`**/api/payments/${PAYMENT_ID}`, async (route) => {
      if (route.request().method() !== 'GET') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: PAYMENT_ID,
          bookingId: BOOKING_ID,
          amount: 930,
          refundedAmount: 0,
          status: paymentStatus,
          method: 'Stripe',
        }),
      });
    });

    await page.goto(demoUrl('/app/short-rent/payments/create', 'short-stay'));

    await page.getByLabel(/Booking|Prenotazione/i).selectOption({ index: 1 });
    await page.getByLabel(/Amount|Importo/i).fill('930');
    await page.getByRole('button', { name: /Create|Crea/i }).click();

    // Process payment
    await page.getByRole('button', { name: /Process|Elabora/i }).click();
    await expect(page.getByText(/Completed|Completato/i)).toBeVisible({ timeout: 10_000 });
  });
});
