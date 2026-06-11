import type { Page } from '@playwright/test';
import type { PlanTier } from '../../src/types';
import type { SubscriptionStatus } from '../../src/types/billing.types';

export const DEFAULT_BILLING_PLANS = [
  {
    tier: 'Starter',
    displayName: 'Starter',
    priceMonthly: 29,
    currency: 'EUR',
    unitAllowance: 3,
    features: ['Fino a 3 proprietà', 'Supporto email'],
    stripePriceId: 'price_starter_test',
  },
  {
    tier: 'Pro',
    displayName: 'Pro',
    priceMonthly: 79,
    currency: 'EUR',
    unitAllowance: 50,
    features: ['Fino a 50 proprietà', 'Supporto prioritario'],
    stripePriceId: 'price_pro_test',
  },
  {
    tier: 'Scale',
    displayName: 'Scale',
    priceMonthly: 199,
    currency: 'EUR',
    unitAllowance: -1,
    features: ['Proprietà illimitate', 'Account manager'],
    stripePriceId: 'price_scale_test',
  },
] as const;

interface MockSubscriptionOptions {
  planTier?: PlanTier;
  status?: SubscriptionStatus;
  billingCountry?: string | null;
  vatId?: string | null;
  stripeCustomerId?: string | null;
  currentPeriodEnd?: string | null;
}

const DEFAULT_SUBSCRIPTION: Required<MockSubscriptionOptions> = {
  planTier: 'Pro',
  status: 'active',
  billingCountry: 'IT',
  vatId: '12345678901',
  stripeCustomerId: 'cus_test_1',
  currentPeriodEnd: '2026-07-11T00:00:00Z',
};

/** Mocks GET /api/billing/plans — Stripe catalogue for SaaS billing (#230, AC10). */
export async function mockBillingPlans(page: Page): Promise<void> {
  await page.route('**/api/billing/plans', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_BILLING_PLANS),
    });
  });
}

/** Mocks GET /api/billing/subscription (#230, AC11). */
export async function mockBillingSubscription(
  page: Page,
  options: MockSubscriptionOptions = {},
): Promise<void> {
  const body = { ...DEFAULT_SUBSCRIPTION, ...options, seats: 1 };

  await page.route('**/api/billing/subscription', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

/** Mocks POST /api/billing/checkout-session and captures payload (#230, AC10/AC12). */
export async function mockBillingCheckoutSession(
  page: Page,
  checkoutUrl = 'https://checkout.stripe.test/session_test',
): Promise<{ getLastPayload: () => Record<string, unknown> | null }> {
  let lastPayload: Record<string, unknown> | null = null;

  await page.route('**/api/billing/checkout-session', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    lastPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ checkoutUrl }),
    });
  });

  return {
    getLastPayload: () => lastPayload,
  };
}

/** Mocks POST /api/billing/portal-session (#230, AC11). */
export async function mockBillingPortalSession(
  page: Page,
  portalUrl = 'https://billing.stripe.test/portal_test',
): Promise<void> {
  await page.route('**/api/billing/portal-session', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ portalUrl }),
    });
  });
}
