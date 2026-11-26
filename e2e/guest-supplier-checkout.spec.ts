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
