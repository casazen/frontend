import type { Page, Route } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';
import { mockSupplierConsoleApi } from './helpers/supplier-console-mock';
import type { GuestSupplierOrder } from '../src/features/guest-portal/guest-supplier-order-model';

const token = 'e'.repeat(32);
const portal = '/api/public/guest-portal/' + token;
const offer = {
  id: 'esperienza-lago', serviceName: 'Escursione in barca', category: 'Esperienze',
  supplierName: 'Battelli Lago', summary: 'Giro del lago con guida', priceCents: null, commissionBasisPoints: 0,
};

async function enableGuestOrders(page: Page) {
  await page.route('**/api/public/features', route =>
    route.fulfill({ json: { guestPortal: true, guestPortalSupplierServices: true, supplierConsole: true } }));
}

test('a guest and supplier agree a quote and complete an experience in separate sessions', async ({ browser, baseURL, page: supplier }) => {
  test.setTimeout(120_000);
  const refresh = { timeout: 25_000 };
  const guestContext = await browser.newContext({ baseURL, locale: 'en-GB', viewport: { width: 390, height: 844 } });
  const guest = await guestContext.newPage();
  const orders: GuestSupplierOrder[] = [];
  const transitions: string[] = [];
  try {
    await enableGuestOrders(guest);
    await guest.route('**' + portal, route => route.fulfill({ json: {
      branding: { name: 'Casa Lago', logoUrl: null, primaryColor: null }, language: 'en', checkInCompleted: true,
      features: { supplierServices: true }, stay: { propertyName: 'Casa Lago', city: 'Como',
        checkIn: '2027-07-01', checkOut: '2027-07-05', bookingCode: 'DEMO', guests: 2, status: 'confirmed', isDirect: true, isOta: false },
    } }));
    await guest.route('**' + portal + '/stay', route => route.fulfill({ json: {
      guide: {}, address: 'Via Lago', houseRules: '', arrivalTime: null, checkInAvailable: false, canEditArrival: false,
    } }));
    await guest.route('**' + portal + '/host-extras**', route => route.fulfill({ json: { offers: [], orders: [] } }));
    await guest.route('**' + portal + '/supplier-orders', async route => {
      if (route.request().method() === 'GET') return route.fulfill({ json: { environment: 'Test', offers: [offer], orders } });
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ offerId: offer.id, requestedFor: '2027-07-02T10:00:00.000Z', note: 'Two guests' });
      expect(body.requestId).toBeTruthy();
      expect(orders).toHaveLength(0);
      orders.push({
        id: 'test-order', serviceName: offer.serviceName, supplierName: offer.supplierName, state: 'PendingQuote',
        requestedFor: body.requestedFor, completedAt: null, totalCents: 0, supplierPriceCents: 0, commissionCents: 0,
        refundCents: 0, hostOrigin: false, requestNote: body.note, complaint: null, supplierReply: null, decision: null,
      });
      transitions.push('request');
      return route.fulfill({ status: 201, json: orders[0] });
    });
    await guest.route('**' + portal + '/supplier-orders/test-order/authorize', route => {
      expect(route.request().method()).toBe('POST');
      expect(orders[0].state).toBe('Quoted');
      expect(route.request().postDataJSON()).toEqual({ totalCents: 5500 });
      orders[0].state = 'Authorized';
      transitions.push('authorize');
      return route.fulfill({ json: orders[0] });
    });

    await setDemoProfile(supplier, 'supplier');
    await mockSupplierConsoleApi(supplier, { active: true });
    await enableGuestOrders(supplier);
    await supplier.route('**/api/supplier/guest-orders', route => route.fulfill({ json: { offers: [], orders } }));
    await supplier.route('**/api/supplier/guest-orders/test-order/transition', (route: Route) => {
      const body = route.request().postDataJSON();
      expect(route.request().method()).toBe('POST');
      switch (body.action) {
        case 'quote':
          expect(orders[0].state).toBe('PendingQuote');
          expect(body.priceCents).toBe(5500);
          Object.assign(orders[0], { supplierPriceCents: 5500, totalCents: 5500, state: 'Quoted' });
          break;
        case 'accept':
          expect(orders[0].state).toBe('Authorized');
          orders[0].state = 'Accepted';
          break;
        case 'complete':
          expect(orders[0].state).toBe('Accepted');
          orders[0].state = 'Completed';
          break;
        default: throw new Error('Unexpected supplier action ' + body.action);
      }
      transitions.push(body.action);
      return route.fulfill({ json: orders[0] });
    });

    await supplier.goto(demoUrl('/app/supplier/inbox', 'supplier'));
    await expect(supplier.getByText('Nessun ordine.', { exact: true })).toBeVisible();
    await guest.goto('/s/' + token + '?lang=en');
    await guest.getByRole('link', { name: /Services and extras/ }).click();
    const details = guest.locator('details').filter({ hasText: offer.serviceName });
    const summary = details.locator('summary');
    await expect(summary).toContainText(/On request/);
    await expect(details.getByLabel('Date', { exact: true })).toBeHidden();
    await summary.click();
    await details.getByLabel('Date', { exact: true }).fill('2027-07-02');
    await details.getByLabel('Time in Italy').fill('12:00');
    await details.getByLabel('Notes for the supplier').fill('Two guests');
    await details.getByRole('button', { name: 'Request a quote' }).click();
    await expect(guest.getByRole('status')).toContainText('Request sent');
    await expect(guest.getByText(/Awaiting quote/)).toBeVisible();

    const supplierOrder = supplier.getByRole('article').filter({ hasText: offer.serviceName });
    await expect(supplierOrder).toContainText('Two guests', refresh);
    await supplierOrder.getByLabel('Prezzo in euro').fill('55');
    await supplierOrder.getByRole('button', { name: 'Invia preventivo' }).click();
    await expect(supplierOrder).toContainText('Da confermare');

    const guestOrder = guest.getByRole('article').filter({ hasText: offer.serviceName });
    await expect(guestOrder).toContainText('55', refresh);
    await guestOrder.getByRole('button', { name: 'Authorize simulated payment' }).click();
    await expect(guestOrder).toContainText('Amount authorized');

    await expect(supplierOrder.getByRole('button', { name: 'Accetta ordine' })).toBeVisible(refresh);
    await supplierOrder.getByRole('button', { name: 'Accetta ordine' }).click();
    await supplierOrder.getByRole('button', { name: 'Completa servizio' }).click();
    await expect(supplierOrder).toContainText('Servizio completato');
    await expect(guestOrder).toContainText('Service completed', refresh);
    await guest.reload();
    await expect(guestOrder).toContainText('Service completed');
    expect(transitions).toEqual(['request', 'quote', 'authorize', 'accept', 'complete']);
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await guestContext.close();
  }
});

