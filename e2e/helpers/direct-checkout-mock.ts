import type { Page } from '@playwright/test';
import type { CheckoutOutcome, DirectBookingResponse } from '../../src/types';
import { addDays, todayInRome } from '../../src/lib/stay-dates';

/** A stay starting `daysAhead` days after today in Europe/Rome: fixed dates would end up in the past. */
export function futureStay(daysAhead = 30, nights = 3): { checkIn: string; checkOut: string } {
  const checkIn = addDays(todayInRome(), daysAhead);
  return { checkIn, checkOut: addDays(checkIn, nights) };
}

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
    checkoutToken: 'tok_e2e_checkout',
    ...overrides,
  };
}

/** Outcome of a checkout as `POST /api/public/bookings/{id}/outcome` answers it (BK-07). */
export function mockCheckoutOutcome(overrides?: Partial<CheckoutOutcome>): CheckoutOutcome {
  const { checkIn, checkOut } = futureStay(30, 3);
  return {
    bookingId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    state: 'Confirmed',
    paymentOption: 'Immediate',
    propertyId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    propertySlug: null,
    propertyName: 'Trastevere Suite',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    numberOfAdults: 2,
    numberOfChildren: 0,
    totalPrice: 650,
    currency: 'EUR',
    expiresAt: null,
    deferredChargeDate: null,
    ...overrides,
  };
}

export async function mockDirectCheckoutApi(page: Page): Promise<void> {
  // The outcome page reads the real state of the booking (BK-07): here the webhook has already confirmed it.
  await page.route('**/api/public/bookings/*/outcome', async (route) => {
    const bookingId = new URL(route.request().url()).pathname.split('/').slice(-2)[0];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockCheckoutOutcome({ bookingId })),
    });
  });

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
