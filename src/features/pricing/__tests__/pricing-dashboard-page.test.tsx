import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PricingDashboardPage } from '../pricing-dashboard-page';
import * as pricingQueries from '@/queries/use-pricing-adapter';
import type { PricingAdapterConfig, PricingPreviewResponse } from '@/types';

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

function noopMutation() {
  return { mutate: vi.fn(), isPending: false, isSuccess: false, isError: false };
}

function renderPage(propertyId = PROPERTY_ID) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
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
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PricingDashboardPage', () => {
  it('shows loading screen while config is loading', () => {
    vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ data: undefined, isLoading: true } as any);
    vi.mocked(pricingQueries.usePricingPreview).mockReturnValue({ data: undefined, isLoading: false } as any);
    vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useTriggerPricingSync).mockReturnValue(noopMutation() as any);

    renderPage();

    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('renders config card and preview when pricing is enabled', () => {
    vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ data: mockConfig, isLoading: false } as any);
    vi.mocked(pricingQueries.usePricingPreview).mockReturnValue({ data: mockPreview, isLoading: false } as any);
    vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useTriggerPricingSync).mockReturnValue(noopMutation() as any);

    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'AI Dynamic Pricing' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('shows empty state when pricing is disabled', () => {
    const disabledConfig = { ...mockConfig, isEnabled: false };
    vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ data: disabledConfig, isLoading: false } as any);
    vi.mocked(pricingQueries.usePricingPreview).mockReturnValue({ data: undefined, isLoading: false } as any);
    vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useTriggerPricingSync).mockReturnValue(noopMutation() as any);

    renderPage();

    expect(screen.getByText('AI pricing is disabled')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
  });

  it('calls disableConfig when toggle is turned off', async () => {
    const disableMutate = vi.fn();
    vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ data: mockConfig, isLoading: false } as any);
    vi.mocked(pricingQueries.usePricingPreview).mockReturnValue({ data: mockPreview, isLoading: false } as any);
    vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue({ ...noopMutation(), mutate: disableMutate } as any);
    vi.mocked(pricingQueries.useTriggerPricingSync).mockReturnValue(noopMutation() as any);

    renderPage();

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => expect(disableMutate).toHaveBeenCalled());
  });

  it('calls triggerSync when sync button is clicked', async () => {
    const syncMutate = vi.fn();
    vi.mocked(pricingQueries.usePricingAdapterConfig).mockReturnValue({ data: mockConfig, isLoading: false } as any);
    vi.mocked(pricingQueries.usePricingPreview).mockReturnValue({ data: mockPreview, isLoading: false } as any);
    vi.mocked(pricingQueries.useSavePricingAdapterConfig).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useDisablePricingAdapter).mockReturnValue(noopMutation() as any);
    vi.mocked(pricingQueries.useTriggerPricingSync).mockReturnValue({ ...noopMutation(), mutate: syncMutate } as any);

    renderPage();

    const syncBtn = screen.getByRole('button', { name: /run sync now/i });
    fireEvent.click(syncBtn);

    expect(syncMutate).toHaveBeenCalled();
  });
});
