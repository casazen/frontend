import { expect, test } from '@playwright/test';

test('return from supplier card authentication verifies the order and removes the Stripe secret', async ({ page, baseURL }) => {
  test.slow();
  const token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
  const api = new URL('/api/public/guest-portal/' + token, baseURL).href;
  await page.route(new URL('/api/public/features', baseURL).href, route => route.fulfill({ json: { guestPortal: true } }));
  await page.route(api, route => route.fulfill({ json: {
    stay: { propertyName: 'Villa Test', checkIn: '2026-11-26', checkOut: '2026-11-28',
      bookingCode: 'PORTAL-TEST', guests: 2, status: 'confirmed', isDirect: true },
    branding: { name: 'Casa Test' }, language: 'en', features: { supplierServices: true },
  } }));
  await page.route(api + '/stay', route => route.fulfill({ json: { guide: {}, chatOpen: false } }));
  await page.route(api + '/host-extras?*', route => route.fulfill({ json: { offers: [], orders: [] } }));
  const order = { id: 'test-order', serviceName: 'Airport transfer', supplierName: 'Local Transfer', state: 'Quoted',
    stripeSandbox: true, totalCents: 1100, supplierPriceCents: 1000, commissionCents: 100,
    refundCents: 0, requestedFor: '2026-11-26T15:00:00Z' };
  await page.route(api + '/supplier-orders', route => route.fulfill({ json: {
    environment: 'stripe-sandbox', offers: [], orders: [order],
  } }));
  let reconciled = 0;
  await page.route(api + '/supplier-orders/test-order/reconcile', route => {
    expect(route.request().method()).toBe('POST');
    reconciled++;
    return route.fulfill({ json: { ...order, state: 'Authorized' } });
  });
  await page.goto('/s/' + token + '?page=supplier-orders&lang=en&supplierOrderReturn=test-order'
    + '&payment_intent=pi_test&payment_intent_client_secret=sandbox_test_secret&redirect_status=succeeded', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Local Transfer · Amount authorized')).toBeVisible({ timeout: 30000 });
  await expect(page).toHaveURL(new RegExp('/s/' + token + '\\?page=supplier-orders&lang=en$'));
  expect(reconciled).toBe(1);
});

test('a distant service may request a quote and requires consent to the quoted charge', async ({ page, baseURL }) => {
  test.slow();
  const token = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
  const api = new URL('/api/public/guest-portal/' + token, baseURL).href;
  const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  await page.route(new URL('/api/public/features', baseURL).href, route => route.fulfill({ json: { guestPortal: true } }));
  await page.route(api, route => route.fulfill({ json: {
    stay: { propertyName: 'Villa', checkIn: day(8), checkOut: day(16), bookingCode: 'TEST', guests: 2, status: 'confirmed', isDirect: true },
    branding: { name: 'Casa Test' }, language: 'en', features: { supplierServices: true },
  } }));
  await page.route(api + '/stay', route => route.fulfill({ json: { guide: {} } }));
  await page.route(api + '/host-extras?*', route => route.fulfill({ json: { offers: [], orders: [] } }));
  const offer = { id: 'boat', serviceName: 'Lake tour', supplierName: 'Boat trips', category: 'Tour', priceCents: null, commissionBasisPoints: 1000 };
  const order = { id: 'quote', state: 'Quoted', stripeSandbox: true, stripeDeferred: true, serviceName: 'Lake tour', supplierName: 'Boat trips',
    requestedFor: day(12) + 'T15:00:00Z', supplierPriceCents: 1000, commissionCents: 100, totalCents: 1100, refundCents: 0 };
  let quoted = false;
  await page.route(api + '/supplier-orders', route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON().requestedFor.slice(0, 10)).toBe(day(12));
      quoted = true;
      return route.fulfill({ json: { ...order, state: 'PendingQuote', totalCents: 0 } });
    }
    return route.fulfill({ json: { environment: 'stripe-sandbox', offers: [offer], orders: quoted ? [order] : [] } });
  });
  await page.goto('/s/' + token + '?page=supplier-orders&lang=en', { waitUntil: 'domcontentloaded' });
  await page.getByText(/Lake tour.*On request/i).click();
  const form = page.locator('details[open] form');
  await form.locator('[name="date"]').fill(day(12));
  await form.locator('[name="time"]').fill('16:00');
  await form.getByRole('button').click();
  const save = page.getByRole('button', { name: 'Save test card' });
  await expect(save).toBeDisabled();
  await page.getByRole('checkbox', { name: /single charge.*11.*Boat trips/i }).check();
  await expect(save).toBeEnabled();
  const posted = page.waitForRequest(request => request.url() === api + '/supplier-orders/quote/checkout' && request.method() === 'POST');
  await page.route(api + '/supplier-orders/quote/checkout', route => route.fulfill({ status: 409, json: {} }));
  await save.click();
  expect((await posted).postDataJSON()).toEqual({ totalCents: 1100, consentVersion: 'guest-service-order-off-session-v1' });
});
