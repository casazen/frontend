import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { RouterProvider, createMemoryRouter, matchPath } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { ContextBootstrapDto } from '@/api/contexts';
import type { WorkspaceContextValue } from '@/contexts/workspace-context';
import { ROUTE_MANIFEST, type AppContextKey, type RouteManifestEntry } from '@/config/route-manifest';

/**
 * UI-00 on the real route table (`appRoutes`): the bare address of an area opens the home of the area. Auth0, the
 * onboarding guard, the workspace bootstrap, the shell and the pages are replaced; the route table and the guard of the
 * manifest routes are the real ones.
 */
const workspaceState = vi.hoisted(() => ({ contexts: [] as ContextBootstrapDto[], isReady: true }));

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
    const { contexts, isReady } = workspaceState;
    const value: WorkspaceContextValue = {
      contexts,
      activeContext: contexts[0]?.contextKey ?? null,
      isReady,
      setActiveContext: () => undefined,
      hasPermission: (contextKey, permission) => {
        const context = contexts.find((c) => c.contextKey === contextKey);
        if (!context) return false;
        return !permission || context.permissions.includes(permission);
      },
      getDefaultRoute: (contextKey) => contexts.find((c) => c.contextKey === contextKey)?.defaultRoute ?? '/app',
    };
    return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
  }
  return { WorkspaceProvider };
});
// The shell and the pages are not under test: the route tree around them is.
vi.mock('@/components/layout/context-layout', async () => {
  const { Outlet } = await import('react-router-dom');
  return { ContextLayout: () => <Outlet /> };
});
vi.mock('@/routes/manifest-route', () => ({
  ManifestRoute: ({ entry }: { entry: RouteManifestEntry }) => <p data-testid="page" data-path={entry.path} />,
}));
vi.mock('@/pages/no-access-page', () => ({ NoAccessPage: () => <p data-testid="no-access" /> }));

import { appRoutes } from '@/routes';

const LONG_RENT_PERMISSIONS = ['property.read', 'property.write', 'lease.read', 'lease.create', 'lease.sign', 'lease.register'];

function context(contextKey: AppContextKey, permissions: string[], defaultRoute: string): ContextBootstrapDto {
  return { contextKey, displayName: contextKey, roleKey: contextKey, permissions, defaultRoute };
}

const shortRent = context('short-rent', ['property.read', 'booking.read'], '/app/short-rent');
const longRent = context('long-rent', LONG_RENT_PERMISSIONS, '/app/long-rent/leases');
const admin = context('admin', ['admin.stats.read', 'admin.users.read'], '/app/admin');
// The backend still sends the old address of the supplier console as its default route.
const supplier = context('supplier', ['supplier.inbox.read'], '/supplier/inbox');

function renderApp(entry: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [entry] });
  render(<RouterProvider router={router} />);
  return router;
}

function address(router: ReturnType<typeof renderApp>): string {
  const { pathname, search, hash } = router.state.location;
  return `${pathname}${search}${hash}`;
}

describe('the bare address of an area opens its home (UI-00)', () => {
  beforeEach(async () => {
    workspaceState.contexts = [shortRent, longRent, admin, supplier];
    workspaceState.isReady = true;
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('LongRentIndex_LandlordOpensTheArea_OpensTheContracts', async () => {
    const router = renderApp('/app/long-rent');

    await waitFor(() => expect(address(router)).toBe('/app/long-rent/leases'));
    expect(screen.getByTestId('page')).toHaveAttribute('data-path', '/app/long-rent/leases');
  });

  it('SupplierIndex_SupplierOpensTheArea_OpensTheDashboard', async () => {
    const router = renderApp('/app/supplier');

    await waitFor(() => expect(address(router)).toBe('/app/supplier/dashboard'));
    expect(screen.getByTestId('page')).toHaveAttribute('data-path', '/app/supplier/dashboard');
  });

  it('AreaIndex_TrailingSlash_OpensTheHomeToo', async () => {
    const router = renderApp('/app/supplier/');

    await waitFor(() => expect(address(router)).toBe('/app/supplier/dashboard'));
  });

  it('AreaIndex_AddressWithQueryAndFragment_KeepsBoth', async () => {
    const router = renderApp('/app/long-rent?checkout=success#x');

    await waitFor(() => expect(address(router)).toBe('/app/long-rent/leases?checkout=success#x'));
  });

  it('LongRentIndex_RoleWithoutLeasePermission_OpensThePageTheUserCanOpen', async () => {
    workspaceState.contexts = [context('long-rent', ['property.read', 'property.write'], '/app/long-rent/leases')];
    const router = renderApp('/app/long-rent');

    await waitFor(() => expect(address(router)).toBe('/app/long-rent/properties'));
  });

  it('AreaIndex_UserNotInTheArea_GoesToTheHomeOfHisOwnArea', async () => {
    // Not an empty long-rent shell: the area of the user (its backend default route is the old supplier address, which
    // the route table sends on to the canonical one).
    workspaceState.contexts = [supplier];
    const router = renderApp('/app/long-rent');

    await waitFor(() => expect(address(router)).toBe('/app/supplier/inbox'));
    expect(screen.getByTestId('page')).toHaveAttribute('data-path', '/app/supplier/inbox');
  });

  it('AreaIndex_UserWithNoArea_GoesToNoAccess', async () => {
    workspaceState.contexts = [];
    const router = renderApp('/app/supplier');

    expect(await screen.findByTestId('no-access')).toBeInTheDocument();
    expect(address(router)).toBe('/app/no-access');
  });

  it('AreaIndex_WorkspaceStillLoading_WaitsInsteadOfRedirecting', async () => {
    workspaceState.isReady = false;
    const router = renderApp('/app/long-rent');

    expect(await screen.findByText(i18n.t('shared.auth.loadingWorkspace'))).toBeInTheDocument();
    expect(address(router)).toBe('/app/long-rent');
    expect(screen.queryByTestId('page')).not.toBeInTheDocument();
  });

  it.each(['short-rent', 'admin'] as const)(
    'AreaRoot_%s_KeepsItsOwnPageAtTheBareAddress',
    async (contextKey) => {
      const router = renderApp(`/app/${contextKey}`);

      expect(await screen.findByTestId('page')).toHaveAttribute('data-path', `/app/${contextKey}`);
      expect(address(router)).toBe(`/app/${contextKey}`);
    },
  );

  it.each(['short-rent', 'long-rent', 'admin', 'supplier'] as const)(
    'AreaAddress_%s_AlwaysEndsOnAPageOfThatArea',
    async (contextKey) => {
      const router = renderApp(`/app/${contextKey}`);

      const page = await screen.findByTestId('page');
      const path = page.getAttribute('data-path') ?? '';
      const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === path);
      expect(entry?.context).toBe(contextKey);
      expect(matchPath({ path, end: true }, router.state.location.pathname)).not.toBeNull();
    },
  );
});
