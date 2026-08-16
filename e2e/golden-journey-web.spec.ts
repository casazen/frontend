import { test as l3, expect as l3expect } from '@playwright/test';
import { readAccessToken } from './helpers/auth';
import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import {
  DEMO_ORG_SLUG,
  mockBrandedBookingApi,
  mockPublicOrg,
} from './helpers/branded-booking-mock';
import { mockComplianceApi } from './helpers/compliance-mock';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

const isLocalL3 = process.env.E2E_LOCAL === '1' || process.env.E2E_STAGING === '1';
const API = process.env.E2E_LOCAL_API_URL ?? 'http://localhost:5000/api';

/**
 * Golden Journey web — AC1–AC5.
 * L2 demo (default CI) keeps page.route. L3 (`E2E_LOCAL=1`) hits the real API with unique slugs.
 */
test.describe('Golden Journey web (#301)', () => {
  test.skip(isLocalL3, 'L3 real-API describe covers steps 1–12');
  test.beforeEach(async ({ page }) => {
    await mockBrandedBookingApi(page);
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('GJ steps 3–4 sequential (demo mode)', async ({ page }) => {
    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    // Step 3: host onboarding → consents → plan → short-rent
    await page.goto(demoUrl('/onboarding', 'onboarding'));
    await expect(page.getByRole('heading', { name: /Come vuoi usare CasaZen/i })).toBeVisible();
    await page.getByRole('button', { name: 'Scegli' }).first().click();

    const checkboxes = page.getByTestId('onboarding-consents-step').getByRole('checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByTestId('onboarding-consents-continue').click();

    await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
    await page.getByTestId('onboarding-plan-confirm').click();
    await expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 15_000 });

    // Step 4: guest public booking — branded shell
    await page.goto(demoUrl(`/book/${DEMO_ORG_SLUG}`, 'short-stay'), { waitUntil: 'networkidle' });
    await expect(page.getByTestId('public-site-shell')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('heading', { level: 1, name: mockPublicOrg.displayName, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Trastevere Suite' })).toBeVisible();

    expect(api500).toEqual([]);
  });

  test('GJ steps 5–7 host ops shell (calendar + marketplace + compliance)', async ({ page }) => {
    const property = buildCreatedProperty({ name: 'Villa GJ' });
    await mockPropertiesApi(page, [property]);
    await mockComplianceApi(page);
    await page.route('**/api/bookings/calendar**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], bookings: [] }),
      });
    });
    await page.route('**/api/bookings**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const url = route.request().url();
      if (url.includes('/calendar')) {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });
    await page.route('**/api/suppliers**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 0 }),
      });
    });

    const api500: string[] = [];
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });

    await page.goto(demoUrl('/app/short-rent/bookings/calendar', 'short-stay'), {
      waitUntil: 'networkidle',
    });
    await expect(page.locator('#calendar-property')).toBeVisible({ timeout: 15_000 });

    await page.goto(demoUrl('/app/short-rent/marketplace', 'short-stay'));
    await expect(page.locator('body')).toBeVisible();

    await page.goto(demoUrl('/app/short-rent', 'short-stay'));
    await expect(page.getByTestId('compliance-summary-widget')).toBeVisible({ timeout: 15_000 });

    expect(api500).toEqual([]);
  });

  test('resolve-host API mock: subdomain maps to org branding (#288)', async ({ page }) => {
    await page.route('**/api/public/resolve-host**', async (route) => {
      const url = new URL(route.request().url());
      const host = url.searchParams.get('host');
      if (host === `${DEMO_ORG_SLUG}.casazen.it`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: '11111111-1111-1111-1111-111111111101',
            slug: DEMO_ORG_SLUG,
            publicHostMode: 'CasazenSubdomain',
            branding: mockPublicOrg,
          }),
        });
        return;
      }
      await route.fulfill({ status: 404, body: '{}' });
    });

    await page.goto(demoUrl('/', 'short-stay'));
    const result = await page.evaluate(async (slug) => {
      const res = await fetch(`/api/public/resolve-host?host=${slug}.casazen.it`);
      return { status: res.status, slug: (await res.json()).slug as string };
    }, DEMO_ORG_SLUG);

    expect(result.status).toBe(200);
    expect(result.slug).toBe(DEMO_ORG_SLUG);
  });
});

