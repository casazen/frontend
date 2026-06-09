import type { Page } from '@playwright/test';
import type { PlanTier } from '../../src/types';

interface MockOrgOptions {
  name?: string;
  slug?: string;
  planTier?: PlanTier;
  orgId?: string;
}

/**
 * Mocks GET /api/users/me so the caller profile carries an Org (#202, AC9/AC11).
 * Non-GET verbs fall through. Register before navigation.
 */
export async function mockCurrentUserWithOrg(page: Page, options: MockOrgOptions = {}): Promise<void> {
  const org = {
    id: options.orgId ?? 'org-e2e-0001',
    name: options.name ?? 'Acme Stays',
    slug: options.slug ?? 'acme-stays',
    planTier: options.planTier ?? 'Pro',
  };

  await page.route('**/api/users/me', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'auth0|demo-e2e',
        email: 'demo@casazen.com',
        firstName: 'Demo',
        lastName: 'User',
        role: 'PropertyOwner',
        rentalType: 'ShortTerm',
        isActive: true,
        createdAt: '2026-01-01T00:00:00Z',
        phoneNumber: null,
        updatedAt: '2026-01-01T00:00:00Z',
        orgId: org.id,
        org,
      }),
    });
  });
}

interface MockEntitlementOptions {
  planTier?: PlanTier;
  maxProperties?: number;
  properties?: number;
  canAddProperty?: boolean;
  orgId?: string;
}

/** Mocks GET /api/orgs/me/entitlement (#202, AC8) — limits, usage, and create gating. */
export async function mockEntitlement(page: Page, options: MockEntitlementOptions = {}): Promise<void> {
  const maxProperties = options.maxProperties ?? 3;
  const properties = options.properties ?? maxProperties;

  const body = {
    orgId: options.orgId ?? 'org-e2e-0001',
    planTier: options.planTier ?? 'Starter',
    limits: { maxProperties },
    usage: { properties },
    canAddProperty: options.canAddProperty ?? properties < maxProperties,
  };

  await page.route('**/api/orgs/me/entitlement', async (route) => {
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
