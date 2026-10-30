import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';
import { completeOnboardingFromRentalChoice, fillHostBookingGuestContact } from './helpers/onboarding';
import { createPropertyWithWizard, mockPropertiesApi } from './helpers/properties-api-mock';
import {
  mockCurrentUserWithOrg,
  mockEntitlement,
} from './helpers/org-api-mock';
import { mockPricingApiDefaults } from './helpers/api-mock';
import { PROPERTY_ID, configEnabled } from './fixtures/pricing.fixtures';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

const BOOKING_ID = 'book-biz-e2e-001';
const PAYMENT_ID = 'pay-biz-e2e-001';

test.describe('Business Golden Path', () => {
  test('host onboarding → plan selection → short-rent dashboard', async ({ page }) => {
    await page.goto(demoUrl('/onboarding', 'onboarding'));

    await expect(page.getByRole('heading', { name: /Da dove vuoi iniziare|Where do you want to start/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Scegli|Choose/i })).toHaveCount(3);

    await completeOnboardingFromRentalChoice(page, 0);

    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });
  });

  test('property create → detail shows CIN + OTA + pricing sections', async ({ page }) => {
    await mockPropertiesApi(page);
    await mockCurrentUserWithOrg(page);
    // The plan still has room (the default of the mock is a plan that is full): the page of creation blocks the form at the limit.
    await mockEntitlement(page, { properties: 0 });

    await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'));

    await page.getByRole('link', { name: /^(Add Property|Aggiungi immobile)$/i }).click();
    const created = await createPropertyWithWizard(page, {
      name: 'Casa Business',
      address: 'Via Garibaldi 42',
      comune: 'Milano',
      postalCode: '20100',
    });
    expect(created.status()).toBe(201);

    // The property exists from the first «Continua»: «Salva e chiudi» leaves the wizard, and the list has it («Da completare»).
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'photos');
    await page.getByTestId('property-wizard-save-close').click();
    await expect(page).toHaveURL(/\/app\/short-rent\/properties(\?|$)/);

    // Navigate to detail: the name in the list opens the drawer of the property, which leads to its page
    await expect(page.getByRole('button', { name: 'Casa Business', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Casa Business', exact: true }).click();
    await page.getByRole('link', { name: 'Apri la scheda completa' }).click();

    await expect(page.getByRole('heading', { name: 'Casa Business' })).toBeVisible();
    await expect(page.getByText(/CIN mancante|Missing CIN/i)).toBeVisible();
    // The detail is split in tabs (overview with the seasonal suggestions, iCal calendars: the OTA channels are frozen, D10).
    await expect(page.getByRole('heading', { name: "Dati dell'immobile" })).toBeVisible();

    await page.getByRole('tab', { name: 'Calendari iCal' }).click();
    await expect(page.getByTestId('property-ical-settings')).toBeVisible();

    await page.getByRole('tab', { name: 'Panoramica' }).click();
    await expect(page.getByRole('link', { name: 'Gestisci i suggerimenti' }).first()).toBeVisible();
  });

  test('seasonal suggestions: enable toggle → save config → verify On badge', async ({ page }) => {
    // The assertions below are written against the English texts: pin the locale (the product default is Italian).
    await pinE2eLocale(page, 'en');
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page);
    await mockPricingApiDefaults(page);

    // The configuration starts disabled; after the save the page reloads it, and the server answers the saved one.
    let saveCallCount = 0;
    await page.route(`**/api/pricing-adapter/config/${PROPERTY_ID}`, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(saveCallCount > 0 ? configEnabled : { ...configEnabled, isEnabled: false }),
        });
        return;
      }
      if (method === 'POST') {
        saveCallCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(configEnabled),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(demoUrl(`/app/short-rent/properties/${PROPERTY_ID}/pricing`, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'Seasonal suggestions', level: 1 })).toBeVisible();
    const toggle = page.getByRole('switch', { name: /turn on seasonal suggestions/i });
    await expect(toggle).not.toBeChecked();

    await toggle.click();
    await expect.poll(() => saveCallCount).toBe(1);
    await expect(page.getByText('Suggestion rules saved')).toBeVisible();
    await expect(page.getByText('On', { exact: true })).toBeVisible();
  });

  test('booking create with tourist tax → the summary shows the quoted tax, then the confirmation', async ({ page }) => {
    await mockPropertiesApi(page, [buildCreatedProperty({ id: PROPERTY_ID })]);
    await mockCurrentUserWithOrg(page);

    await page.route('**/api/bookings/manual', async (route) => {
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

    await page.route('**/api/bookings/quote', async (route) => {
      if (route.request().method() !== 'POST') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          propertyId: PROPERTY_ID,
          checkInDate: '2026-08-01',
          checkOutDate: '2026-08-07',
          nights: 6,
          nightlyRate: 150,
          lodgingTotal: 900,
          cleaningFee: 0,
          basePrice: 900,
          totalPrice: 930,
          currency: 'EUR',
          touristTax: { status: 'Calculated', amount: 30, taxableNights: 6, ageRulesApply: false, categories: [] },
          paymentOptions: { deferredPaymentAvailable: false, deferredChargeDate: null, freeCancellationUntil: null },
        }),
      });
    });

    // The dates are free (SR-06a): the wizard asks the availability as soon as it knows the dates. Registered after the generic
    // mocks of the properties, so that it answers first.
    await page.route('**/api/properties/*/availability*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          propertyId: PROPERTY_ID,
          from: '2099-08-01',
          to: '2099-08-07',
          state: 'ok',
          invalidReason: null,
          nights: 6,
          minNights: null,
          conflicts: [],
          nearestFreeWindow: null,
          linkableBlockId: null,
        }),
      });
    });

    await page.goto(demoUrl('/app/short-rent/bookings/create', 'short-stay'));

    // Step 1, the stay: the arrival cannot be in the past, so far-future dates (the mocked API quotes the same whatever they are).
    await page.locator('#propertyId').selectOption({ index: 1 });
    await page.getByLabel(/Check-in/i).fill('2099-08-01');
    await page.getByLabel(/Check-out/i).fill('2099-08-07');
    await page.getByTestId('booking-wizard-next').click();

    // Step 2, the guest.
    await fillHostBookingGuestContact(page);
    await page.getByTestId('booking-wizard-next').click();

    // Step 3, the summary: the price is the quote of the API, tourist tax included.
    await expect(page.getByTestId('booking-price-tax')).toContainText(/30[,.]00/, { timeout: 10_000 });

    const resp = page.waitForResponse(
      (r) => r.request().method() === 'POST' && /\/api\/bookings\/manual\/?$/.test(new URL(r.url()).pathname),
    );
    await page.getByTestId('booking-create-button').click();
    expect((await resp).status()).toBe(201);

    // The confirmation leads to the booking.
    await expect(page.getByTestId('wizard-done-primary')).toBeVisible({ timeout: 10_000 });
  });

  test('payment create → recorded as pending and listed', async ({ page }) => {
    // The host only records the payment (POST /api/payments, method required): there is no "process" action in the app,
    // a card payment is settled by Stripe and arrives as Completed (BK-02).
    await mockCurrentUserWithOrg(page);
    await page.route(/\/api\/bookings(\/|\?|$)/, async (route) => {
      if (route.request().method() !== 'GET') { await route.fallback(); return; }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: BOOKING_ID,
          propertyId: PROPERTY_ID,
          status: 'Confirmed',
          checkInDate: '2026-08-01',
          checkOutDate: '2026-08-07',
          numberOfGuests: 4,
          totalPrice: 930,
          currency: 'EUR',
          guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario@example.com' },
        }]),
      });
    });

    // A payment as the list gives it (SR-03): the guest, the property and the code of the booking, the amounts in euros and cents.
    const created = {
      id: PAYMENT_ID,
      bookingId: BOOKING_ID,
      bookingCode: 'ABCDE-FGHIJ',
      propertyId: PROPERTY_ID,
      propertyName: 'Casa Business',
      guestName: 'Mario Rossi',
      amount: 930,
      amountCents: 93000,
      currency: 'EUR',
      refundedAmount: 0,
      refundedAmountCents: 0,
      status: 'Completed',
      method: 'BankTransfer',
      description: '',
      processedAt: '2026-07-01T10:00:00Z',
      createdAt: '2026-07-01T10:00:00Z',
    };
    let postedBody: Record<string, unknown> | null = null;

    await page.route('**/api/payments', async (route) => {
      if (route.request().method() === 'POST') {
        postedBody = route.request().postDataJSON() as Record<string, unknown>;
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
        return;
      }
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(postedBody ? [created] : []),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(demoUrl('/app/short-rent/payments/create', 'short-stay'));

    await page.locator('#bookingId').selectOption(BOOKING_ID);
    await page.locator('#amount').fill('930');
    await page.locator('#method').selectOption('BankTransfer');
    await page.getByRole('button', { name: 'Registra incasso' }).click();

    await expect.poll(() => postedBody).toMatchObject({ bookingId: BOOKING_ID, amount: 930, method: 'BankTransfer' });

    // Back on the list, the payment is there, already collected (SR-06b: a recorded payment is born collected).
    await expect(page).toHaveURL(/\/app\/short-rent\/payments$/);
    const row = page.getByRole('row', { name: /Bonifico bancario/ });
    await expect(row).toContainText('Incassato');
  });
});
