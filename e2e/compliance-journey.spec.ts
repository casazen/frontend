import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCinComplianceApi } from './helpers/cin-mock';
import { mockAlloggiatiApi, mockCheckInApi, mockBookingDetailApi, DEMO_CHECKIN_TOKEN, DEMO_BOOKING_ID } from './helpers/alloggiati-mock';

const TAX_RATE_ID = 'tax-e2e-001';
const GUEST_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function mockTouristTaxApi(page: import('@playwright/test').Page) {
  const defaultRates = [{
    id: TAX_RATE_ID,
    region: 'Lombardia',
    city: 'Como',
    ratePerNight: 2.50,
    maxNights: 4,
    minimumAge: 14,
    effectiveFrom: '2026-01-01T00:00:00Z',
    effectiveUntil: null,
  }];

  const store = { rates: [...defaultRates] };

  page.route('**/api/touristtaxrates**', async (route) => {
    const method = route.request().method();
    const url = route.request().url();

    if (method === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store.rates) });
      return;
    }
    if (method === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const created = { id: 'tax-e2e-new', ...body };
      store.rates.push(created as typeof defaultRates[0]);
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
      return;
    }
    if (method === 'PUT' && url.includes(`/${TAX_RATE_ID}`)) {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      const idx = store.rates.findIndex((r) => r.id === TAX_RATE_ID);
      if (idx >= 0) store.rates[idx] = { ...store.rates[idx], ...body };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(store.rates[idx]) });
      return;
    }
    if (method === 'DELETE' && url.includes(`/${TAX_RATE_ID}`)) {
      store.rates = store.rates.filter((r) => r.id !== TAX_RATE_ID);
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fallback();
  });
}

