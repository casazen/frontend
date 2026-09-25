import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../dashboard-page';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { otaApi } from '@/api/ota.api';

vi.mock('@/api/ota.api', () => ({
  otaApi: { getAll: vi.fn() },
}));
vi.mock('@/api/dashboard.api', () => ({
  dashboardApi: { getKpis: vi.fn(() => new Promise(() => {})), getIcalFeeds: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ hasPermission: () => true }) }));
vi.mock('@/features/compliance/compliance-summary-widget', () => ({
  ComplianceSummaryWidget: () => null,
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

function renderDashboard(otaPartnerApi: boolean) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, otaPartnerApi }, isLoading: false }}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

// FD-20 / D10 (A2-09): the dashboard called OTA endpoints that do not exist; the widget is behind otaPartnerApi.
describe('DashboardPage OTA widget', () => {
  beforeEach(() => {
    vi.mocked(otaApi.getAll).mockReset();
    vi.mocked(otaApi.getAll).mockResolvedValue([]);
  });

  it('neither renders the OTA widget nor calls the OTA API when the flag is off', async () => {
    renderDashboard(false);

    // The iCal calendars take the place of the OTA channels (PC-16).
    expect(screen.getByTestId('dashboard-ical-widget')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-ota-status')).not.toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(otaApi.getAll).not.toHaveBeenCalled();
  });

  it('renders the OTA widget when the flag is on', async () => {
    renderDashboard(true);

    expect(screen.getByTestId('dashboard-ota-status')).toBeInTheDocument();
    await waitFor(() => expect(otaApi.getAll).toHaveBeenCalled());
  });
});
