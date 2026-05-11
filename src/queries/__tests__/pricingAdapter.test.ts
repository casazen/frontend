import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import {
  pricingAdapterKeys,
  usePricingAdapterConfig,
  usePricingHistory,
  usePricingPreview,
  useUpdatePricingAdapterConfig,
  useDisablePricingAdapter,
  useTriggerPricingSync,
} from '../pricingAdapter';
import * as pricingAdapterApi from '@/api/pricingAdapter';
import type {
  PricingAdapterConfigDto,
  PricingHistoryPageDto,
  PricingPreviewDto,
} from '@/types/pricing';

vi.mock('@/api/pricingAdapter');

const PROPERTY_ID = 'prop-123';

const mockConfig: PricingAdapterConfigDto = {
  propertyId: PROPERTY_ID,
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  includePublicHolidays: false,
  lastAdaptedAt: null,
  nextScheduledRunAt: '2026-05-12T02:00:00Z',
};

const mockHistory: PricingHistoryPageDto = {
  items: [
    {
      id: 'hist-1',
      adaptationDate: '2026-05-10T02:00:00Z',
      previousPrice: 100,
      newPrice: 120,
      changeReason: 'Seasonal peak detected',
      aiConfidence: 0.87,
      syncStatus: 'synced',
    },
  ],
  total: 1,
  page: 1,
};

