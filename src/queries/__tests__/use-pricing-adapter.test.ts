import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  usePricingAdapterConfig,
  useSavePricingAdapterConfig,
  useDisablePricingAdapter,
  usePricingHistory,
  useTriggerPricingSync,
  usePricingPreview,
} from '../use-pricing-adapter';
import { pricingAdapterApi } from '@/api/pricing-adapter.api';
import type { PricingAdapterConfig, PricingHistoryPagedResponse, PricingPreviewResponse } from '@/types';

vi.mock('@/api/pricing-adapter.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PROPERTY_ID = 'prop-abc';

const mockConfig: PricingAdapterConfig = {
  propertyId: PROPERTY_ID,
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  includePublicHolidays: false,
  lastAdaptedAt: null,
  nextScheduledRunAt: '2026-05-12T02:00:00Z',
  createdAt: '2026-05-11T00:00:00Z',
  updatedAt: '2026-05-11T00:00:00Z',
};

const mockHistory: PricingHistoryPagedResponse = {
  items: [],
  total: 0,
  page: 1,
};

const mockPreview: PricingPreviewResponse = {
  prices: [{ date: '2026-05-12', suggestedPrice: 115, basePrice: 100, reason: 'Weekend' }],
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePricingAdapterConfig', () => {
  it('fetches config for a given propertyId', async () => {
    vi.mocked(pricingAdapterApi.getConfig).mockResolvedValueOnce(mockConfig);

    const { result } = renderHook(() => usePricingAdapterConfig(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.getConfig).toHaveBeenCalledWith(PROPERTY_ID);
    expect(result.current.data).toEqual(mockConfig);
  });

  it('does not fetch when propertyId is empty', () => {
    const { result } = renderHook(() => usePricingAdapterConfig(''), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(pricingAdapterApi.getConfig).not.toHaveBeenCalled();
  });
});

describe('useSavePricingAdapterConfig', () => {
  it('calls saveConfig and invalidates cache on success', async () => {
    vi.mocked(pricingAdapterApi.saveConfig).mockResolvedValueOnce(mockConfig);

    const { result } = renderHook(() => useSavePricingAdapterConfig(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });
    const req = { isEnabled: true, adaptationFrequency: 'daily' as const, includeSeasonality: true, includePublicHolidays: false };

    await act(async () => {
      result.current.mutate(req);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.saveConfig).toHaveBeenCalledWith(PROPERTY_ID, req);
  });
});

describe('useDisablePricingAdapter', () => {
  it('calls disableConfig on mutate', async () => {
    vi.mocked(pricingAdapterApi.disableConfig).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDisablePricingAdapter(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.disableConfig).toHaveBeenCalledWith(PROPERTY_ID);
  });

  it('rolls back optimistic update on error', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['pricing-adapter', 'config', PROPERTY_ID], mockConfig);

    vi.mocked(pricingAdapterApi.disableConfig).mockRejectedValueOnce(new Error('Network error'));

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useDisablePricingAdapter(PROPERTY_ID), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const restored = client.getQueryData(['pricing-adapter', 'config', PROPERTY_ID]);
    expect(restored).toEqual(mockConfig);
  });
});

describe('usePricingHistory', () => {
  it('fetches history with params', async () => {
    vi.mocked(pricingAdapterApi.getHistory).mockResolvedValueOnce(mockHistory);
    const params = { page: 1, pageSize: 20 };

    const { result } = renderHook(() => usePricingHistory(PROPERTY_ID, params), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.getHistory).toHaveBeenCalledWith(PROPERTY_ID, params);
  });
});

describe('useTriggerPricingSync', () => {
  it('calls triggerSync and returns jobId', async () => {
    vi.mocked(pricingAdapterApi.triggerSync).mockResolvedValueOnce({ jobId: 'job-1' });

    const { result } = renderHook(() => useTriggerPricingSync(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.jobId).toBe('job-1');
  });
});

describe('usePricingPreview', () => {
  it('fetches preview prices', async () => {
    vi.mocked(pricingAdapterApi.getPreview).mockResolvedValueOnce(mockPreview);

    const { result } = renderHook(() => usePricingPreview(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.prices).toHaveLength(1);
  });
});