test('a supplier shares a private PDF with the guest of a paid order', async ({ browser, page: supplier, baseURL }) => {
  test.setTimeout(120_000);
  const order = { id: 'paid-order', serviceName: offer.serviceName, supplierName: offer.supplierName,
    state: 'Accepted', stripeSandbox: true, requestedFor: '2027-07-02T10:00:00Z', totalCents: 5500,
    supplierPriceCents: 5500, commissionCents: 0, refundCents: 0, hostOrigin: false };
  const pdf = Buffer.from('%PDF-1.4\n% synthetic service receipt\n%%EOF', 'utf8');
  const file = { id: 'service-file', fileName: 'servizio.pdf', uploadedAt: '2027-07-02T10:00:00Z' };
  let uploaded = false;
  await setDemoProfile(supplier, 'supplier');
  await mockSupplierConsoleApi(supplier, { active: true });
  await enableGuestOrders(supplier);
  await supplier.route('**/api/supplier/guest-orders', route => route.fulfill({ json: { offers: [], orders: [order] } }));
  await supplier.route('**/api/supplier/guest-orders/paid-order/documents', route => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataBuffer()?.includes(pdf)).toBe(true);
      expect(route.request().postDataBuffer()?.includes(Buffer.from(file.fileName))).toBe(true);
      uploaded = true;
      return route.fulfill({ json: file });
    }
    return route.fulfill({ json: uploaded ? [file] : [] });
  });
  await supplier.goto(demoUrl('/app/supplier/inbox', 'supplier') + '#guest-order-paid-order', { waitUntil: 'domcontentloaded' });
  const card = supplier.locator('#guest-order-paid-order');
  await expect(card).toBeFocused();
  await card.locator('summary').click();
  await card.locator('input[type=file]').setInputFiles({ name: file.fileName, mimeType: 'application/pdf', buffer: pdf });
  await card.getByRole('button', { name: /Carica PDF|Upload PDF/ }).click();
  await expect(card.getByText(file.fileName)).toBeVisible();
  const guest = await browser.newContext({ baseURL, locale: 'en-GB' });
  try {
    const page = await guest.newPage();
    await enableGuestOrders(page);
    await page.route('**' + portal, route => route.fulfill({ json: {
      branding: { name: 'Casa Lago', logoUrl: null, primaryColor: null }, language: 'en', checkInCompleted: true,
      features: { supplierServices: true }, stay: { propertyName: 'Casa Lago', city: 'Como',
        checkIn: '2027-07-01', checkOut: '2027-07-05', bookingCode: 'DEMO', guests: 2, status: 'confirmed', isDirect: true, isOta: false },
    } }));
    await page.route('**' + portal + '/documents', route => route.fulfill({ json: [] }));
    await page.route('**' + portal + '/documents/invoice-data', route => route.fulfill({ json: { issued: true, invoiceRequested: false, hostManaged: false } }));
    await page.route('**' + portal + '/documents/supplier-services', route => route.fulfill({ json: [{ ...order, documents: uploaded ? [file] : [] }] }));
    await page.route('**' + portal + '/documents/supplier-services/service-file/pdf', route => route.fulfill({ contentType: 'application/pdf', body: pdf }));
    await page.goto('/s/' + token + '?lang=en&page=documents', { waitUntil: 'domcontentloaded' });
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: file.fileName }).click();
    expect((await download).suggestedFilename()).toBe(file.fileName);
  } finally {
    await guest.close();
  }
});
