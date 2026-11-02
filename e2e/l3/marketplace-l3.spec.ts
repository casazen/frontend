import { test, expect, type APIRequestContext } from '@playwright/test';
import { isLocalApi, requireE2eCredentials } from '../helpers/env';
import { readAccessToken } from '../helpers/auth';

const API = process.env.E2E_LOCAL_API_URL ?? process.env.E2E_STAGING_API_URL ?? 'http://localhost:5000/api';

/**
 * The test that writes (a request, then its cancellation) runs on a local API only: the cancellation e-mails and pushes the host, and on the
 * shared test environment that is the person who owns the test account, at every push to develop and every night.
 */
const LOCAL_API = isLocalApi(API);

type Auth = Record<string, string>;

interface Stay {
  id: string;
  status: string;
}

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
    // GET /bookings is paged ({ items, totalCount, ... }) since backend #468; accept the old bare array too.
    const body = (await bookings.json()) as Stay[] | { items: Stay[] };
    const stay = (Array.isArray(body) ? body : body.items).find((b) => b.status !== 'Cancelled');
    if (!stay) continue;

    const suppliers = await request.get(`${API}/suppliers?propertyId=${property.id}&category=cleaning`, { headers: auth });
    if (suppliers.status() !== 200) continue;
    const supplier = ((await suppliers.json()) as { items: { orgId: string }[] }).items[0];
    if (supplier) return { propertyId: property.id, stayId: stay.id, supplierOrgId: supplier.orgId };
  }
  return null;
}

/**
 * L3 — supplier requests against the real API (SU-07, decision D2, A4-33). In short-term rental a request is for the
 * property and, when the host names one, a stay (the stay is optional since SR-08a, decision SR-D3); a request sent from the
 * web marketplace for a stay is the one the booking detail and the app's booking screen (`GET /service-requests?bookingId=`) show.
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

  test('AC: a short-rent request without a stay is no longer refused for it: it goes on to the supplier lookup', async ({ request }) => {
    const properties = await request.get(`${API}/properties`, { headers: auth });
    expect(properties.status()).toBe(200);
    const [property] = (await properties.json()) as { id: string }[];
    test.skip(!property, 'The E2E user has no property: seed one on the environment.');

    // An empty supplier id is 400 validation_error (NotEmptyGuid). A non-empty id that is nobody's, with no bookingId, is
    // otherwise well formed: the missing stay is no reason to refuse (it was 422 service_request_booking_required before
    // SR-08a), so the request goes on to the supplier lookup and nothing is created.
    const refused = await request.post(`${API}/service-requests`, {
      headers: auth,
      data: { propertyId: property.id, supplierOrgId: '11111111-1111-1111-1111-111111111111', category: 'cleaning' },
    });

    expect(refused.status()).toBe(404);
    expect(((await refused.json()) as { code?: string }).code).toBe('supplier_not_found');
  });

  test('AC: a request sent from the marketplace for a stay shows in the booking detail and in the app query', async ({
    page,
    request,
  }) => {
    test.skip(
      !LOCAL_API,
      'Creates and cancels a real request, and the cancellation e-mails the host: it runs on a local API only (E2E_LOCAL=1).',
    );
    const candidate = await findCandidate(request, auth);
    test.skip(
      !candidate,
      'Needs a property of the E2E user with a non-cancelled stay and an active cleaning supplier in its comune (seed).',
    );
    const { propertyId, stayId, supplierOrgId } = candidate!;

    // The environment is long-lived and the request of a regular host is accepted at once: the job an earlier run left would overlap
    // this one (409 supplier_commitment_conflict). So each run asks for an hour of its own (12:00 to 19:00, two hours long) and cancels
    // its request at the end.
    const startTime = `${String(12 + (Date.now() % 8)).padStart(2, '0')}:00`;

    // The suppliers of the category have a page of their own (MKT): the category in the address, the property chosen.
    await page.goto(`/app/short-rent/marketplace/categories/cleaning?propertyId=${propertyId}`);
    await page.getByTestId(`marketplace-supplier-${supplierOrgId}`).click({ timeout: 30_000 });
    await page.getByTestId('marketplace-request-service-btn').click();
    // «Richiedi fornitore» opens the guided request on its details: the property, the kind of work and the supplier are known.
    await expect(page.getByTestId('request-wizard')).toHaveAttribute('data-step', 'details', { timeout: 30_000 });
    // The time and the length are the host's own (a service of the catalog would go with one of its slots instead), and the stay is a link.
    await page.getByTestId('request-service-custom').check({ force: true });
    await page.getByTestId('request-stay').selectOption(stayId);
    await page.getByTestId('request-start-time').fill(startTime);
    await page.getByTestId('request-duration').selectOption('120');
    await page.getByTestId('request-next').click();
    await expect(page.getByTestId('request-supplier-sees')).toBeVisible();

    const created = page.waitForResponse(
      (r) => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/api/service-requests'),
    );
    await page.getByTestId('request-finish').click();
    const response = await created;
    expect(response.status()).toBe(201);
    const body = (await response.json()) as { id: string; bookingId: string; rentalContext: string };

    try {
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
    } finally {
      // The supplier's agenda goes back as it was, also when an assertion above failed: the next run asks for the same stay.
      const cancelled = await request.post(`${API}/service-requests/${body.id}/cancel`, {
        headers: auth,
        data: { reason: 'E2E cleanup' },
      });
      if (!cancelled.ok()) {
        test.info().annotations.push({ type: 'cleanup-failed', description: `cancelling ${body.id} answered ${cancelled.status()}` });
      }
    }
  });
});
