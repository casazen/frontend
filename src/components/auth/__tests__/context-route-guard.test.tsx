import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ContextRouteGuard } from '../context-route-guard';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { AppContextKey } from '@/config/route-manifest';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));

import { useWorkspace } from '@/hooks/use-workspace';

function renderOtaRoute(flags: { otaPartnerApi: boolean; isLoading?: boolean }) {
  return render(
    <FeatureFlagsContext.Provider
      value={{ flags: { ...DEFAULT_FEATURE_FLAGS, otaPartnerApi: flags.otaPartnerApi }, isLoading: flags.isLoading ?? false }}
    >
      <MemoryRouter initialEntries={['/app/short-rent/ota']}>
        <Routes>
          <Route path="/app/short-rent" element={<p>home</p>} />
          <Route
            path="/app/short-rent/ota"
            element={
              <ContextRouteGuard contextKey="short-rent" requiredPermissions={['ota.read']} featureFlag="otaPartnerApi">
                <p>ota page</p>
              </ContextRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </FeatureFlagsContext.Provider>,
  );
}

// FD-20 / D10: /app/short-rent/ota* is not reachable while the otaPartnerApi flag is off.
describe('ContextRouteGuard feature flag', () => {
  beforeEach(() => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [
        {
          contextKey: 'short-rent',
          displayName: 'Affitti brevi',
          roleKey: 'property_owner',
          permissions: ['ota.read'],
          defaultRoute: '/app/short-rent',
        },
      ],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      getDefaultRoute: vi.fn().mockReturnValue('/app/short-rent'),
    });
  });

  it('redirects to the context home when the flag is off', () => {
    renderOtaRoute({ otaPartnerApi: false });

    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('ota page')).not.toBeInTheDocument();
  });

  it('waits for the flags before deciding', () => {
    renderOtaRoute({ otaPartnerApi: false, isLoading: true });

    expect(screen.queryByText('home')).not.toBeInTheDocument();
    expect(screen.queryByText('ota page')).not.toBeInTheDocument();
  });

  it('renders the route when the flag is on', () => {
    renderOtaRoute({ otaPartnerApi: true });

    expect(screen.getByText('ota page')).toBeInTheDocument();
  });
});

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}`}</p>;
}

function renderBillingRoute(entry: string, alternatePaths?: Partial<Record<AppContextKey, string>>) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/app/short-rent/settings/plan"
          element={
            <ContextRouteGuard contextKey="short-rent" alternatePaths={alternatePaths}>
              <p>short-rent plan</p>
            </ContextRouteGuard>
          }
        />
        <Route path="/app/long-rent/settings/plan" element={<p>long-rent plan</p>} />
        <Route path="/app/long-rent/leases" element={<p>leases</p>} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );
}

// PL-16 (A1-36): an old link or Stripe return page of the short-rent plan page, opened by a landlord with only the
// long-rent context, lands on the same page of the long-rent shell with its query string.
describe('ContextRouteGuard plan and billing pages of another context', () => {
  beforeEach(() => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [
        {
          contextKey: 'long-rent',
          displayName: 'Affitti lungo termine',
          roleKey: 'long_term_landlord',
          permissions: ['lease.read'],
          defaultRoute: '/app/long-rent/leases',
        },
      ],
      activeContext: 'long-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      getDefaultRoute: vi.fn().mockReturnValue('/app/long-rent/leases'),
    });
  });

  it('ContextRouteGuard_ShortRentPlanPageForLongRentLandlord_RedirectsToTheLongRentPlanPage', () => {
    renderBillingRoute('/app/short-rent/settings/plan?checkout=success', { 'long-rent': '/app/long-rent/settings/plan' });

    expect(screen.getByText('long-rent plan')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/app/long-rent/settings/plan?checkout=success');
  });

  it('ContextRouteGuard_PageWithoutAlternate_RedirectsToTheHomeOfTheUsersContext', () => {
    renderBillingRoute('/app/short-rent/settings/plan');

    expect(screen.getByText('leases')).toBeInTheDocument();
  });
});
