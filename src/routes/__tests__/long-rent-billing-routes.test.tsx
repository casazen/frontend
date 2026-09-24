import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { BillingApi } from '@/api/billing.api';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { WorkspaceContextValue } from '@/contexts/workspace-context';
import * as userQueries from '@/queries/use-users';
import type { BillingPlan, BillingSubscription } from '@/types';

/**
 * PL-16 (A1-36) on the real route table: a landlord with only the long-rent context reaches the plan and billing pages
 * inside the long-rent shell, and an old short-rent plan link (e.g. a Stripe return page) brings it there. Auth0, the
 * onboarding guard and the workspace bootstrap are replaced by a signed-in, onboarded long-term landlord.
 */
const { workspaceContexts } = vi.hoisted(() => ({ workspaceContexts: { value: [] as ContextBootstrapDto[] } }));

vi.mock('@/components/auth/auth-provider-boundary', async () => {
  const { Outlet } = await import('react-router-dom');
  return { AuthProviderBoundary: () => <Outlet /> };
});
vi.mock('@/components/auth/protected-route', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/auth/onboarding-guard', async () => {
  const { Outlet } = await import('react-router-dom');
  return { OnboardingGuard: () => <Outlet /> };
});
vi.mock('@/contexts/workspace-provider', async () => {
  const { WorkspaceContext } = await import('@/contexts/workspace-context');
  function WorkspaceProvider({ children }: { children: ReactNode }) {
    const contexts = workspaceContexts.value;
    const value: WorkspaceContextValue = {
      contexts,
      activeContext: contexts[0]?.contextKey ?? null,
      isReady: true,
      setActiveContext: () => undefined,
      hasPermission: () => true,
      getDefaultRoute: (contextKey) => contexts.find((c) => c.contextKey === contextKey)?.defaultRoute ?? '/app',
    };
    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
  }
  return { WorkspaceProvider };
});
// The shells are replaced by markers: the test is about which shell hosts the page, not about the menus.
vi.mock('@/components/layout/long-term-app-shell', async () => {
  const { Outlet } = await import('react-router-dom');
  return {
    LongTermAppShell: ({ children }: { children?: ReactNode }) => (
      <div data-testid="long-rent-shell">{children ?? <Outlet />}</div>
    ),
  };
});
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="short-rent-shell">{children}</div>,
}));
vi.mock('@/api/billing.api', () => ({
  BillingApi: {
    getPlans: vi.fn(),
    getSubscription: vi.fn(),
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    updateProfile: vi.fn(),
  },
}));
vi.mock('@/queries/use-users', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/queries/use-users')>();
  return { ...actual, useCurrentUser: vi.fn(), useEntitlement: vi.fn() };
});

import { appRoutes } from '@/routes';

const plans: BillingPlan[] = [
  { tier: 'Starter', displayName: 'Starter', priceMonthly: 0, currency: 'EUR', unitAllowance: 3, features: [], purchasable: true },
  { tier: 'Pro', displayName: 'Pro', priceMonthly: 0, currency: 'EUR', unitAllowance: 50, features: [], purchasable: true },
];

const noSubscription: BillingSubscription = {
  planTier: 'Starter',
  status: 'none',
  currentPeriodEnd: null,
  seats: 1,
  billingCountry: null,
  vatId: null,
};

const longRentContext: ContextBootstrapDto = {
  contextKey: 'long-rent',
  displayName: 'Affitti lungo termine',
  roleKey: 'long_term_landlord',
  permissions: ['property.read', 'property.write', 'lease.read', 'lease.create'],
  defaultRoute: '/app/long-rent/leases',
};

function renderApp(entry: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [entry] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('plan and billing pages from the long-rent shell (PL-16)', () => {
  beforeEach(() => {
    workspaceContexts.value = [longRentContext];
    vi.mocked(userQueries.useCurrentUser).mockReturnValue({
      user: { orgId: 'org-1' },
      org: { id: 'org-1', name: 'Locazioni Rossi', slug: 'locazioni-rossi', planTier: 'Starter' },
      planTier: 'Starter',
      isLoading: false,
    } as unknown as ReturnType<typeof userQueries.useCurrentUser>);
    vi.mocked(userQueries.useEntitlement).mockReturnValue({
      data: { orgId: 'org-1', planTier: 'Starter', limits: { maxProperties: 3 }, usage: { properties: 1 }, canAddProperty: true },
    } as unknown as ReturnType<typeof userQueries.useEntitlement>);
    vi.mocked(BillingApi.getPlans).mockResolvedValue(plans);
    vi.mocked(BillingApi.getSubscription).mockResolvedValue(noSubscription);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('LongRentPlanPage_LandlordWithOnlyLongRent_ShowsThePlansInTheLongRentShell', async () => {
    const router = renderApp('/app/long-rent/settings/plan');

    const grid = await screen.findByTestId('billing-plans-grid');
    expect(within(screen.getByTestId('long-rent-shell')).getByTestId('billing-plans-grid')).toBe(grid);
    expect(screen.queryByTestId('short-rent-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billing-admin-required')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/app/long-rent/settings/plan');
    expect(BillingApi.getPlans).toHaveBeenCalled();
  });

  it('LongRentBillingPage_LandlordWithOnlyLongRent_ShowsTheSubscriptionInTheLongRentShell', async () => {
    renderApp('/app/long-rent/settings/billing');

    const empty = await screen.findByTestId('subscription-empty');
    expect(within(screen.getByTestId('long-rent-shell')).getByTestId('subscription-empty')).toBe(empty);
    expect(screen.queryByTestId('short-rent-shell')).not.toBeInTheDocument();
    expect(within(empty).getByRole('link', { name: i18n.t('billing.settings.choosePlan') })).toHaveAttribute(
      'href',
      '/app/long-rent/settings/plan',
    );
  });

  it('ShortRentPlanReturnPage_LandlordWithOnlyLongRent_LandsOnTheLongRentPlanPageWithTheOutcome', async () => {
    const router = renderApp('/app/short-rent/settings/plan?checkout=cancel');

    expect(await screen.findByTestId('checkout-return-canceled')).toHaveTextContent(
      i18n.t('billing.checkout.return.canceled'),
    );
    expect(router.state.location.pathname).toBe('/app/long-rent/settings/plan');
    expect(screen.getByTestId('long-rent-shell')).toBeInTheDocument();
  });
});
