import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DashboardPage } from '../dashboard-page';

vi.mock('@/api/dashboard.api', () => ({
  dashboardApi: {
    getToday: vi.fn().mockResolvedValue({
      today: '2026-11-25',
      arrivals: { count: 0, items: [] }, departures: { count: 0, items: [] },
      services: { count: 0, items: [] }, approvals: { count: 0, items: [] }, todo: { count: 0, items: [] },
    }),
    getOverview: vi.fn(() => new Promise(() => {})),
    getIcalFeeds: vi.fn().mockResolvedValue([]),
  },
}));
const reads = vi.hoisted(() => ({ canReadBookings: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ hasPermission: (_context: string, permission: string) => permission !== 'booking.read' || reads.canReadBookings }),
}));
vi.mock('@/queries/use-users', () => ({ useCurrentUser: () => ({ user: null }) }));
vi.mock('@/queries/use-properties', () => {
  const properties = [{ id: 'p-1', name: 'Casa Mare' }];
  return { useProperties: () => ({ data: properties, isSuccess: true }) };
});
vi.mock('@/queries/use-message-hub', () => ({ useMessageHubThreads: () => ({ data: { items: [] } }) }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));

function renderDashboard(url = '/app/short-rent') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsContext.Provider value={{ flags: { ...DEFAULT_FEATURE_FLAGS, routines: true }, isLoading: false }}>
        <MemoryRouter initialEntries={[url]}>
          <DashboardPage />
        </MemoryRouter>
      </FeatureFlagsContext.Provider>
    </QueryClientProvider>,
  );
}

describe('daily workspace', () => {
  beforeEach(async () => {
    reads.canReadBookings = true;
    await i18n.changeLanguage('it');
  });
  afterEach(cleanup);

  it('shows the agenda and one pending list, with no analytics or duplicate alerts', async () => {
    renderDashboard();
    expect(await screen.findByTestId('home-today')).toBeInTheDocument();
    expect(screen.getByTestId('home-todo')).toHaveTextContent('Nessuna priorità operativa in elenco');
    expect(screen.queryByTestId('home-todo-path')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-compliance-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-period')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-filter')).not.toBeInTheDocument();
  });

  it('shows the period selector only in analytics and keeps the daily queue off that view', () => {
    renderDashboard('/app/short-rent?view=analytics');
    expect(screen.getByTestId('dashboard-period')).toBeInTheDocument();
    expect(screen.queryByTestId('home-todo')).not.toBeInTheDocument();
  });

  it('keeps booking data out of the home for roles without read access', () => {
    reads.canReadBookings = false;
    renderDashboard();
    expect(screen.queryByTestId('home-today')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-todo')).not.toBeInTheDocument();
  });
});