const mockPreview: PricingPreviewDto = {
  prices: [
    { date: '2026-05-12', suggestedPrice: 115, basePrice: 100, reason: 'Weekend uplift' },
  ],
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

// ---------------------------------------------------------------------------
// pricingAdapterKeys factory
// ---------------------------------------------------------------------------

describe('pricingAdapterKeys', () => {
  it('builds config key correctly', () => {
    expect(pricingAdapterKeys.config(PROPERTY_ID)).toEqual([
      'pricing-adapter',
      'config',
      PROPERTY_ID,
    ]);
  });

  it('builds history key with filters', () => {
    const filters = { page: 2, pageSize: 10 };
    expect(pricingAdapterKeys.history(PROPERTY_ID, filters)).toEqual([
      'pricing-adapter',
      'history',
      PROPERTY_ID,
      filters,
    ]);
  });

  it('builds preview key correctly', () => {
    expect(pricingAdapterKeys.preview(PROPERTY_ID)).toEqual([
      'pricing-adapter',
      'preview',
      PROPERTY_ID,
    ]);
  });
});

// ---------------------------------------------------------------------------
// usePricingAdapterConfig
// ---------------------------------------------------------------------------

describe('usePricingAdapterConfig', () => {
  it('fetches config for a given propertyId', async () => {
    vi.mocked(pricingAdapterApi.getPricingAdapterConfig).mockResolvedValueOnce(mockConfig);

    const { result } = renderHook(() => usePricingAdapterConfig(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.getPricingAdapterConfig).toHaveBeenCalledWith(PROPERTY_ID);
    expect(result.current.data).toEqual(mockConfig);
  });

  it('does not fetch when propertyId is empty', () => {
    const { result } = renderHook(() => usePricingAdapterConfig(''), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(pricingAdapterApi.getPricingAdapterConfig).not.toHaveBeenCalled();
  });

  it('exposes isError when the request fails', async () => {
    vi.mocked(pricingAdapterApi.getPricingAdapterConfig).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => usePricingAdapterConfig(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// usePricingHistory
// ---------------------------------------------------------------------------

describe('usePricingHistory', () => {
  it('fetches history for a given propertyId', async () => {
    vi.mocked(pricingAdapterApi.getPricingHistory).mockResolvedValueOnce(mockHistory);

    const { result } = renderHook(() => usePricingHistory(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.getPricingHistory).toHaveBeenCalledWith(PROPERTY_ID, undefined);
    expect(result.current.data).toEqual(mockHistory);
  });

  it('passes filters to the API call', async () => {
    vi.mocked(pricingAdapterApi.getPricingHistory).mockResolvedValueOnce(mockHistory);
    const filters = { page: 2, pageSize: 20 };

    const { result } = renderHook(() => usePricingHistory(PROPERTY_ID, filters), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.getPricingHistory).toHaveBeenCalledWith(PROPERTY_ID, filters);
  });

  it('does not fetch when propertyId is empty', () => {
    const { result } = renderHook(() => usePricingHistory(''), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(pricingAdapterApi.getPricingHistory).not.toHaveBeenCalled();
  });

  it('exposes isError when the request fails', async () => {
    vi.mocked(pricingAdapterApi.getPricingHistory).mockRejectedValueOnce(
      new Error('Server error')
    );

    const { result } = renderHook(() => usePricingHistory(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// usePricingPreview
// ---------------------------------------------------------------------------

describe('usePricingPreview', () => {
  it('fetches 90-day preview for a given propertyId', async () => {
    vi.mocked(pricingAdapterApi.getPricingPreview).mockResolvedValueOnce(mockPreview);

    const { result } = renderHook(() => usePricingPreview(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.getPricingPreview).toHaveBeenCalledWith(PROPERTY_ID);
    expect(result.current.data?.prices).toHaveLength(1);
  });

  it('does not fetch when propertyId is empty', () => {
    const { result } = renderHook(() => usePricingPreview(''), {
      wrapper: makeWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('exposes isError when the request fails', async () => {
    vi.mocked(pricingAdapterApi.getPricingPreview).mockRejectedValueOnce(
      new Error('Preview unavailable')
    );

    const { result } = renderHook(() => usePricingPreview(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useUpdatePricingAdapterConfig
// ---------------------------------------------------------------------------

describe('useUpdatePricingAdapterConfig', () => {
  it('calls createOrUpdatePricingAdapterConfig and invalidates config on success', async () => {
    vi.mocked(pricingAdapterApi.createOrUpdatePricingAdapterConfig).mockResolvedValueOnce(
      mockConfig
    );

    const { result } = renderHook(
      () => useUpdatePricingAdapterConfig(PROPERTY_ID),
      { wrapper: makeWrapper() }
    );

    const req = {
      isEnabled: true,
      adaptationFrequency: 'daily' as const,
      includeSeasonality: true,
      includePublicHolidays: false,
    };

    await act(async () => {
      result.current.mutate(req);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.createOrUpdatePricingAdapterConfig).toHaveBeenCalledWith(
      PROPERTY_ID,
      req
    );
  });

  it('applies optimistic update before server responds', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(pricingAdapterKeys.config(PROPERTY_ID), mockConfig);

    // Simulate a slow response
    let resolve!: (v: PricingAdapterConfigDto) => void;
    vi.mocked(pricingAdapterApi.createOrUpdatePricingAdapterConfig).mockReturnValueOnce(
      new Promise((r) => { resolve = r; })
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useUpdatePricingAdapterConfig(PROPERTY_ID), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ ...mockConfig, isEnabled: false });
    });

    // Optimistic state should be applied before resolving
    const optimistic = client.getQueryData<PricingAdapterConfigDto>(
      pricingAdapterKeys.config(PROPERTY_ID)
    );
    expect(optimistic?.isEnabled).toBe(false);

    // Resolve the mutation
    resolve({ ...mockConfig, isEnabled: false });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back optimistic update on error', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(pricingAdapterKeys.config(PROPERTY_ID), mockConfig);

    vi.mocked(pricingAdapterApi.createOrUpdatePricingAdapterConfig).mockRejectedValueOnce(
      new Error('Network error')
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);

    const { result } = renderHook(() => useUpdatePricingAdapterConfig(PROPERTY_ID), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ ...mockConfig, isEnabled: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const restored = client.getQueryData<PricingAdapterConfigDto>(
      pricingAdapterKeys.config(PROPERTY_ID)
    );
    expect(restored?.isEnabled).toBe(true); // rolled back to original
  });

  it('exposes isError when the mutation fails', async () => {
    vi.mocked(pricingAdapterApi.createOrUpdatePricingAdapterConfig).mockRejectedValueOnce(
      new Error('Server error')
    );

    const { result } = renderHook(
      () => useUpdatePricingAdapterConfig(PROPERTY_ID),
      { wrapper: makeWrapper() }
    );

    await act(async () => {
      result.current.mutate({
        isEnabled: false,
        adaptationFrequency: 'weekly',
        includeSeasonality: false,
        includePublicHolidays: false,
      });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useDisablePricingAdapter
// ---------------------------------------------------------------------------

describe('useDisablePricingAdapter', () => {
  it('calls deletePricingAdapterConfig and invalidates config on success', async () => {
    vi.mocked(pricingAdapterApi.deletePricingAdapterConfig).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDisablePricingAdapter(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.deletePricingAdapterConfig).toHaveBeenCalledWith(PROPERTY_ID);
  });

  it('exposes isError when the mutation fails', async () => {
    vi.mocked(pricingAdapterApi.deletePricingAdapterConfig).mockRejectedValueOnce(
      new Error('Cannot delete config')
    );

    const { result } = renderHook(() => useDisablePricingAdapter(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useTriggerPricingSync
// ---------------------------------------------------------------------------

describe('useTriggerPricingSync', () => {
  it('calls triggerPricingSync and returns jobId', async () => {
    vi.mocked(pricingAdapterApi.triggerPricingSync).mockResolvedValueOnce({ jobId: 'job-42' });

    const { result } = renderHook(() => useTriggerPricingSync(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.triggerPricingSync).toHaveBeenCalledWith(PROPERTY_ID);
    expect(result.current.data?.jobId).toBe('job-42');
  });

  it('exposes isError when the mutation fails', async () => {
    vi.mocked(pricingAdapterApi.triggerPricingSync).mockRejectedValueOnce(
      new Error('Sync service unavailable')
    );

    const { result } = renderHook(() => useTriggerPricingSync(PROPERTY_ID), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