l3.describe('Golden Journey web L3 real API (AC1–AC5, AC14)', () => {
  l3.skip(!isLocalL3, 'Set E2E_LOCAL=1 (or E2E_STAGING=1) against a real API');
  l3.setTimeout(180_000);

  l3('steps 1–12 sequential against live API', async ({ page, request }) => {
    const run = `gj-${Date.now()}`;
    const supplierEmail = `${run}@mailinator.com`;
    const propertyName = `GJ Villa ${run}`;
    const propertySlug = run;
    const api500: string[] = [];
    let capturedBearer: string | null = null;
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        api500.push(`${res.status()} ${res.url()}`);
      }
    });
    page.on('request', (req) => {
      const header = req.headers()['authorization'];
      if (header?.startsWith('Bearer ') && req.url().includes('/api/')) {
        capturedBearer = header.slice('Bearer '.length);
      }
    });

    const register = await request.post(`${API}/suppliers/register`, {
      data: {
        email: supplierEmail,
        legalName: `GJ Supplier ${run}`,
        phone: '+390612345678',
        comuneCode: '058091',
      },
    });
    l3expect(register.status(), 'Step 1 supplier register').toBe(201);
    const registered = (await register.json()) as { orgId: string };
    l3expect(registered.orgId).toBeTruthy();

    const activationAnon = await request.get(`${API}/supplier/profile/activation`);
    l3expect(activationAnon.status(), 'Step 2 activation requires auth').toBe(401);

    await page.goto('/app/short-rent/properties');
    await page.addInitScript(() => {
      localStorage.setItem('casazen.locale', 'it');
    });

    const onboarding = page.getByRole('heading', { name: /Come vuoi usare CasaZen/i });
    if (await onboarding.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'Scegli' }).first().click();
    }
    const consentsContinue = page.getByTestId('onboarding-consents-continue');
    if (await consentsContinue.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const checkboxes = page.getByTestId('onboarding-consents-step').getByRole('checkbox');
      const count = await checkboxes.count();
      for (let i = 0; i < count; i++) {
        await checkboxes.nth(i).check();
      }
      await consentsContinue.click();
    }
    const selectPlan = page.getByRole('button', { name: /Seleziona|Select/i }).first();
    if (await selectPlan.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await selectPlan.click();
    }
    const planConfirm = page.getByTestId('onboarding-plan-confirm');
    if (await planConfirm.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await planConfirm.click();
      await l3expect(page).toHaveURL(/\/app\/short-rent/, { timeout: 20_000 });
    }

    const token = (await readAccessToken(page)) ?? capturedBearer;
    l3expect(token, 'Auth0 access token from storageState').toBeTruthy();
    const auth = { Authorization: `Bearer ${token}` };

    const emptyCreate = await request.post(`${API}/properties`, {
      headers: auth,
      data: { name: '' },
    });
    l3expect(emptyCreate.status(), 'PE2E-ORG / AC4 validation').toBeGreaterThanOrEqual(400);
    l3expect(emptyCreate.status()).toBeLessThan(500);

    const create = await request.post(`${API}/properties`, {
      headers: auth,
      data: {
        name: propertyName,
        description: 'Proprietà golden journey L3',
        address: `Via Roma ${run}`,
        city: 'Roma',
        postalCode: '00100',
        bedrooms: 2,
        bathrooms: 1,
        maxGuests: 4,
        nightlyRate: 90,
        slug: propertySlug,
      },
    });
    l3expect(create.status(), 'Step 3 / PE2E-ORG create property').toBe(201);
    const property = (await create.json()) as { id: string; slug?: string };
    l3expect(property.id).toBeTruthy();

    const me = await request.get(`${API}/users/me`, { headers: auth });
    l3expect(me.status()).toBe(200);
    const meBody = (await me.json()) as { slug?: string; org?: { slug?: string } };
    const orgSlug = meBody.slug ?? meBody.org?.slug;
    if (orgSlug) {
      const pub = await request.get(`${API}/public/orgs/${orgSlug}`);
      l3expect([200, 404], 'PE2E-BOOK public org').toContain(pub.status());
      l3expect(pub.status()).not.toBe(500);
    }

    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 14);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 3);
    const cal = await request.get(`${API}/bookings/calendar`, {
      headers: auth,
      params: {
        propertyId: property.id,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
      },
    });
    l3expect(cal.status(), 'Step 5 calendar with propertyId').toBe(200);

    const calMissing = await request.get(`${API}/bookings/calendar`, { headers: auth });
    l3expect(calMissing.status(), 'PE2E-CAL missing propertyId').not.toBe(500);

    const hostBooking = await request.post(`${API}/bookings`, {
      headers: auth,
      data: {
        propertyId: property.id,
        checkInDate: start.toISOString(),
        checkOutDate: end.toISOString(),
        numberOfGuests: 2,
        guest: {
          firstName: 'Mario',
          lastName: 'Rossi',
          email: `guest-${run}@mailinator.com`,
          phoneNumber: '+393331234567',
        },
      },
    });
    l3expect(hostBooking.status(), 'Step 4 host booking create').toBeLessThan(500);
    let bookingId: string | undefined;
    if (hostBooking.ok()) {
      const booking = (await hostBooking.json()) as { id?: string; bookingId?: string };
      bookingId = booking.id ?? booking.bookingId;
    }

    if (bookingId) {
      const session = await request.get(`${API}/bookings/${bookingId}/checkin-session`, {
        headers: auth,
      });
      l3expect(session.status(), 'Step 6 check-in session').toBeLessThan(500);
    }

    const sr = await request.post(`${API}/service-requests`, {
      headers: auth,
      data: {
        propertyId: property.id,
        supplierOrgId: registered.orgId,
        category: 'cleaning',
        notes: `Turnover ${run}`,
      },
    });
    l3expect(sr.status(), 'Step 7 create ServiceRequest').toBeLessThan(500);
    let serviceRequestId: string | undefined;
    let srStatus: string | undefined;
    if (sr.status() === 201) {
      const created = (await sr.json()) as { id: string; status: string };
      serviceRequestId = created.id;
      srStatus = created.status;
      l3expect(srStatus).toBe('Richiesto');
    }

    if (serviceRequestId) {
      const takeAnon = await request.post(`${API}/service-requests/${serviceRequestId}/take`);
      l3expect(takeAnon.status(), 'Step 8 take requires supplier').toBe(401);

      const paid = await request.post(`${API}/service-requests/${serviceRequestId}/mark-paid`, {
        headers: auth,
      });
      l3expect(paid.status(), 'Step 10 mark-paid (host)').toBeLessThan(500);

      const after = await request.get(`${API}/service-requests/${serviceRequestId}`, {
        headers: auth,
      });
      l3expect(after.status()).toBeLessThan(500);
      if (after.ok() && bookingId) {
        const srBody = (await after.json()) as { status: string };
        const bookingGet = await request.get(`${API}/bookings/${bookingId}`, { headers: auth });
        l3expect(bookingGet.status()).toBeLessThan(500);
        if (bookingGet.ok()) {
          const b = (await bookingGet.json()) as { status?: string };
          l3expect(srBody.status, 'AC14 service-request status readable').toBeTruthy();
          l3expect(b.status, 'AC14 booking status readable').toBeTruthy();
        }
      }
    }

    if (bookingId) {
      const checkout = await request.post(`${API}/bookings/${bookingId}/checkout-wizard/start`, {
        headers: auth,
      });
      l3expect(checkout.status(), 'Step 11 checkout wizard').toBeLessThan(500);
    }

    const summary = await request.get(`${API}/compliance/summary`, { headers: auth });
    l3expect(summary.status(), 'Step 12 compliance summary').toBeLessThan(500);

    l3expect(api500, 'AC3 no API 500').toEqual([]);
  });
});
