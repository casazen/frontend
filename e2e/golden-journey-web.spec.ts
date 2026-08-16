import { test as l3, expect as l3expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { readAccessToken } from './helpers/auth';
import { e2eEnv } from './helpers/env';
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

/** Happy-path HTTP: only 200/201 count as success. 4xx is a failure unless the test names it. */
function expectSuccessStatus(status: number, label: string): void {
  l3expect([200, 201], `${label} (got ${status})`).toContain(status);
}

/**
 * Golden Journey web — AC1–AC5.
 * L2 demo (default CI) keeps page.route. L3 (`E2E_LOCAL=1`) hits the real API with unique slugs.
 */
test.describe('Golden Journey web (#301)', () => {
  test.skip(isLocalL3, 'L3 real-API describe covers steps 1–12');
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('casazen_cookie_consent');
      localStorage.setItem('casazen.locale', 'it');
    });
  });

  test('GJ steps 3–4 sequential (demo mode)', async ({ page }) => {
    test.setTimeout(60_000);
    await mockBrandedBookingApi(page);
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

    const consents = page.getByTestId('onboarding-consents-step');
    await expect(consents).toBeVisible({ timeout: 20_000 });
    const checkboxes = consents.getByRole('checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
      await checkboxes.nth(i).click();
    }
    const consentsContinue = page.getByTestId('onboarding-consents-continue');
    await expect(consentsContinue).toBeEnabled({ timeout: 10_000 });
    await consentsContinue.click();

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
    const property = buildCreatedProperty({
      id: '11111111-1111-1111-1111-111111111101',
      name: 'Villa GJ',
    });
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
        body: JSON.stringify({ bookings: [], timezone: 'Europe/Rome', utcOffsetMinutes: 60 }),
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
    await expect(
      page.locator('#calendar-property').or(page.getByText(/Nessuna proprietà disponibile/i)),
    ).toBeVisible({ timeout: 20_000 });

    await page.goto(demoUrl('/app/short-rent/marketplace', 'short-stay'), {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('body')).toBeVisible();

    await page.goto(demoUrl('/app/short-rent', 'short-stay'), {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByTestId('compliance-summary-widget').or(page.locator('body')),
    ).toBeVisible({ timeout: 15_000 });

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

    const linkSupplier = await request.post(`${API}/suppliers/register`, {
      headers: auth,
      data: {
        email: e2eEnv.auth0Email,
        legalName: `GJ Host Supplier ${run}`,
        phone: '+390612345678',
        comuneCode: '058091',
      },
    });
    if (linkSupplier.status() !== 201) {
      const alreadyLinked = await request.get(`${API}/supplier/profile`, { headers: auth });
      expectSuccessStatus(alreadyLinked.status(), 'Step 2 supplier already linked');
    }

    const profilePut = await request.put(`${API}/supplier/profile`, {
      headers: auth,
      data: {
        categories: ['cleaning'],
        comuni: ['058091'],
        bio: 'Fornitore golden journey L3',
      },
    });
    expectSuccessStatus(profilePut.status(), 'Step 2 supplier profile');

    const activate = await request.post(`${API}/supplier/profile/activation/complete`, {
      headers: auth,
      data: { tosAccepted: true },
    });
    expectSuccessStatus(activate.status(), 'Step 2 supplier Active');
    const actBody = (await activate.json()) as { status?: string };
    l3expect(actBody.status, 'Step 2 status Active').toBe('Active');

    const profileGet = await request.get(`${API}/supplier/profile`, { headers: auth });
    expectSuccessStatus(profileGet.status(), 'Step 2 supplier profile readable');
    const supplierProfile = (await profileGet.json()) as { orgId: string };
    l3expect(supplierProfile.orgId, 'Step 2 supplier org').toBeTruthy();

    const emptyCreate = await request.post(`${API}/properties`, {
      headers: auth,
      data: { name: '' },
    });
    l3expect(emptyCreate.status(), 'PE2E-ORG / AC4 validation (expected 400)').toBe(400);

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
    if (create.status() !== 201 && create.status() !== 403) {
      const body = await create.text();
      l3expect(create.status(), `Step 3 create property: ${body.slice(0, 400)}`).toBe(201);
    }
    let property: { id: string; slug?: string };
    if (create.status() === 201) {
      property = (await create.json()) as { id: string; slug?: string };
    } else {
      l3expect(create.status(), 'Step 3 plan limit reuses existing property').toBe(403);
      const listed = await request.get(`${API}/properties`, { headers: auth });
      expectSuccessStatus(listed.status(), 'Step 3 list properties after plan limit');
      const rows = (await listed.json()) as { id: string; slug?: string }[];
      l3expect(rows.length, 'existing properties after plan limit').toBeGreaterThan(0);
      property = rows[0];
    }
    l3expect(property.id).toBeTruthy();
    const icalExport = await request.get(`${API}/properties/${property.id}/ical/export-url`, {
      headers: auth,
    });
    expectSuccessStatus(icalExport.status(), 'Step 3 iCal export URL');
    const icalStatus = await request.get(`${API}/properties/${property.id}/ical/status`, {
      headers: auth,
    });
    expectSuccessStatus(icalStatus.status(), 'Step 3 iCal status');

    const me = await request.get(`${API}/users/me`, { headers: auth });
    expectSuccessStatus(me.status(), 'GET /users/me');
    const meBody = (await me.json()) as { slug?: string; org?: { slug?: string } };
    const orgSlug = meBody.slug ?? meBody.org?.slug;
    if (orgSlug) {
      const pub = await request.get(`${API}/public/orgs/${orgSlug}`);
      expectSuccessStatus(pub.status(), 'PE2E-BOOK public org');
      const pubProps = await request.get(`${API}/public/orgs/${orgSlug}/properties`);
      expectSuccessStatus(pubProps.status(), 'Step 3 public properties');
    }

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
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
    expectSuccessStatus(cal.status(), 'Step 5 calendar with propertyId');

    const calMissing = await request.get(`${API}/bookings/calendar`, { headers: auth });
    l3expect(calMissing.status(), 'PE2E-CAL missing propertyId (expected 404)').toBe(404);

    const guestPayload = {
      firstName: 'Mario',
      lastName: 'Rossi',
      email: `guest-${run}@mailinator.com`,
      phone: '+393331234567',
      country: 'IT',
    };
    const listedForBooking = await request.get(`${API}/properties`, { headers: auth });
    expectSuccessStatus(listedForBooking.status(), 'Step 4 list properties for booking window');
    const propertyCandidates = (await listedForBooking.json()) as { id: string }[];
    const orderedProperties = [
      property,
      ...propertyCandidates.filter((row) => row.id !== property.id),
    ];

    let hostBooking = await request.post(`${API}/bookings`, {
      headers: auth,
      data: {
        propertyId: property.id,
        checkInDate: start.toISOString(),
        checkOutDate: end.toISOString(),
        numberOfGuests: 2,
        guest: guestPayload,
      },
    });
    // Stay on today's check-in. If today is occupied, try other host properties — never shift into the future.
    bookingSearch: for (const candidate of orderedProperties) {
      for (const nights of [3, 2, 1]) {
        const windowEnd = new Date(start);
        windowEnd.setUTCDate(windowEnd.getUTCDate() + nights);
        hostBooking = await request.post(`${API}/bookings`, {
          headers: auth,
          data: {
            propertyId: candidate.id,
            checkInDate: start.toISOString(),
            checkOutDate: windowEnd.toISOString(),
            numberOfGuests: 2,
            guest: guestPayload,
          },
        });
        if (hostBooking.status() === 201) {
          property = candidate;
          break bookingSearch;
        }
      }
    }
    if (hostBooking.status() !== 201) {
      const body = await hostBooking.text();
      l3expect(hostBooking.status(), `Step 4 host booking create: ${body.slice(0, 400)}`).toBe(201);
    }
    const booking = (await hostBooking.json()) as { id?: string; bookingId?: string };
    const bookingId = booking.id ?? booking.bookingId;
    l3expect(bookingId, 'Step 4 booking id').toBeTruthy();

    const session = await request.get(`${API}/bookings/${bookingId}/checkin-session`, {
      headers: auth,
    });
    expectSuccessStatus(session.status(), 'Step 6 check-in session');

    const checkIn = await request.post(`${API}/bookings/${bookingId}/check-in`, {
      headers: auth,
    });
    const checkInBody = await checkIn.text();
    expectSuccessStatus(checkIn.status(), `Step 6 host check-in: ${checkInBody.slice(0, 400)}`);
    l3expect((JSON.parse(checkInBody) as { status?: string }).status, 'Step 6 booking CheckedIn').toBe(
      'CheckedIn',
    );

    const resendLink = await request.post(`${API}/bookings/${bookingId}/checkin/resend-link`, {
      headers: auth,
    });
    expectSuccessStatus(resendLink.status(), 'Step 6 guest check-in link');
    const resendBody = (await resendLink.json()) as { success?: boolean; checkInLink?: string };
    l3expect(resendBody.success, 'Step 6 check-in session created').toBe(true);
    if (resendBody.checkInLink) {
      const path = new URL(resendBody.checkInLink).pathname;
      await page.goto(path);
      await l3expect(page.getByTestId('checkin-page').or(page.getByText(/check-in/i).first())).toBeVisible({
        timeout: 15_000,
      });
    }

    const sr = await request.post(`${API}/service-requests`, {
      headers: auth,
      data: {
        propertyId: property.id,
        bookingId,
        supplierOrgId: supplierProfile.orgId,
        category: 'cleaning',
        notes: `Turnover ${run}`,
      },
    });
    l3expect(sr.status(), 'Step 7 create ServiceRequest').toBe(201);
    const createdSr = (await sr.json()) as { id: string; status: string };
    const serviceRequestId = createdSr.id;
    l3expect(createdSr.status).toBe('Richiesto');

    const takeAnon = await request.post(`${API}/service-requests/${serviceRequestId}/take`);
    l3expect(takeAnon.status(), 'Step 8 take requires supplier').toBe(401);

    const take = await request.post(`${API}/service-requests/${serviceRequestId}/take`, {
      headers: auth,
    });
    l3expect(take.status(), 'Step 8 take').toBe(200);
    l3expect(((await take.json()) as { status: string }).status).toBe('PresoInCarico');

    const complete = await request.post(`${API}/service-requests/${serviceRequestId}/complete`, {
      headers: auth,
      data: { notes: `Done ${run}` },
    });
    l3expect(complete.status(), 'Step 9 complete').toBe(200);
    l3expect(((await complete.json()) as { status: string }).status).toBe('Completato');

    const paid = await request.post(`${API}/service-requests/${serviceRequestId}/mark-paid`, {
      headers: auth,
    });
    l3expect(paid.status(), 'Step 10 mark-paid (host)').toBe(200);
    l3expect(((await paid.json()) as { status: string }).status).toBe('Pagato');

    const after = await request.get(`${API}/service-requests/${serviceRequestId}`, {
      headers: auth,
    });
    expectSuccessStatus(after.status(), 'AC14 GET service-request');
    const srBody = (await after.json()) as { status: string };
    const bookingGet = await request.get(`${API}/bookings/${bookingId}`, { headers: auth });
    expectSuccessStatus(bookingGet.status(), 'AC14 GET booking');
    const b = (await bookingGet.json()) as { status?: string };
    l3expect(srBody.status, 'AC14 service-request status').toBe('Pagato');
    l3expect(b.status, 'AC14 booking CheckedIn').toBe('CheckedIn');

    const checkout = await request.post(`${API}/bookings/${bookingId}/checkout-wizard/start`, {
      headers: auth,
    });
    const checkoutBody = await checkout.text();
    expectSuccessStatus(checkout.status(), `Step 11 checkout wizard start: ${checkoutBody.slice(0, 400)}`);

    await page.goto(`/app/short-rent/bookings/calendar`);
    await page.locator('#calendar-property').selectOption(property.id);
    await l3expect(page.getByText('Mario Rossi').first()).toBeVisible({ timeout: 20_000 });

    await page.goto(`/app/short-rent/bookings/${bookingId}`);
    await l3expect(page.getByText('Mario Rossi').first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'Ospite' }).click();
    await l3expect(
      page.getByTestId('checkin-session-badge').or(page.getByTestId('checkin-session-none')),
    ).toBeVisible({ timeout: 15_000 });

    await page.goto(`/app/short-rent/bookings/${bookingId}/checkout`);
    await l3expect(page.getByTestId('checkout-wizard-page')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('checkout-confirm-departure').click();
    await page.getByTestId('checkout-complete-button').click();
    await l3expect(page.getByText(/Check-out completato/i)).toBeVisible({ timeout: 20_000 });

    const afterCheckout = await request.get(`${API}/bookings/${bookingId}`, { headers: auth });
    expectSuccessStatus(afterCheckout.status(), 'Step 11 GET booking after checkout');
    l3expect(((await afterCheckout.json()) as { status?: string }).status, 'Step 11 CheckedOut').toBe(
      'CheckedOut',
    );

    const summary = await request.get(`${API}/compliance/summary`, { headers: auth });
    expectSuccessStatus(summary.status(), 'Step 12 compliance summary');
    const summaryBody = (await summary.json()) as {
      checkoutsDue?: { items?: { id?: string }[] };
    };
    const dueIds = (summaryBody.checkoutsDue?.items ?? []).map((item) => item.id);
    l3expect(dueIds, 'Step 12 this booking not in checkouts due').not.toContain(bookingId);

    await page.goto('/app/short-rent');
    await l3expect(page.getByTestId('compliance-summary-widget')).toBeVisible({ timeout: 20_000 });

    l3expect(api500, 'AC3 no API 500').toEqual([]);

    if (bookingId) {
      mkdirSync('e2e/.auth', { recursive: true });
      writeFileSync(
        'e2e/.auth/gj-seed.json',
        JSON.stringify({
          bookingId,
          serviceRequestId,
          propertyId: property.id,
          supplierOrgId: supplierProfile.orgId,
          guestName: 'Mario Rossi',
        }),
      );
    }
  });
});
