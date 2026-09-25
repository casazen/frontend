import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { AxiosError, AxiosHeaders } from 'axios';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../dashboard-page';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { dashboardApi } from '@/api/dashboard.api';
import { bookingsApi } from '@/api/bookings.api';
import { paymentsApi } from '@/api/payments.api';
import i18n from '@/i18n/config';
import type { DashboardIcalFeed, DashboardKpis, DashboardStay } from '@/types/dashboard.types';

vi.mock('@/api/dashboard.api', () => ({
  dashboardApi: { getKpis: vi.fn(), getIcalFeeds: vi.fn() },
}));
vi.mock('@/api/bookings.api', () => ({ bookingsApi: { getAll: vi.fn() } }));
vi.mock('@/api/payments.api', () => ({ paymentsApi: { getAll: vi.fn() } }));
vi.mock('@/api/ota.api', () => ({ otaApi: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/features/compliance/compliance-summary-widget', () => ({
  ComplianceSummaryWidget: () => null,
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
const permissions = vi.hoisted(() => ({ propertyRead: true }));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({
    hasPermission: (context: string, permission: string) =>
      context === 'short-rent' && (permission !== 'property.read' || permissions.propertyRead),
  }),
}));

function stay(id: string, overrides: Partial<DashboardStay> = {}): DashboardStay {
  return {
    bookingId: id,
    propertyId: 'prop-1',
    propertyName: 'Villa Mare',
    guestName: `Ospite ${id}`,
    checkInDate: '2026-06-16',
    checkOutDate: '2026-06-18',
    status: 'Confirmed',
    totalPrice: 320,
    createdAt: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

const KPIS: DashboardKpis = {
  period: { kind: 'Month', from: '2026-06-01', to: '2026-06-30', nights: 30 },
  today: '2026-06-16',
  propertyCount: 2,
  occupancy: { occupiedNights: 27, availableNights: 60, closedNights: 0, rate: 0.45 },
  revenue: { amount: 775, currency: 'EUR', stayCount: 3 },
  arrivalsToday: { count: 2, items: [stay('arr-1'), stay('arr-2', { propertyName: 'Casa Lago' })] },
  departuresToday: { count: 1, items: [stay('dep-1', { checkInDate: '2026-06-14', checkOutDate: '2026-06-16' })] },
  upcomingCheckIns: { count: 7, items: [stay('up-1', { checkInDate: '2026-06-20', checkOutDate: '2026-06-22' })] },
  recentBookings: [stay('rec-1', { status: 'Cancelled', guestName: 'Mario Rossi' })],
};

const FEEDS: DashboardIcalFeed[] = [
  {
    feedId: 'feed-err',
    propertyId: 'prop-2',
    propertyName: 'Casa Lago',
    channel: 'BookingCom',
    label: null,
    lastImportAt: '2026-06-16T08:00:00Z',
    lastImportStatus: 'Failure',
    lastErrorCode: 'ical_unreachable',
    lastError: 'backend text',
  },
  {
    feedId: 'feed-ok',
    propertyId: 'prop-1',
    propertyName: 'Villa Mare',
    channel: 'Airbnb',
    label: 'Airbnb camera 2',
    lastImportAt: '2026-06-16T09:00:00Z',
    lastImportStatus: 'Success',
    lastErrorCode: null,
    lastError: null,
  },
  {
    feedId: 'feed-new',
    propertyId: 'prop-1',
    propertyName: 'Villa Mare',
    channel: 'Other',
    lastImportAt: null,
    lastImportStatus: null,
  },
];

function problemError(status: number, data: object): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data: { status, ...data },
  });
}

