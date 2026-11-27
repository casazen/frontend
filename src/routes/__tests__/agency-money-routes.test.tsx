import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ContextBootstrapDto } from '@/api/contexts';
import { ContextRouteGuard } from '@/components/auth/context-route-guard';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { useWorkspace } from '@/hooks/use-workspace';
import { LegacyRedirect } from '../legacy-redirect';

// Auth0 is out of the picture: a workspace with contexts never asks for a re-login.
vi.mock('@/hooks/use-empty-workspace-recovery', () => ({ useEmptyWorkspaceRecovery: () => false }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: vi.fn() }));

const account: ContextBootstrapDto = {
  contextKey: 'account',
  displayName: 'Amministrazione',
  roleKey: 'org_owner',
  permissions: ['org.members.manage'],
  defaultRoute: '/app/account',
};
const shortRent: ContextBootstrapDto = {
  contextKey: 'short-rent',
  displayName: 'Affitti brevi',
  roleKey: 'property_owner',
  permissions: ['property.read'],
  defaultRoute: '/app/short-rent',
};

function arrange(contexts: ContextBootstrapDto[]) {
  vi.mocked(useWorkspace).mockReturnValue({
    contexts,
    activeContext: contexts[0]?.contextKey ?? null,
    isReady: true,
    setActiveContext: vi.fn(),
    hasPermission: () => true,
    getDefaultRoute: (contextKey) => contexts.find((context) => context.contextKey === contextKey)?.defaultRoute ?? '/app',
  });
}

function Address() {
  const { pathname, search } = useLocation();
  return <p data-testid="address">{`${pathname}${search}`}</p>;
}

/** The routes as the app builds them: the page of the manifest behind its guard (permissions and flag), the old address as a legacy redirect. */
function renderApp(entry: string, flags: { agencyTier: boolean; isLoading?: boolean }) {
  const page = ROUTE_MANIFEST.find((candidate) => candidate.path === '/app/account/statements');
  if (!page) throw new Error('the statements are not in the manifest');
  return render(
    <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, agencyTier: flags.agencyTier }, isLoading: flags.isLoading ?? false }}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/app/admin/statements" element={<LegacyRedirect />} />
          <Route path="/app/account" element={<p>account home</p>} />
          <Route
            path="/app/account/statements"
            element={
              <ContextRouteGuard contextKey="account" requiredPermissions={page.requiredPermissions} featureFlag={page.featureFlag}>
                <p>statements page</p>
              </ContextRouteGuard>
            }
          />
          <Route path="/app/short-rent" element={<p>short-rent home</p>} />
        </Routes>
        <Address />
      </MemoryRouter>
    </FeatureFlagsContext.Provider>,
  );
}

describe('the statements of the agency are reachable from the Amministrazione (E06/F05/US01/T02)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrange([account]);
  });
  afterEach(() => cleanup());

  it('AgencyStatementsRoute_PlanOn_OpensThePage', () => {
    renderApp('/app/account/statements', { agencyTier: true });

    expect(screen.getByText('statements page')).toBeInTheDocument();
  });

  it('AgencyStatementsRoute_OldStaffAddress_OpensTheNewPage', () => {
    renderApp('/app/admin/statements', { agencyTier: true });

    expect(screen.getByTestId('address')).toHaveTextContent('/app/account/statements');
    expect(screen.getByText('statements page')).toBeInTheDocument();
  });

  it('AgencyStatementsRoute_PlanOff_NoPageAndTheAddressGoesToTheHomeOfTheArea', () => {
    renderApp('/app/account/statements', { agencyTier: false });

    expect(screen.queryByText('statements page')).not.toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('/app/account');
    expect(screen.getByText('account home')).toBeInTheDocument();
  });

  it('AgencyStatementsRoute_OldStaffAddressWithPlanOff_AlsoEndsAtTheHomeOfTheArea', () => {
    renderApp('/app/admin/statements', { agencyTier: false });

    expect(screen.queryByText('statements page')).not.toBeInTheDocument();
    expect(screen.getByTestId('address')).toHaveTextContent('/app/account');
  });

  it('AgencyStatementsRoute_FlagsStillLoading_WaitsBeforeDeciding', () => {
    renderApp('/app/account/statements', { agencyTier: false, isLoading: true });

    expect(screen.queryByText('statements page')).not.toBeInTheDocument();
    expect(screen.queryByText('account home')).not.toBeInTheDocument();
  });

  it('AgencyStatementsRoute_OldStaffAddressWithoutTheAccountArea_GoesToTheHomeOfTheContextTheUserHas', () => {
    arrange([shortRent]);
    renderApp('/app/admin/statements', { agencyTier: true });

    expect(screen.getByTestId('address')).toHaveTextContent('/app/short-rent');
    expect(screen.queryByText('statements page')).not.toBeInTheDocument();
  });
});
