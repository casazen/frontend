import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ContextSidebar } from '../context-sidebar';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));
// The counters and the organization line are not what this test is about.
vi.mock('@/hooks/use-nav-counts', () => ({ useNavCounts: () => ({}) }));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ org: null, user: null, planTier: null, isLoading: false }) }));

import { useWorkspace } from '@/hooks/use-workspace';

function renderSidebar(otaPartnerApi?: boolean) {
  const sidebar = (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/app/short-rent']}>
        <ContextSidebar contextKey="short-rent" />
      </MemoryRouter>
    </I18nextProvider>
  );
  if (otaPartnerApi === undefined) return render(sidebar);
  return render(
    <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, otaPartnerApi }, isLoading: false }}>
      {sidebar}
    </FeatureFlagsContext.Provider>,
  );
}

const openMore = () => fireEvent.click(screen.getByRole('button', { name: 'Altro' }));

// FD-20 / D10: the "Canali OTA" menu entry is behind the otaPartnerApi flag, off by default. It is one of the entries of
// "Altro" (UI-04a), which the tests open.
describe('ContextSidebar feature flags', () => {
  beforeEach(() => {
    vi.mocked(useWorkspace).mockReturnValue({
      contexts: [],
      activeContext: 'short-rent',
      isReady: true,
      setActiveContext: vi.fn(),
      hasPermission: vi.fn().mockReturnValue(true),
      getDefaultRoute: vi.fn(),
    });
  });

  it('has no OTA entry when the otaPartnerApi flag is off, even with ota.read', () => {
    renderSidebar(false);
    openMore();

    expect(screen.getByRole('link', { name: 'Immobili' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ospiti' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'OTA' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/short-rent/ota"]')).toBeNull();
  });

  it('has no OTA entry when the flags are not available', () => {
    renderSidebar();
    openMore();

    expect(screen.getByRole('link', { name: 'Immobili' })).toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/short-rent/ota"]')).toBeNull();
  });

  it('shows the OTA entry when the otaPartnerApi flag is on', () => {
    renderSidebar(true);
    openMore();

    expect(screen.getByRole('link', { name: 'OTA' })).toHaveAttribute('href', '/app/short-rent/ota');
  });
});
