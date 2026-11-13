import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { ContextRouteGuard } from '../context-route-guard';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));

import { useWorkspace } from '@/hooks/use-workspace';

function renderDocumentsRoute(flags: Partial<FeatureFlags>, isLoading = false) {
  return render(
    <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, ...flags }, isLoading }}>
      <MemoryRouter initialEntries={['/app/short-rent/fiscal/documents']}>
        <Routes>
          <Route path="/app/short-rent" element={<p>home</p>} />
          <Route
            path="/app/short-rent/fiscal/documents"
            element={
              <ContextRouteGuard
                contextKey="short-rent"
                requiredPermissions={['property.read', 'payment.read']}
                featureFlag={['fiscalDocumentIssuance', 'octorateDocumentImport']}
              >
                <p>documents page</p>
              </ContextRouteGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    </FeatureFlagsContext.Provider>,
  );
}

// E06/F03/US04/T01: the page of the fiscal documents serves two sources, each behind a flag of its own: it exists while either of them is on.
describe('ContextRouteGuard with a list of feature flags', () => {
  beforeEach(() => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [
        {
          contextKey: 'short-rent',
          displayName: 'Affitti brevi',
          roleKey: 'property_owner',
          permissions: ['property.read', 'payment.read'],
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

  it('redirects to the context home when every flag of the list is off', () => {
    renderDocumentsRoute({});

    expect(screen.getByText('home')).toBeInTheDocument();
    expect(screen.queryByText('documents page')).not.toBeInTheDocument();
  });

  it('waits for the flags before deciding', () => {
    renderDocumentsRoute({}, true);

    expect(screen.queryByText('home')).not.toBeInTheDocument();
    expect(screen.queryByText('documents page')).not.toBeInTheDocument();
  });

  it.each([
    ['CasaZen issues', { fiscalDocumentIssuance: true }],
    ['the documents of the channel manager are imported', { octorateDocumentImport: true }],
  ])('renders the route when %s', (_case, flags) => {
    renderDocumentsRoute(flags);

    expect(screen.getByText('documents page')).toBeInTheDocument();
  });
});
