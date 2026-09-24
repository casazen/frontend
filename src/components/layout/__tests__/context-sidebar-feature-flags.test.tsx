import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { ContextSidebar } from '../context-sidebar';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';

vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: vi.fn(),
}));

import { useWorkspace } from '@/hooks/use-workspace';

function renderSidebar(otaPartnerApi?: boolean) {
  const sidebar = (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={['/app/short-rent']}>
        <ContextSidebar contextKey="short-rent" subtitle="Affitti brevi" />
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

// FD-20 / D10: the "Canali OTA" menu entry is behind the otaPartnerApi flag, off by default.
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

    expect(screen.getByRole('link', { name: 'Immobili' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'OTA' })).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/short-rent/ota"]')).toBeNull();
    expect(screen.queryByText('Integrazioni')).not.toBeInTheDocument();
  });

  it('has no OTA entry when the flags are not available', () => {
    renderSidebar();

    expect(screen.getByRole('link', { name: 'Immobili' })).toBeInTheDocument();
    expect(document.querySelector('a[href^="/app/short-rent/ota"]')).toBeNull();
  });

  it('shows the OTA entry when the otaPartnerApi flag is on', () => {
    renderSidebar(true);

    expect(screen.getByRole('link', { name: 'OTA' })).toHaveAttribute('href', '/app/short-rent/ota');
  });
});
