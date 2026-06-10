import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import {
  DEMO_CHECKIN_TOKEN,
  DEMO_BOOKING_ID,
  mockAlloggiatiApi,
  mockBookingDetailApi,
  mockCheckInApi,
} from './helpers/alloggiati-mock';

test.describe('Alloggiati Web MVP (#1)', () => {
  test.describe('AC8 guest check-in', () => {
    test.beforeEach(async ({ page }) => {
      await mockCheckInApi(page);
    });

    test('public check-in form loads and submits guest data', async ({ page }) => {
      await page.goto(`/checkin/${DEMO_CHECKIN_TOKEN}`);

      await expect(page.getByTestId('checkin-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Check-in ospite')).toBeVisible();
      await expect(page.getByTestId('checkin-gdpr-consent')).toBeVisible();

      await page.locator('#dateOfBirth').fill('1990-05-15');
      await page.locator('#placeOfBirth').fill('Roma');
      await page.locator('#nationality').fill('Italiana');
      await page.locator('#gender').selectOption('Male');
      await page.locator('#documentType').selectOption('IdentityCard');
      await page.locator('#documentNumber').fill('AB1234567');
      await page.locator('#documentIssuingCountry').fill('IT');
      await page.getByLabel(/Acconsento al trattamento/i).click();

      let authHeader: string | undefined;
      await page.route(`**/api/checkin/${DEMO_CHECKIN_TOKEN}/guest-data`, async (route) => {
        authHeader = route.request().headers()['authorization'];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ dataComplete: true }),
        });
      });

      await page.getByRole('button', { name: 'Salva dati' }).click();
      await expect(page.getByText('Dati registrati con successo')).toBeVisible({ timeout: 10_000 });
      expect(authHeader).toBeUndefined();
    });
  });

  test.describe('AC9 owner dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await mockAlloggiatiApi(page);
    });

    test('dashboard shows Alloggiati status badges', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/alloggiati', 'short-stay'));

      await expect(page.getByTestId('alloggiati-dashboard')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Alloggiati Web')).toBeVisible();
      await expect(page.getByTestId(`alloggiati-row-${DEMO_BOOKING_ID}`)).toBeVisible();
      await expect(page.getByTestId('alloggiati-status-badge').first()).toBeVisible();
      await expect(page.getByText('In attesa')).toBeVisible();
      await expect(page.getByText('Scaduto')).toBeVisible();
    });
  });

  test.describe('AC10 manual resend', () => {
    test.beforeEach(async ({ page }) => {
      await mockAlloggiatiApi(page);
      await mockBookingDetailApi(page);
    });

    test('resend button visible on failed booking detail', async ({ page }) => {
      await page.goto(demoUrl(`/app/short-rent/bookings/${DEMO_BOOKING_ID}`, 'short-stay'));

      await expect(page.getByTestId('booking-alloggiati-section')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('alloggiati-status-badge')).toHaveText('Errore');
      await expect(page.getByTestId('alloggiati-resend-button')).toBeVisible();

      await page.getByTestId('alloggiati-resend-button').click();
      await expect(page.getByText('Comunicazione inviata')).toBeVisible({ timeout: 10_000 });
    });
  });
});
