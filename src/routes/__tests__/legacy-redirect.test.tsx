import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { ContextBootstrapDto } from '@/api/contexts';
import { WorkspaceContext, type WorkspaceContextValue } from '@/contexts/workspace-context';
import { LegacyRedirect } from '../legacy-redirect';

// Auth0 is out of the picture: a workspace with contexts never asks for a re-login.
vi.mock('@/hooks/use-empty-workspace-recovery', () => ({ useEmptyWorkspaceRecovery: () => false }));

const shortRent: ContextBootstrapDto = {
  contextKey: 'short-rent',
  displayName: 'Affitti brevi',
  roleKey: 'property_owner',
  permissions: ['property.read', 'booking.read'],
  defaultRoute: '/app/short-rent',
};

const longRent: ContextBootstrapDto = {
  contextKey: 'long-rent',
  displayName: 'Affitti lungo termine',
  roleKey: 'long_term_landlord',
  permissions: ['lease.read'],
  defaultRoute: '/app/long-rent/leases',
};

function workspaceOf(contexts: ContextBootstrapDto[], isReady = true): WorkspaceContextValue {
  return {
    contexts,
    activeContext: contexts[0]?.contextKey ?? null,
    isReady,
    setActiveContext: () => undefined,
    hasPermission: () => true,
    getDefaultRoute: (contextKey) => contexts.find((context) => context.contextKey === contextKey)?.defaultRoute ?? '/app',
  };
}

/** Where the redirect ends up: path, query and fragment, exactly as in the address bar. */
function CurrentAddress() {
  const { pathname, search, hash } = useLocation();
  return <p data-testid="address">{`${pathname}${search}${hash}`}</p>;
}

/** The two kinds of route of the app: the canonical `/app/...` pages and the old root-level addresses. */
function renderAt(entry: string, workspace: WorkspaceContextValue) {
  render(
    <WorkspaceContext.Provider value={workspace}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/app/*" element={<CurrentAddress />} />
          <Route path="*" element={<LegacyRedirect />} />
        </Routes>
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

describe('LegacyRedirect keeps the query string and the fragment (UI-00)', () => {
  afterEach(() => {
    cleanup();
  });

  it('LegacyRedirect_LegacyPathWithQueryAndFragment_KeepsBoth', () => {
    // The Stripe return pages and the links of the emails reach the console through an old address.
    renderAt('/bookings/abc?checkout=success&view=requests#x', workspaceOf([shortRent]));

    expect(screen.getByTestId('address')).toHaveTextContent('/app/short-rent/bookings/abc?checkout=success&view=requests#x');
  });

  it('LegacyRedirect_LegacyPathWithQueryOnly_KeepsTheQuery', () => {
    renderAt('/properties?stripe_return=1', workspaceOf([shortRent]));

    expect(screen.getByTestId('address')).toHaveTextContent('/app/short-rent/properties?stripe_return=1');
  });

  it('LegacyRedirect_LegacyPathWithFragmentOnly_KeepsTheFragment', () => {
    renderAt('/leases/abc#questura-panel', workspaceOf([longRent]));

    expect(screen.getByTestId('address')).toHaveTextContent('/app/long-rent/leases/abc#questura-panel');
  });

  it('LegacyRedirect_LegacyPathWithParameters_FillsTheParametersAndKeepsTheQuery', () => {
    renderAt('/bookings/abc/edit?tab=guests', workspaceOf([shortRent]));

    expect(screen.getByTestId('address')).toHaveTextContent('/app/short-rent/bookings/abc/edit?tab=guests');
  });

  it('LegacyRedirect_LegacyPathWithoutQueryOrFragment_AddsNeitherAQuestionMarkNorAHash', () => {
    renderAt('/leases/abc', workspaceOf([longRent]));

    expect(screen.getByTestId('address').textContent).toBe('/app/long-rent/leases/abc');
  });

  it('LegacyRedirect_LegacyPathOfAnAreaTheUserDoesNotHave_GoesToHisHomeWithoutThatQuery', () => {
    // The query belongs to the page that was asked for: it means nothing on the home of another area.
    renderAt('/bookings/abc?checkout=success#x', workspaceOf([longRent]));

    expect(screen.getByTestId('address').textContent).toBe('/app/long-rent/leases');
  });

  it('LegacyRedirect_WorkspaceNotReady_WaitsAndDoesNotRedirect', () => {
    renderAt('/bookings/abc?checkout=success#x', workspaceOf([shortRent], false));

    expect(screen.queryByTestId('address')).not.toBeInTheDocument();
  });
});
