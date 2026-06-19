import type { Page } from '@playwright/test';
import type { DirectBookingResponse } from '../../src/types';

export const DIRECT_CHECKOUT_CONSENT_VERSION = '2026-06-direct-checkout-v1';

export function mockDirectBookingResponse(overrides?: Partial<DirectBookingResponse>): DirectBookingResponse {
  return {
    bookingId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    clientSecret: 'pi_test_secret_direct',
    connectedAccountPublishableContext: {
      publishableKey: 'pk_test_demo',
      stripeAccountId: 'acct_test_demo',
    },
    amount: 650,
    currency: 'EUR',
    touristTaxAmount: 8,
    basePrice: 642,
    paymentOption: 'Immediate',
    freeRefundDeadline: '2026-06-24T00:00:00Z',
    ...overrides,
  };
}

export async function mockDirectCheckoutApi(page: Page): Promise<void> {
  await page.route('**/api/public/bookings', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    const authHeader = route.request().headers()['authorization'];
    if (authHeader) {
      await route.fulfill({ status: 401, body: '{}' });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockDirectBookingResponse()),
    });
  });
}
