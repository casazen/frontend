import { test, expect, type APIRequestContext } from '@playwright/test';
import { requireE2eCredentials } from '../helpers/env';
import { readAccessToken } from '../helpers/auth';

const API = process.env.E2E_LOCAL_API_URL ?? process.env.E2E_STAGING_API_URL ?? 'http://localhost:5000/api';

type Auth = Record<string, string>;

interface Candidate {
  propertyId: string;
  stayId: string;
  supplierOrgId: string;
}

/**
 * First property of the E2E user with a non-cancelled stay and an active cleaning supplier in its comune (seed data
 * of the environment), or null.
 */
async function findCandidate(request: APIRequestContext, auth: Auth): Promise<Candidate | null> {
  const properties = await request.get(`${API}/properties`, { headers: auth });
  expect(properties.status(), 'GET /properties').toBe(200);

  for (const property of (await properties.json()) as { id: string }[]) {
    const bookings = await request.get(`${API}/bookings?propertyId=${property.id}`, { headers: auth });
    if (bookings.status() !== 200) continue;
    const stay = ((await bookings.json()) as { id: string; status: string }[]).find((b) => b.status !== 'Cancelled');
    if (!stay) continue;

    const suppliers = await request.get(`${API}/suppliers?propertyId=${property.id}&category=cleaning`, { headers: auth });
    if (suppliers.status() !== 200) continue;
    const supplier = ((await suppliers.json()) as { items: { orgId: string }[] }).items[0];
    if (supplier) return { propertyId: property.id, stayId: stay.id, supplierOrgId: supplier.orgId };
  }
  return null;
}

/**
 * L3 — supplier requests against the real API (SU-07, decision D2, A4-33). In short-term rental a request is for a
 * stay: the API refuses one without `bookingId`, and a request sent from the web marketplace for a stay is the one the
 * booking detail and the app's booking screen (`GET /service-requests?bookingId=`) show.
 */
test.describe('L3 marketplace: supplier request for a stay', () => {
  test.skip(!process.env.E2E_LOCAL && !process.env.E2E_STAGING, 'Set E2E_LOCAL=1 or E2E_STAGING=1');
  test.setTimeout(180_000);

  let auth: Auth = {};

  test.beforeEach(async ({ page }) => {
    requireE2eCredentials();
    await page.goto('/app/short-rent/marketplace');
    await expect(page.getByTestId('marketplace-property-select')).toBeVisible({ timeout: 60_000 });
    const token = await readAccessToken(page);
    expect(token, 'access token of the E2E user').toBeTruthy();
    auth = { Authorization: `Bearer ${token}` };
  });

  test('AC: a short-rent request without a stay is refused with 422 service_request_booking_required', async ({ request }) => {
    const properties = await request.get(`${API}/properties`, { headers: auth });
    expect(properties.status()).toBe(200);
    const [property] = (await properties.json()) as { id: string }[];
    test.skip(!property, 'The E2E user has no property: seed one on the environment.');

    const refused = await request.post(`${API}/service-requests`, {
      headers: auth,
      data: { propertyId: property.id, supplierOrgId: '00000000-0000-0000-0000-000000000000', category: 'cleaning' },
    });

    expect(refused.status()).toBe(422);
    expect(((await refused.json()) as { code?: string }).code).toBe('service_request_booking_required');
  });

  test('AC: a request sent from the marketplace for a stay shows in the booking detail and in the app query', async ({
    page,
    request,
  }) => {
    const candidate = await findCandidate(request, auth);
    test.skip(
      !candidate,
      'Needs a property of the E2E user with a non-cancelled stay and an active cleaning supplier in its comune (seed).',
    );
    const { propertyId, stayId, supplierOrgId } = candidate!;

    await page.goto(`/app/short-rent/marketplace?propertyId=${propertyId}`);
    await page.getByTestId('marketplace-category-filter').selectOption('cleaning');
    await page.getByTestId(`marketplace-supplier-${supplierOrgId}`).click({ timeout: 30_000 });
    await page.getByTestId('marketplace-request-service-btn').click();
    await expect(page.getByTestId('submit-service-request')).toBeDisabled();
    await page.getByTestId('service-request-stay').selectOption(stayId);

    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/api/service-requests'),
    );
    await page.getByTestId('submit-service-request').click();
    const response = await created;
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { id: string; bookingId: string; rentalContext: string };
    expect(body.bookingId).toBe(stayId);
    expect(body.rentalContext).toBe('ShortRent');

    // Web: the booking detail lists the stay's requests.
    await page.goto(`/app/short-rent/bookings/${stayId}`);
    await expect(page.getByTestId(`service-request-${body.id}`)).toBeVisible({ timeout: 30_000 });

    // App: the booking screen asks the same list by stay.
    const appList = await request.get(`${API}/service-requests?bookingId=${stayId}&pageSize=50`, { headers: auth });
    expect(appList.status()).toBe(200);
    const items = ((await appList.json()) as { items: { id: string; bookingId: string }[] }).items;
    expect(items.find((i) => i.id === body.id)?.bookingId).toBe(stayId);
  });
});
