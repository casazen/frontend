import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContextRouteGuard } from '../context-route-guard';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';

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
