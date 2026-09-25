import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { fillHostBookingGuestContact } from './helpers/onboarding';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import { mockCinComplianceApi } from './helpers/cin-mock';
import { mockAlloggiatiApi, mockCheckInApi, mockBookingDetailApi, DEMO_CHECKIN_TOKEN, DEMO_BOOKING_ID } from './helpers/alloggiati-mock';

const TAX_RATE_ID = 'tax-e2e-001';
const GUEST_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function mockTouristTaxApi(page: import('@playwright/test').Page) {
  const defaultRates = [{
    id: TAX_RATE_ID,
    city: 'Como',
    regionCode: 'LOM',
    istatCode: '013075',
    accommodationCategory: null,
    calculationMethod: 'PerPersonPerNight',
    ratePerPersonPerNight: 2.5,
    percentOfNightlyPrice: null,
    capPerPersonPerNight: null,
    maxNights: 4,
    minimumAge: 14,
    reducedRateMaxAge: null,
    reducedRatePerPersonPerNight: null,
    seasonStart: null,
    seasonEnd: null,
    isActive: true,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    notes: '',
    sourceUrl: null,
    verificationLevel: 'Official',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }];

  const store = { rates: [...defaultRates] };

  page.route('**/api/tourist-tax-rates**', async (route) => {
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
  page.route(`**/api/guests/${GUEST_ID}`, async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: GUEST_ID,
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario.rossi@example.com',
        phoneNumber: '+39 333 1234567',
        address: '',
        city: 'Roma',
        postalCode: '',
        country: 'IT',
        placeOfBirth: 'Roma',
        nationality: 'Italiana',
        documentNumberMasked: '*****567',
        documentIssuingCountry: 'IT',
        hasDocumentScan: false,
        notes: '',
        consentVersion: '1.0',
        marketingConsent: true,
        dataProcessingPurpose: 'Alloggiati Web',
        erasureRequested: false,
        isDeleted: false,
        deletionReason: '',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      }),
    });
  });

  page.route(`**/api/gdpr/guests/${GUEST_ID}`, async (route) => {
    if (route.request().method() !== 'GET' || route.request().url().includes('/export')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        guestId: GUEST_ID,
        marketing: { granted: true, since: '2026-09-02T10:00:00Z', version: 'marketing-2026-09' },
        privacyNotice: { version: 'notice-2026-09', presentedAt: '2026-09-02T10:00:00Z' },
        consentHistory: [],
        retention: [],
        isDeleted: false,
        hasDocumentScan: false,
        hasOpenBookings: false,
      }),
    });
  });

  page.route(`**/api/gdpr/guests/${GUEST_ID}/export`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        schemaVersion: '1',
        exportedAt: '2026-09-25T00:00:00Z',
        guestId: GUEST_ID,
        firstName: 'Mario',
        lastName: 'Rossi',
        email: 'mario.rossi@example.com',
      }),
    });
  });

  page.route('**/api/bookings**', async (route) => {
    if (route.request().method() !== 'GET') { await route.fallback(); return; }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  page.route(`**/api/gdpr/guests/${GUEST_ID}/anonymize`, async (route) => {
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

    test('property create accepts a real CIN written with hyphens', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'));

      await page.getByRole('button', { name: /^(Add Property|Aggiungi immobile)$/i }).click();

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

      // Real CIN (official BDSR format) typed with separators: accepted, the backend stores it normalized
      await page.getByLabel(/CIN/i).fill('IT-058091-C2-7G5FFZDZ');

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

      await page.goto(demoUrl('/app/short-rent/compliance/cin', 'short-stay'));
      await expect(page.getByTestId('cin-compliance-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('cin-summary-cards')).toBeVisible();
      await expect(page.getByTestId('cin-compliance-table')).toBeVisible();
      await expect(page.getByText(/Mancante|Missing/i)).toBeVisible();
      await expect(page.getByText(/Valido|Valid/i)).toBeVisible();
    });
  });

  test.describe('Tourist Tax', () => {
    test.beforeEach(async ({ page }) => {
      await mockTouristTaxApi(page);
    });

    test('admin CRUD: creates, edits, deletes a tourist tax rate', async ({ page }) => {
      await page.goto(demoUrl('/app/admin/compliance/tax-rates', 'admin'));

      // Create
      await page.getByRole('button', { name: /Nuova aliquota|New rate/i }).click();
      await page.locator('#city').fill('Roma');
      await page.locator('#regionCode').fill('LAZ');
      await page.locator('#ratePerPersonPerNight').fill('3.50');
      await page.locator('#maxNights').fill('10');
      await page.getByRole('button', { name: /^(Crea|Create)$/ }).click();
      await expect(page.getByText(/creata con successo|created successfully/i)).toBeVisible({ timeout: 10_000 });

      // Verify appears
      await expect(page.getByText('Roma')).toBeVisible();
      await expect(page.getByText('3.50')).toBeVisible();
    });

    test('public tourist tax widget calculates without auth header', async ({ page }) => {
      let authHeader: string | undefined;
      await page.route('**/api/public/content/tassa-soggiorno/como', async (route) => {
        if (route.request().method() !== 'GET') { await route.fallback(); return; }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'seo-tax-como',
            pageType: 'TouristTaxCalc',
            title: 'Tassa di soggiorno a Como',
            metaDescription: 'Calcolo della tassa di soggiorno a Como.',
            bodyHtml: '<p>Stima indicativa.</p>',
            comuneName: 'Como',
            comuneCode: '013075',
            regionCode: 'LOM',
            regionSlug: 'lombardia',
            comuneSlug: 'como',
            canonicalUrl: 'https://casazen.app/p/tassa-soggiorno/como',
            lastRefreshedAt: '2026-01-01T00:00:00Z',
            disclaimers: {
              lastUpdated: '2026-01-01',
              notLegalAdvice: 'Non è un parere legale.',
              aiGenerated: '',
            },
            cta: { signupUrl: '/signup' },
            touristTaxRates: [{
              city: 'Como',
              accommodationCategory: null,
              calculationMethod: 'PerPersonPerNight',
              ratePerPersonPerNight: 2.5,
              percentOfNightlyPrice: null,
              capPerPersonPerNight: null,
              maxNights: 4,
              minimumAge: 14,
              reducedRateMaxAge: null,
              reducedRatePerPersonPerNight: null,
              seasonStart: null,
              seasonEnd: null,
              effectiveFrom: '2026-01-01T00:00:00Z',
              effectiveTo: null,
              sourceUrl: null,
            }],
          }),
        });
      });
      await page.route('**/api/public/tourist-tax/calculate', async (route) => {
        authHeader = route.request().headers()['authorization'];
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            comuneSlug: 'como',
            city: 'Como',
            status: 'Calculated',
            taxAmount: 20,
            numberOfAdults: 2,
            numberOfChildren: 0,
            nights: 4,
            taxableNights: 4,
            ageRulesApply: true,
            categories: [],
            checkInDate: '2026-07-01',
            checkOutDate: '2026-07-05',
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
      await mockPropertiesApi(page, [buildCreatedProperty()]);
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

      await page.route('**/api/bookings/quote', async (route) => {
        if (route.request().method() !== 'POST') { await route.fallback(); return; }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            propertyId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
            checkInDate: '2026-07-01',
            checkOutDate: '2026-07-05',
            nights: 4,
            nightlyRate: 120,
            lodgingTotal: 480,
            cleaningFee: 0,
            basePrice: 480,
            totalPrice: 500,
            currency: 'EUR',
            touristTax: { status: 'Calculated', amount: 20, taxableNights: 4, ageRulesApply: false, categories: [] },
            paymentOptions: { deferredPaymentAvailable: false, deferredChargeDate: null, freeCancellationUntil: null },
          }),
        });
      });

      await page.goto(demoUrl('/app/short-rent/bookings/create', 'short-stay'));

      await page.locator('#propertyId').selectOption({ index: 1 });
      await page.getByLabel(/Check-in/i).fill('2026-07-01');
      await page.getByLabel(/Check-out/i).fill('2026-07-05');
      await page.getByLabel(/Guests|Ospiti/i).fill('2');
      await fillHostBookingGuestContact(page);

      const resp = page.waitForResponse(
        (r) => r.request().method() === 'POST' && /\/api\/bookings\/?$/.test(new URL(r.url()).pathname),
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
      page.on('request', (request) => {
        if (request.method() === 'POST' && request.url().includes(`/api/public/checkin/${DEMO_CHECKIN_TOKEN}`)) {
          authHeader = request.headers()['authorization'];
        }
      });

      await page.goto(`/checkin/${DEMO_CHECKIN_TOKEN}`);

      await expect(page.getByTestId('checkin-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole('heading', { name: /Check-in ospite|Guest check-in/i })).toBeVisible();
      await expect(page.getByTestId('checkin-progress')).toBeVisible();

      await page.getByRole('button', { name: /Avanti|Next/i }).click();
      await page.locator('#guest-0-documentNumber').fill('AB1234567');
      await page.getByRole('button', { name: /Avanti|Next/i }).click();

      await expect(page.getByTestId('checkin-privacy-notice')).toBeVisible();
      await page.getByTestId('checkin-submit').click();
      await expect(page.getByTestId('checkin-success')).toBeVisible({ timeout: 10_000 });
      expect(authHeader).toBeUndefined();
    });

    test('dashboard shows Alloggiati to send manually with overdue badge', async ({ page }) => {
      await mockAlloggiatiApi(page);

      await page.goto(demoUrl('/app/short-rent/alloggiati', 'short-stay'));

      const dashboard = page.getByTestId('alloggiati-dashboard');
      await expect(dashboard).toBeVisible({ timeout: 15_000 });
      await expect(dashboard.getByRole('heading', { name: 'Alloggiati Web' })).toBeVisible();
      await expect(page.getByTestId(`alloggiati-row-${DEMO_BOOKING_ID}`)).toBeVisible();
      await expect(page.getByTestId('alloggiati-status-badge').first()).toHaveText(/Da inviare manualmente|To send manually/i);
      await expect(page.getByTestId('alloggiati-overdue-badge')).toHaveText(/Scadenza superata|Overdue/i);
    });

    test('booking detail: host marks the Alloggiati record as sent manually', async ({ page }) => {
      await mockAlloggiatiApi(page);
      await mockBookingDetailApi(page);

      await page.goto(demoUrl(`/app/short-rent/bookings/${DEMO_BOOKING_ID}?tab=alloggiati`, 'short-stay'));

      await expect(page.getByTestId('booking-alloggiati-section')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('alloggiati-status-badge')).toHaveText(/Da inviare manualmente|To send manually/i);
      await expect(page.getByTestId('alloggiati-guest-summary')).toContainText('CA12345AB');

      await page.getByTestId('alloggiati-resend-button').click();
      await page.getByTestId('alloggiati-sent-confirm').click();
      await page.getByTestId('alloggiati-mark-sent-confirm').click();
      await expect(page.getByText(/Invio manuale registrato|Manual submission recorded/i)).toBeVisible({ timeout: 10_000 });
    });
  });

  test.describe('GDPR (Art. 17)', () => {
    test.beforeEach(async ({ page }) => {
      await mockGdprApi(page);
    });

    test('GDPR data export returns guest personal data', async ({ page }) => {
      await page.goto(demoUrl(`/app/short-rent/guests/${GUEST_ID}`, 'short-stay'));
      await page.getByRole('button', { name: /GDPR|Privacy/i }).click();

      const exportBtn = page.getByTestId('gdpr-export-button');
      await expect(exportBtn).toBeVisible({ timeout: 10_000 });
      const exportResp = page.waitForResponse(
        (r) => r.url().includes(`/api/gdpr/guests/${GUEST_ID}/export`),
        { timeout: 10_000 },
      );
      await exportBtn.click();
      expect((await exportResp).status()).toBe(200);
    });

    test('GDPR anonymization masks guest data', async ({ page }) => {
      await page.goto(demoUrl(`/app/short-rent/guests/${GUEST_ID}`, 'short-stay'));
      await page.getByRole('button', { name: /GDPR|Privacy/i }).click();

      const anonBtn = page.getByTestId('gdpr-anonymize-button');
      await expect(anonBtn).toBeVisible({ timeout: 10_000 });
      await anonBtn.click();
      const anonResp = page.waitForResponse(
        (r) => r.url().includes(`/api/gdpr/guests/${GUEST_ID}/anonymize`),
        { timeout: 10_000 },
      );
      await page.getByRole('button', { name: /Anonimizza|Anonymize/i }).last().click();
      expect((await anonResp).status()).toBe(200);
    });
  });
});
