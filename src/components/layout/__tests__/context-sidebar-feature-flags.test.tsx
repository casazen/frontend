import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ContextSidebar } from '../context-sidebar';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));
// The counters are not what this test is about.
vi.mock('@/hooks/use-nav-counts', () => ({ useNavCounts: () => ({}) }));

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

// FD-20 / D10: the OTA channels are behind the otaPartnerApi flag, off by default. Since UI-04a they are a tab of Immobili, not an
// entry of the sidebar: the flag never adds an entry to the menu, nor to its foot. The tab itself is tested with `NavSectionTabs`.
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

  it.each([[false], [undefined], [true]])('has no OTA entry in the sidebar, whatever the otaPartnerApi flag (%s)', (flag) => {
    renderSidebar(flag);

    expect(screen.getByRole('link', { name: 'Immobili' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'OTA' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/short-rent/ota"]')).toBeNull();
  });

  it('lists the same entries with the flag on and off', () => {
    const links = () => screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    renderSidebar(false);
    const off = links();
    cleanup();
    renderSidebar(true);
    expect(links()).toEqual(off);
  });
});