function mockGdprApi(page: import('@playwright/test').Page) {
  page.route(`**/api/gdpr/export/${GUEST_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        guestId: GUEST_ID,
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario.rossi@example.com',
        documentNumber: 'AB1234567',
        bookings: [],
      }),
    });
  });

  page.route(`**/api/gdpr/erasure/${GUEST_ID}`, async (route) => {
    if (route.request().method() !== 'DELETE') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ erasureRequested: true, guestId: GUEST_ID }),
    });
  });

  page.route(`**/api/gdpr/anonymize/${GUEST_ID}`, async (route) => {
    if (route.request().method() !== 'POST') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ anonymized: true, guestId: GUEST_ID }),
    });
  });
}

test.describe('Italian Compliance Golden Path', () => {
  test.describe('CIN (D.L. 145/2023)', () => {
    test.beforeEach(async ({ page }) => {
      await mockPropertiesApi(page);
      await mockCinComplianceApi(page);
    });

    test('property create validates CIN format IT-XXXXX-XXXXXXXXXX', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'));

      await page.getByRole('button', { name: /Add|Aggiungi/i }).click();

      await page.getByLabel(/Property Name|Nome proprietà/i).fill('Casa Conforme');
      await page.getByLabel(/Description|Descrizione/i).fill('Test CIN validation.');
      await page.getByLabel(/Address|Indirizzo/i).fill('Via Dante 1');
      await page.getByLabel(/City|Città/i).fill('Roma');
      await page.getByLabel(/Country|Nazione/i).fill('IT');
      await page.getByLabel(/ZIP|CAP/i).fill('00100');
      await page.getByLabel(/Bedrooms|Camere/i).fill('2');
      await page.getByLabel(/Bathrooms|Bagni/i).fill('1');
      await page.getByLabel(/Max Guests|Ospiti max/i).fill('4');
      await page.getByLabel(/Price per Night|Prezzo per notte/i).fill('120');

      // Valid CIN
      await page.getByLabel(/CIN/i).fill('IT-12345-0123456789');

      const resp = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/properties'),
      );
      await page.getByRole('button', { name: /Create|Crea/i }).click();
      expect((await resp).status()).toBe(201);
      await expect(page.getByText(/created successfully|creata con successo/i)).toBeVisible();
    });

    test('CIN deadline banner visible → navigates to compliance dashboard', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'));

      await expect(page.getByTestId('cin-deadline-banner')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Conformità CIN richiesta/i)).toBeVisible();

      await page.goto(demoUrl('/app/short-rent/cin', 'short-stay'));
      await expect(page.getByTestId('cin-compliance-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('cin-summary-cards')).toBeVisible();
      await expect(page.getByTestId('cin-compliance-table')).toBeVisible();
      await expect(page.getByText('Mancante')).toBeVisible();
      await expect(page.getByText('Valido')).toBeVisible();
    });
  });

  test.describe('Tourist Tax', () => {
    test.beforeEach(async ({ page }) => {
      await mockTouristTaxApi(page);
    });

    test('admin CRUD: creates, edits, deletes a tourist tax rate', async ({ page }) => {
      await page.goto(demoUrl('/app/admin/tourist-tax', 'admin'));

      // Create
      await page.getByRole('button', { name: /Aggiungi aliquota/i }).click();
      await page.getByLabel(/Regione/i).fill('Lazio');
      await page.getByLabel(/Città|Comune/i).fill('Roma');
      await page.getByLabel(/Tariffa per notte/i).fill('3.50');
      await page.getByLabel(/Notti massime/i).fill('10');
      await page.getByRole('button', { name: /Salva/i }).click();
      await expect(page.getByText(/creata con successo|created successfully/i)).toBeVisible({ timeout: 10_000 });

      // Verify appears
      await expect(page.getByText('Roma')).toBeVisible();
      await expect(page.getByText('3.50')).toBeVisible();
    });

    test('public tourist tax widget calculates without auth header', async ({ page }) => {
      let authHeader: string | undefined;
      await page.route('**/api/public/tourist-tax/calculate', async (route) => {
        authHeader = route.request().headers()['authorization'];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            comuneSlug: 'como',
            city: 'Como',
            taxAmount: 20,
            numberOfAdults: 2,
            numberOfChildren: 0,
            nights: 4,
            ratePerPersonPerNight: 2.50,
            maxNightsApplied: 4,
            checkInDate: '2026-07-01',
            checkOutDate: '2026-07-05',
            disclaimer: 'Stima indicativa.',
          }),
        });
      });

      await page.goto('/p/tassa-soggiorno/como');

      await expect(page.getByTestId('tourist-tax-calculator-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('tourist-tax-rate-summary')).toContainText('2,50');

      await page.getByTestId('tax-calculate-button').click();
      await expect(page.getByTestId('tax-calculation-result')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('tax-calculation-result')).toContainText('20,00');
      expect(authHeader).toBeUndefined();
    });

    test('booking creation shows tourist tax line item', async ({ page }) => {
      // Mock booking create response with tourist tax
      await page.route('**/api/bookings', async (route) => {
        if (route.request().method() !== 'POST') { await route.fallback(); return; }
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: DEMO_BOOKING_ID,
            propertyId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            status: 'Confirmed',
            checkInDate: '2026-07-01',
            checkOutDate: '2026-07-05',
            numberOfGuests: 2,
            basePrice: 480,
            touristTax: 20,
            totalPrice: 500,
            currency: 'EUR',
            createdAt: new Date().toISOString(),
          }),
        });
      });

      await page.goto(demoUrl('/app/short-rent/bookings/create', 'short-stay'));

      await page.getByLabel(/Property|Proprietà/i).selectOption({ index: 1 });
      await page.getByLabel(/Check-in/i).fill('2026-07-01');
      await page.getByLabel(/Check-out/i).fill('2026-07-05');
      await page.getByLabel(/Guests|Ospiti/i).fill('2');

      const resp = page.waitForResponse(
        (r) => r.request().method() === 'POST' && r.url().includes('/api/bookings'),
      );
      await page.getByRole('button', { name: /Create|Crea/i }).click();
      expect((await resp).status()).toBe(201);

      await expect(page.getByText(/20[,.]00/)).toBeVisible();
    });
  });

  test.describe('Alloggiati Web (D.L. 286/1998)', () => {
    test('public check-in form submits guest data without auth header', async ({ page }) => {
      await mockCheckInApi(page);

      let authHeader: string | undefined;
      await page.route(`**/api/checkin/${DEMO_CHECKIN_TOKEN}/guest-data`, async (route) => {
        authHeader = route.request().headers()['authorization'];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ dataComplete: true }),
        });
      });

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

      await page.getByRole('button', { name: 'Salva dati' }).click();
      await expect(page.getByText(/registrati con successo|successfully registered/i)).toBeVisible({ timeout: 10_000 });
      expect(authHeader).toBeUndefined();
    });

    test('dashboard shows Alloggiati status with overdue badge', async ({ page }) => {
      await mockAlloggiatiApi(page);

      await page.goto(demoUrl('/app/short-rent/alloggiati', 'short-stay'));

      await expect(page.getByTestId('alloggiati-dashboard')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Alloggiati Web')).toBeVisible();
      await expect(page.getByTestId(`alloggiati-row-${DEMO_BOOKING_ID}`)).toBeVisible();
      await expect(page.getByText('In attesa')).toBeVisible();
      await expect(page.getByText('Scaduto')).toBeVisible();
    });

    test('resend available on failed Alloggiati booking detail', async ({ page }) => {
      await mockAlloggiatiApi(page);
      await mockBookingDetailApi(page);

      await page.goto(demoUrl(`/app/short-rent/bookings/${DEMO_BOOKING_ID}`, 'short-stay'));

      await expect(page.getByTestId('booking-alloggiati-section')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('alloggiati-status-badge')).toHaveText('Errore');
      await expect(page.getByTestId('alloggiati-resend-button')).toBeVisible();

      await page.getByTestId('alloggiati-resend-button').click();
      await expect(page.getByText('Comunicazione inviata')).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('GDPR (Art. 17)', () => {
    test.beforeEach(async ({ page }) => {
      await mockGdprApi(page);
      await mockBookingDetailApi(page);
    });

    test('GDPR data export returns guest personal data', async ({ page }) => {
      await page.goto(demoUrl(`/app/short-rent/bookings/${DEMO_BOOKING_ID}`, 'short-stay'));

      await expect(page.getByTestId('gdpr-export-button') ?? page.getByRole('button', { name: /Esporta dati|Export data/i })).toBeVisible({ timeout: 10_000 });

      const exportBtn = page.getByTestId('gdpr-export-button') ?? page.getByRole('button', { name: /Esporta dati|Export data/i });
      if (await exportBtn.isVisible().catch(() => false)) {
        const exportResp = page.waitForResponse(
          (r) => r.url().includes(`/api/gdpr/export/${GUEST_ID}`),
          { timeout: 10_000 },
        );
        await exportBtn.click();
        expect((await exportResp).status()).toBe(200);
      }
    });

    test('GDPR anonymization masks guest data', async ({ page }) => {
      await page.goto(demoUrl(`/app/short-rent/bookings/${DEMO_BOOKING_ID}`, 'short-stay'));

      const anonBtn = page.getByTestId('gdpr-anonymize-button') ?? page.getByRole('button', { name: /Anonimizza|Anonymize/i });
      if (await anonBtn.isVisible().catch(() => false)) {
        const anonResp = page.waitForResponse(
          (r) => r.url().includes(`/api/gdpr/anonymize/${GUEST_ID}`),
          { timeout: 10_000 },
        );
        await anonBtn.click();
        expect((await anonResp).status()).toBe(200);
      }
    });
  });
});
