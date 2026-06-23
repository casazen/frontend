import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n/config';
import { PricingHistoryPage } from '../pricing-history-page';
import * as pricingQueries from '@/queries/use-pricing-adapter';
import * as pricingApi from '@/api/pricing-adapter.api';
import type { PricingHistoryPagedResponse } from '@/types';

vi.mock('@/queries/use-pricing-adapter');
vi.mock('@/api/pricing-adapter.api', () => ({
  pricingAdapterApi: {
    getHistory: vi.fn(),
  },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', { 'data-testid': 'app-shell' }, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const PROPERTY_ID = 'prop-test';

const mockEntry = {
  id: 'hist-1',
  propertyId: PROPERTY_ID,
  adaptationDate: '2026-05-10',
  previousPrice: 100,
  newPrice: 120,
  changeReason: 'Weekend surge',
  aiConfidence: 0.87,
  otasSynced: 'airbnb,booking',
  syncStatus: 'synced' as const,
  createdAt: '2026-05-10T08:00:00Z',
};

const mockHistory: PricingHistoryPagedResponse = {
  items: [mockEntry],
  total: 1,
  page: 1,
};

const mockHistoryMultiPage: PricingHistoryPagedResponse = {
  items: [mockEntry],
  total: 50,
  page: 1,
};

function renderPage(propertyId = PROPERTY_ID) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(I18nextProvider, { i18n },
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: [`/properties/${propertyId}/pricing/history`] },
          createElement(Routes, null,
            createElement(Route, {
              path: '/properties/:id/pricing/history',
              element: createElement(PricingHistoryPage),
            })
          )
        )
      )
    )
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage('en');
  Object.defineProperty(window, 'URL', {
    value: { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() },
    writable: true,
  });
});

describe('PricingHistoryPage', () => {
  it('shows loading state while fetching', () => {
    vi.mocked(pricingQueries.usePricingHistory).mockReturnValue({ data: undefined, isLoading: true } as any);

    renderPage();

    expect(screen.getByTestId('history-loading')).toBeInTheDocument();
  });

  it('renders history rows when data is available', () => {
    vi.mocked(pricingQueries.usePricingHistory).mockReturnValue({ data: mockHistory, isLoading: false } as any);

    renderPage();

    expect(screen.getByText('Weekend surge')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
    expect(screen.getByText('synced')).toBeInTheDocument();
  });

  it('shows empty state when history is empty', () => {
    vi.mocked(pricingQueries.usePricingHistory).mockReturnValue({
      data: { items: [], total: 0, page: 1 },
      isLoading: false,
    } as any);

    renderPage();

    expect(screen.getByTestId('history-empty')).toBeInTheDocument();
  });

  it('shows pagination controls when total exceeds page size', () => {
    vi.mocked(pricingQueries.usePricingHistory).mockReturnValue({ data: mockHistoryMultiPage, isLoading: false } as any);

    renderPage();

    expect(screen.getByLabelText('Next page')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeInTheDocument();
  });

  it('calls export API with pageSize 1000 when export button is clicked', async () => {
    vi.mocked(pricingQueries.usePricingHistory).mockReturnValue({ data: mockHistory, isLoading: false } as any);
    vi.mocked(pricingApi.pricingAdapterApi.getHistory).mockResolvedValue(mockHistory);

    renderPage();

    const exportBtn = screen.getByTestId('export-btn');
    fireEvent.click(exportBtn);

    await waitFor(() =>
      expect(pricingApi.pricingAdapterApi.getHistory).toHaveBeenCalledWith(
        PROPERTY_ID,
        expect.objectContaining({ pageSize: 1000, page: 1 })
      )
    );
  });
});
