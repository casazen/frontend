import type { Page } from '@playwright/test';
import type { Booking, PaymentLedgerBooking } from '../src/types';
import { expect, test } from './test';
import { bookingId, mockArrivalJourney, property } from './helpers/arrival-journey';
import { demoUrl } from './helpers/demo-profile';

async function mockPaidStay(page: Page) {
  await mockArrivalJourney(page);
  const booking: Booking = {
    id: bookingId, bookingCode: 'TEST-CHF', propertyId: property.id, propertyName: property.name,
    guest: { firstName: 'Ospite', lastName: 'Demo', email: '', phone: '', country: '' },
    userId: 'demo-host', numberOfGuests: 2, status: 'Confirmed', source: 'Direct',
    checkInDate: '2026-11-29', checkOutDate: '2026-12-01', createdAt: '2026-11-26', updatedAt: '2026-11-26',
    basePrice: 194, totalPrice: 194, paidAmount: 194, touristTax: 0, cleaningFee: 0, currency: 'CHF',
    paymentState: 'Paid', amountSources: { paid: 'Stripe', total: 'Stripe' },
  };
  const ledger: PaymentLedgerBooking = {
    bookingId, bookingCode: 'TEST-CHF', currency: 'CHF', channel: 'Direct', degraded: false,
    lines: [{
      bookingId, bookingCode: 'TEST-CHF', paymentId: 'test-card', date: '2026-11-26', kind: 'Card',
      gross: 194, providerFee: 6.61, net: 187.39, creditDate: '2026-11-28', currency: 'CHF', collectedBy: 'Platform', state: 'Paid',
    }],
  };
  await page.route('**/api/public/features', (route) => route.fulfill({ json: { fiscalDocumentIssuance: true } }));
  await page.route(`**/api/bookings/${bookingId}`, (route) => route.fulfill({ json: booking }));
  await page.route(`**/api/payment-ledger/bookings/${bookingId}`, (route) => route.fulfill({ json: ledger }));
  await page.route(`**/api/bookings/${bookingId}/fiscal-documents`, (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/bookings/${bookingId}/invoice-data`, (route) => route.fulfill({ json: { bookingId, invoiceRequested: false } }));
}

for (const width of [390, 1440]) {
  test(`paid CHF stay shows collection, settlement and fiscal actions at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mockPaidStay(page);
    await page.goto(demoUrl(`/app/short-rent/bookings/${bookingId}?tab=payment`, 'short-stay'));
    const tab = page.getByRole('main');
    await expect(tab.getByTestId('booking-payment-state')).toHaveAttribute('data-state', 'Paid');
    await expect(tab.getByTestId('booking-paid-amount')).toContainText(/194,00\s*CHF/);
    await expect(tab.getByTestId('booking-price-total')).toContainText(/194,00\s*CHF/);
    await expect(tab.getByTestId('booking-price-per-night')).toContainText(/97,00\s*CHF/);
    await expect(tab.getByTestId('booking-record-payment')).toHaveCount(0);
    await expect(tab.getByTestId('booking-amount-source')).toHaveCount(1);
    await expect(tab.getByTestId('booking-amount-source')).toHaveAttribute('data-source', 'Stripe');
    const ledger = tab.getByTestId('booking-payment-ledger');
    await expect(ledger.getByTestId('payment-ledger-fee').filter({ visible: true })).toContainText(/6,61/);
    await expect(ledger.getByTestId('payment-ledger-net').filter({ visible: true })).toContainText(/187,39/);
    await expect(ledger.getByTestId('payment-ledger-credit').filter({ visible: true })).toContainText('28');
    await expect(tab.getByTestId('booking-fiscal-document-create')).toBeVisible();
    await expect(tab.getByTestId('booking-invoice-open')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    const screenshot = testInfo.outputPath('payment-overview.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('payment-overview', { path: screenshot, contentType: 'image/png' });
    await tab.getByTestId('booking-invoice-open').click();
    await expect(tab.getByTestId('invoice-data-name')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const [code, step] of [
  ['issuer_profile_incomplete', 'issuer'],
  ['document_rule_not_configured', 'vat'],
]) {
  test(`blocked fiscal draft leads to the relevant setup step for ${code}`, async ({ page }) => {
    await mockPaidStay(page);
    await page.route('**/api/fiscal/documents', (route) => route.fulfill({
      status: 422, contentType: 'application/problem+json', json: { status: 422, code },
    }));
    await page.goto(demoUrl(`/app/short-rent/bookings/${bookingId}?tab=payment`, 'short-stay'));
    await page.getByTestId('booking-fiscal-document-create').click();
    const settings = page.getByTestId('booking-fiscal-document-blocker').getByRole('link');
    await expect(settings).toHaveAttribute('href', `/app/short-rent/fiscal/setup?step=${step}`);
  });
}

test('missing invoice recipient opens the in-place editor from a blocked draft', async ({ page }) => {
  await mockPaidStay(page);
  await page.route('**/api/fiscal/documents', (route) => route.fulfill({
    status: 422, contentType: 'application/problem+json', json: { status: 422, code: 'document_invoice_data_missing' },
  }));
  await page.goto(demoUrl(`/app/short-rent/bookings/${bookingId}?tab=payment`, 'short-stay'));
  await page.getByTestId('booking-fiscal-document-create').click();
  await page.getByTestId('booking-fiscal-document-blocker').getByRole('button').click();
  await expect(page.getByTestId('invoice-data-name')).toBeVisible();
  await expect(page).toHaveURL(/tab=payment/);
});