function renderDashboard(otaPartnerApi = false) {
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

// PC-16 (A2-29): the KPIs come from the server for a period; loading, errors and the iCal calendars are shown.
describe('DashboardPage', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    permissions.propertyRead = true;
    vi.mocked(dashboardApi.getKpis).mockReset();
    vi.mocked(dashboardApi.getIcalFeeds).mockReset();
    vi.mocked(dashboardApi.getKpis).mockResolvedValue(KPIS);
    vi.mocked(dashboardApi.getIcalFeeds).mockResolvedValue(FEEDS);
  });

  it('DashboardPage_ServerKpis_ShowsOccupancyRevenueAndTodayWithoutLoadingEveryBooking', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-kpis')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-stat-occupancy-value')).toHaveTextContent(/^45\s?%$/);
    expect(screen.getByTestId('dashboard-stat-occupancy')).toHaveTextContent(
      '27 notti occupate su 60 disponibili · 2 immobili',
    );
    expect(screen.getByTestId('dashboard-stat-revenue-value')).toHaveTextContent(/775,00\s€/);
    expect(screen.getByTestId('dashboard-stat-revenue')).toHaveTextContent('3 soggiorni confermati');
    expect(screen.getByTestId('dashboard-stat-arrivals-value')).toHaveTextContent('2');
    expect(screen.getByTestId('dashboard-stat-departures-value')).toHaveTextContent('1');
    expect(screen.getByTestId('dashboard-period-range')).toHaveTextContent('Dal 1 giugno 2026 al 30 giugno 2026');

    const arrivals = screen.getAllByTestId('dashboard-arrivals-item');
    expect(arrivals).toHaveLength(2);
    expect(arrivals[0]).toHaveAttribute('href', '/app/short-rent/bookings/arr-1');
    expect(arrivals[1]).toHaveTextContent('Casa Lago');
    expect(screen.getByTestId('dashboard-upcoming')).toHaveTextContent('7 arrivi confermati in programma');
    expect(screen.getByTestId('dashboard-upcoming')).toHaveTextContent('+6 altri');
    expect(within(screen.getByTestId('dashboard-recent-bookings')).getByText('Mario Rossi')).toBeInTheDocument();
    expect(within(screen.getByTestId('dashboard-recent-bookings')).getByText('Annullata')).toBeInTheDocument();

    expect(dashboardApi.getKpis).toHaveBeenCalledWith({ kind: 'Month' });
    expect(bookingsApi.getAll).not.toHaveBeenCalled();
    expect(paymentsApi.getAll).not.toHaveBeenCalled();
  });

  it('DashboardPage_NoAvailableNights_ShowsNoPercentageInsteadOfZero', async () => {
    vi.mocked(dashboardApi.getKpis).mockResolvedValue({
      ...KPIS,
      propertyCount: 0,
      occupancy: { occupiedNights: 0, availableNights: 0, closedNights: 0, rate: null },
    });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-stat-occupancy-value')).toHaveTextContent('—');
  });

  it('DashboardPage_PeriodChanged_AsksTheServerForThatPeriod', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-kpis');

    fireEvent.change(screen.getByTestId('dashboard-period'), { target: { value: 'last30' } });
    await waitFor(() => expect(dashboardApi.getKpis).toHaveBeenLastCalledWith({ kind: 'Last30Days' }));

    const monthOption = within(screen.getByTestId('dashboard-period'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('value')?.startsWith('month:'));
    expect(monthOption).toBeDefined();
    fireEvent.change(screen.getByTestId('dashboard-period'), { target: { value: monthOption!.getAttribute('value') } });
    await waitFor(() =>
      expect(dashboardApi.getKpis).toHaveBeenLastCalledWith({
        kind: 'Month',
        month: monthOption!.getAttribute('value')!.slice('month:'.length),
      }),
    );
  });

  it('DashboardPage_WhileLoading_ShowsSkeletonsNotZeroes', () => {
    vi.mocked(dashboardApi.getKpis).mockReturnValue(new Promise(() => {}));
    vi.mocked(dashboardApi.getIcalFeeds).mockReturnValue(new Promise(() => {}));

    renderDashboard();

    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
    expect(screen.getByTestId('dashboard-ical-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-kpis')).not.toBeInTheDocument();
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
  });

  it('DashboardPage_KpisFail_ShowsTheApiErrorAndRetriesInsteadOfEmptyKpis', async () => {
    vi.mocked(dashboardApi.getKpis).mockRejectedValueOnce(problemError(403, { code: 'forbidden' }));

    renderDashboard();

    const error = await screen.findByTestId('dashboard-error');
    expect(error).toHaveTextContent('Non hai i permessi per eseguire questa operazione.');
    expect(screen.queryByTestId('dashboard-kpis')).not.toBeInTheDocument();
    expect(screen.queryByText('Nessun arrivo oggi.')).not.toBeInTheDocument();

    fireEvent.click(within(error).getByRole('button', { name: 'Riprova' }));

    expect(await screen.findByTestId('dashboard-kpis')).toBeInTheDocument();
  });

  it('DashboardPage_ServerError_ShowsTheGenericLoadError', async () => {
    vi.mocked(dashboardApi.getKpis).mockRejectedValue(problemError(500, { detail: 'NullReferenceException at ...' }));

    renderDashboard();

    const error = await screen.findByTestId('dashboard-error');
    expect(error).toHaveTextContent('Impossibile caricare gli indicatori del cruscotto.');
    expect(error).not.toHaveTextContent('NullReferenceException');
  });

  it('DashboardPage_IcalFeeds_ShowLastSyncTranslatedStatusAndErrorWithLinkToTheIcalScreen', async () => {
    renderDashboard();

    const rows = await screen.findAllByTestId('dashboard-ical-feed');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Casa Lago · Booking.com');
    expect(rows[0]).toHaveTextContent('Errore');
    expect(within(rows[0]).getByTestId('dashboard-ical-feed-error')).toHaveTextContent(
      i18n.t('apiErrors.codes.icalUnreachable'),
    );
    expect(rows[0]).not.toHaveTextContent('backend text');
    expect(within(rows[0]).getByTestId('dashboard-ical-feed-link')).toHaveAttribute(
      'href',
      '/app/short-rent/properties/prop-2?tab=ical',
    );
    expect(rows[1]).toHaveTextContent('Villa Mare · Airbnb camera 2');
    expect(rows[1]).toHaveTextContent('Sincronizzato');
    expect(within(rows[1]).queryByTestId('dashboard-ical-feed-error')).not.toBeInTheDocument();
    expect(rows[2]).toHaveTextContent('Mai sincronizzato');
    expect(screen.getByTestId('dashboard-ical-failing')).toHaveTextContent('1 con errori');
  });

  it('DashboardPage_IcalFeedsFail_ShowsTheErrorNotAnEmptyList', async () => {
    vi.mocked(dashboardApi.getIcalFeeds).mockRejectedValue(problemError(500, {}));

    renderDashboard();

    expect(await screen.findByTestId('dashboard-ical-error')).toHaveTextContent(
      'Impossibile caricare lo stato dei calendari iCal.',
    );
    expect(screen.queryByTestId('dashboard-ical-empty')).not.toBeInTheDocument();
  });

  it('DashboardPage_NoIcalFeeds_SaysHowToLinkOne', async () => {
    vi.mocked(dashboardApi.getIcalFeeds).mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-ical-empty')).toBeInTheDocument();
  });

  it('DashboardPage_WithoutPropertyRead_HidesTheIcalWidgetAndDoesNotAskForIt', async () => {
    permissions.propertyRead = false;

    renderDashboard();

    await screen.findByTestId('dashboard-kpis');
    expect(screen.queryByTestId('dashboard-ical-widget')).not.toBeInTheDocument();
    expect(dashboardApi.getIcalFeeds).not.toHaveBeenCalled();
  });
});
