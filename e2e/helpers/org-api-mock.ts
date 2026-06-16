import type { Page } from '@playwright/test';
import type { PlanTier, RentalType, UserRole } from '../../src/types';

const DEMO_ORG = {
  id: 'org-e2e-0001',
  name: 'Acme Stays',
  slug: 'acme-stays',
  planTier: 'Pro' as PlanTier,
};

function buildDemoMeBody(profile: string) {
  if (profile === 'onboarding') {
    return {
      id: 'auth0|demo-onboarding',
      email: 'demo@casazen.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'Guest' as UserRole,
      rentalType: null,
      isActive: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      // No onboardingCompletedAt for onboarding profile (#277)
      onboardingCompletedAt: null,
      orgId: null,
      org: null,
    };
  }

  const rentalType: RentalType =
    profile === 'long-term' ? 'LongTerm' : profile === 'dual' || profile === 'triple' ? 'Both' : 'ShortTerm';
  const role: UserRole =
    profile === 'admin' || profile === 'triple'
      ? 'Admin'
      : profile === 'long-term'
        ? 'LongTermLandlord'
        : 'PropertyOwner';

  return {
    id: 'auth0|demo-e2e',
    email: 'demo@casazen.com',
    firstName: 'Demo',
    lastName: 'User',
    role,
    rentalType,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    // Set onboardingCompletedAt for all completed profiles (#277)
    onboardingCompletedAt: '2026-01-01T00:00:00Z',
    orgId: DEMO_ORG.id,
    org: DEMO_ORG,
  };
}

/**
 * Default GET /api/users/me mock for demo-mode E2E (#217).
 * Resolves demo profile from the active page (query param or sessionStorage).
 * Tests that need a custom profile should register their own route afterward (last wins).
 */
export async function installDemoUserMeMock(page: Page): Promise<void> {
  await page.route('**/api/users/me', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    const profile = await page.evaluate(() => {
      const params = new URLSearchParams(window.location.search);
      const fromQuery = params.get('demoProfile');
      if (fromQuery) return fromQuery;
      const stored = sessionStorage.getItem('casazen:demo-profile');
      if (stored) return stored;
      return 'short-stay';
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildDemoMeBody(profile)),
    });
  });
}

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
        onboardingCompletedAt: '2026-01-01T00:00:00Z',
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

const DEFAULT_PLANS = [
  {
    tier: 'Starter',
    displayName: 'Starter',
    maxProperties: 3,
    description: 'Fino a 3 proprietà — ideale per iniziare.',
  },
  {
    tier: 'Pro',
    displayName: 'Pro',
    maxProperties: 50,
    description: 'Fino a 50 proprietà — per operatori in crescita.',
  },
  {
    tier: 'Scale',
    displayName: 'Scale',
    maxProperties: -1,
    description: 'Proprietà illimitate — per agenzie e PM.',
  },
];

/** Mocks GET /api/orgs/plans — plan catalogue for onboarding and settings. */
export async function mockPlansCatalog(page: Page): Promise<void> {
  await page.route('**/api/orgs/plans', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(DEFAULT_PLANS),
    });
  });
}

/** Mocks PUT /api/orgs/me/plan and returns updated entitlement. */
export async function mockUpdateMyPlan(page: Page): Promise<void> {
  await page.route('**/api/orgs/me/plan', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as { planTier?: PlanTier };
    const tier = payload.planTier ?? 'Starter';
    const maxProperties = tier === 'Pro' ? 50 : tier === 'Scale' ? 999999 : 3;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orgId: 'org-e2e-0001',
        planTier: tier,
        limits: { maxProperties },
        usage: { properties: 1 },
        canAddProperty: true,
      }),
    });
  });
}

/** Mocks PATCH /api/admin/orgs/{id}/plan for admin plan changes. */
export async function mockAdminUpdateOrgPlan(page: Page): Promise<void> {
  await page.route('**/api/admin/orgs/*/plan', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as { planTier?: PlanTier };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        orgId: 'org-target',
        planTier: payload.planTier ?? 'Pro',
        limits: { maxProperties: 50 },
        usage: { properties: 0 },
        canAddProperty: true,
      }),
    });
  });
}
