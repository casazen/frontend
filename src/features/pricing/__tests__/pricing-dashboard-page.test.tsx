import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { PricingDashboardPage } from '../pricing-dashboard-page';
import * as pricingQueries from '@/queries/use-pricing-adapter';
import type { PricingAdapterConfig, PricingPreviewResponse } from '@/types';
import type { PricingHistoryPagedResponse } from '@/types';

vi.mock('@/queries/use-pricing-adapter');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', { 'data-testid': 'app-shell' }, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));
vi.mock('@/components/shared/loading-screen', () => ({
  LoadingScreen: ({ message }: { message: string }) => createElement('div', { 'data-testid': 'loading' }, message),
}));
vi.mock('recharts', () => ({
  LineChart: ({ children }: any) => createElement('div', { 'data-testid': 'line-chart' }, children),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => createElement('div', null, children),
}));

const PROPERTY_ID = 'prop-test';

const mockConfig: PricingAdapterConfig = {
  propertyId: PROPERTY_ID,
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  includePublicHolidays: false,
  lastAdaptedAt: null,
  nextScheduledRunAt: null,
  createdAt: '2026-05-11T00:00:00Z',
  updatedAt: '2026-05-11T00:00:00Z',
};

const mockPreview: PricingPreviewResponse = {
  prices: [
    { date: '2026-05-12', suggestedPrice: 120, basePrice: 100, reason: 'Weekend' },
  ],
};

const mockHistory: PricingHistoryPagedResponse = {
  items: [
    {
      id: 'hist-1',
      propertyId: PROPERTY_ID,
      adaptationDate: '2026-05-10',
      previousPrice: 100,
      newPrice: 120,
      changeReason: 'Weekend surge',
      aiConfidence: 0.87,
      otasSynced: 'airbnb',
      syncStatus: 'synced',
      createdAt: '2026-05-10T08:00:00Z',
    },
  ],
  total: 1,
  page: 1,
};

function noopMutation() {
  return { mutate: vi.fn(), isPending: false, isSuccess: false, isError: false };
}

function renderPage(propertyId = PROPERTY_ID) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [`/properties/${propertyId}/pricing`] },
          createElement(Routes, null,
            createElement(Route, { path: '/properties/:id/pricing', element: createElement(PricingDashboardPage) })
          )
        )
      )
    )
  );
}

function setupAllMocks(overrides: Partial<{
  configData: typeof mockConfig | undefined;
  configLoading: boolean;
  previewData: typeof mockPreview | undefined;
  historyData: typeof mockHistory | undefined;
  disableMutate: ReturnType<typeof vi.fn>;
  updateMutate: ReturnType<typeof vi.fn>;
  syncMutate: ReturnType<typeof vi.fn>;
}> = {}) {
  const {
    configData = mockConfig,
    configLoading = false,
    previewData = mockPreview,
    historyData = mockHistory,
    disableMutate = vi.fn(),
    updateMutate = vi.fn(),
    syncMutate = vi.fn(),
  } = overrides;

  vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ data: configData, isLoading: configLoading } as any);
  vi.mocked(pricingQueries.usePricingPreview).mockReturnValue({ data: previewData, isLoading: false } as any);
  vi.mocked(pricingQueries.usePricingHistory).mockReturnValue({ data: historyData, isLoading: false } as any);
  vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue({ ...noopMutation(), mutate: updateMutate } as any);
  vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue({ ...noopMutation(), mutate: disableMutate } as any);
  vi.mocked(pricingQueries.useTriggerPricingSync).mockReturnValue({ ...noopMutation(), mutate: syncMutate } as any);
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
});

describe('PricingDashboardPage', () => {
  it('shows loading screen while config is loading', () => {
    setupAllMocks({ configLoading: true, configData: undefined });

    renderPage();

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders page heading and config card when data is available', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'AI Dynamic Pricing' })).toBeInTheDocument();
    expect(screen.getByTestId('pricing-toggle')).toBeInTheDocument();
  });

  it('renders preview chart when pricing is enabled', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('shows empty state for preview when pricing is disabled', () => {
    const disabledConfig = { ...mockConfig, isEnabled: false };
    setupAllMocks({ configData: disabledConfig, previewData: undefined });

    renderPage();

    expect(screen.getByText('AI pricing is disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('renders history table with data', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByText('Weekend surge')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('renders history date range filter inputs', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByTestId('history-filter-from')).toBeInTheDocument();
    expect(screen.getByTestId('history-filter-to')).toBeInTheDocument();
  });

  it('calls disableConfig when toggle is turned off', async () => {
    const disableMutate = vi.fn();
    setupAllMocks({ disableMutate });

    renderPage();

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => expect(disableMutate).toHaveBeenCalled());
  });

  it('calls updateConfig when toggle is turned on from disabled state', async () => {
    const updateMutate = vi.fn();
    const disabledConfig = { ...mockConfig, isEnabled: false };
    setupAllMocks({ configData: disabledConfig, updateMutate, previewData: undefined });

    renderPage();

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ isEnabled: true })
    ));
  });

  it('calls updateConfig when save button is clicked', async () => {
    const updateMutate = vi.fn();
    setupAllMocks({ updateMutate });

    renderPage();

    const saveBtn = screen.getByTestId('save-config-btn');
    fireEvent.click(saveBtn);

    await waitFor(() => expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        isEnabled: true,
        adaptationFrequency: 'daily',
        includeSeasonality: true,
        includePublicHolidays: false,
      })
    ));
  });

  it('calls triggerSync when sync button is clicked', async () => {
    const syncMutate = vi.fn();
    setupAllMocks({ syncMutate });

    renderPage();

    const syncBtn = screen.getByTestId('sync-btn');
    fireEvent.click(syncBtn);

    expect(syncMutate).toHaveBeenCalled();
  });

  it('shows loading state in history table while fetching', () => {
    vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ data: mockConfig, isLoading: false } as any);
    vi.mocked(pricingQueries.usePricingPreview).mockReturnValue({ data: mockPreview, isLoading: false } as any);
    vi.mocked(pricingQueries.usePricingHistory).mockReturnValue({ data: undefined, isLoading: true } as any);
    vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useTriggerPricingSync).mockReturnValue(noopMutation() as any);

    renderPage();

    expect(screen.getByTestId('history-loading')).toBeInTheDocument();
  });

  it('frequency selector renders daily and weekly options', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByTestId('frequency-daily')).toBeInTheDocument();
    expect(screen.getByTestId('frequency-weekly')).toBeInTheDocument();
  });

  it('seasonality and public holiday checkboxes are rendered', () => {
    setupAllMocks();

    renderPage();

    expect(screen.getByTestId('include-seasonality')).toBeInTheDocument();
    expect(screen.getByTestId('include-public-holidays')).toBeInTheDocument();
  });
});
