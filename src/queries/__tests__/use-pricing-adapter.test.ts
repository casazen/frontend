import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { toast } from 'sonner';
import {
  usePricingAdapterConfig,
  useSavePricingAdapterConfig,
  useDisablePricingAdapter,
  useRecalculateSuggestions,
  useSeasonalSuggestions,
} from '../use-pricing-adapter';
import { pricingAdapterApi } from '@/api/pricing-adapter.api';
import type { PricingAdapterConfig, SavePricingAdapterConfigRequest, SeasonalSuggestionsResponse } from '@/types';

vi.mock('@/api/pricing-adapter.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

const PROPERTY_ID = 'prop-abc';

const mockConfig: PricingAdapterConfig = {
  propertyId: PROPERTY_ID,
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  highSeasonMonths: [6, 7, 8],
  highSeasonMultiplier: 1.3,
  lowSeasonMonths: [1, 2, 11, 12],
  lowSeasonMultiplier: 0.8,
  includePublicHolidays: false,
  holidayMultiplier: 1.5,
  lastAdaptedAt: null,
  nextRunOn: null,
  createdAt: '2026-05-11T00:00:00Z',
  updatedAt: '2026-05-11T00:00:00Z',
};

const request: SavePricingAdapterConfigRequest = {
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  highSeasonMonths: [6, 7, 8],
  highSeasonMultiplier: 1.3,
  lowSeasonMonths: [1, 2, 11, 12],
  lowSeasonMultiplier: 0.8,
  includePublicHolidays: false,
  holidayMultiplier: 1.5,
};

const mockSuggestions: SeasonalSuggestionsResponse = {
  isEnabled: true,
  currentBasePrice: 180,
  computedAt: '2026-05-11T02:00:00Z',
  nextRunOn: '2026-05-12',
  items: [{ date: '2026-06-01', basePrice: 180, suggestedPrice: 234, multiplier: 1.3, rule: 'HighSeason', holiday: null }],
};

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePricingAdapterConfig', () => {
  it('usePricingAdapterConfig_PropertyId_FetchesConfig', async () => {
    vi.mocked(pricingAdapterApi.getConfig).mockResolvedValueOnce(mockConfig);

    const { result } = renderHook(() => usePricingAdapterConfig(PROPERTY_ID), { wrapper: wrapperFor(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.getConfig).toHaveBeenCalledWith(PROPERTY_ID);
    expect(result.current.data).toEqual(mockConfig);
  });

  it('usePricingAdapterConfig_EmptyPropertyId_DoesNotFetch', () => {
    const { result } = renderHook(() => usePricingAdapterConfig(''), { wrapper: wrapperFor(makeClient()) });

    expect(result.current.fetchStatus).toBe('idle');
    expect(pricingAdapterApi.getConfig).not.toHaveBeenCalled();
  });

  it('usePricingAdapterConfig_RequestFails_ReportsErrorInsteadOfDefaults', async () => {
    vi.mocked(pricingAdapterApi.getConfig).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePricingAdapterConfig(PROPERTY_ID), { wrapper: wrapperFor(makeClient()) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useSeasonalSuggestions', () => {
  it('useSeasonalSuggestions_PropertyId_FetchesSuggestions', async () => {
    vi.mocked(pricingAdapterApi.getSuggestions).mockResolvedValueOnce(mockSuggestions);

    const { result } = renderHook(() => useSeasonalSuggestions(PROPERTY_ID), { wrapper: wrapperFor(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('useSeasonalSuggestions_RequestFails_IsErrorNotEmptyList', async () => {
    vi.mocked(pricingAdapterApi.getSuggestions).mockRejectedValueOnce(new Error('500'));

    const { result } = renderHook(() => useSeasonalSuggestions(PROPERTY_ID), { wrapper: wrapperFor(makeClient()) });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('useSavePricingAdapterConfig', () => {
  it('useSavePricingAdapterConfig_Success_InvalidatesConfigAndSuggestions', async () => {
    vi.mocked(pricingAdapterApi.saveConfig).mockResolvedValueOnce(mockConfig);
    const client = makeClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useSavePricingAdapterConfig(PROPERTY_ID), { wrapper: wrapperFor(client) });
    await act(async () => {
      result.current.mutate(request);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.saveConfig).toHaveBeenCalledWith(PROPERTY_ID, request);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pricing-adapter', 'suggestions', PROPERTY_ID] });
  });
});

describe('useDisablePricingAdapter', () => {
  it('useDisablePricingAdapter_Mutate_CallsDisable', async () => {
    vi.mocked(pricingAdapterApi.disableConfig).mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useDisablePricingAdapter(PROPERTY_ID), { wrapper: wrapperFor(makeClient()) });
    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(pricingAdapterApi.disableConfig).toHaveBeenCalledWith(PROPERTY_ID);
  });

  it('useDisablePricingAdapter_Error_RollsBackOptimisticUpdate', async () => {
    const client = makeClient();
    client.setQueryData(['pricing-adapter', 'config', PROPERTY_ID], mockConfig);
    vi.mocked(pricingAdapterApi.disableConfig).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useDisablePricingAdapter(PROPERTY_ID), { wrapper: wrapperFor(client) });
    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData(['pricing-adapter', 'config', PROPERTY_ID])).toEqual(mockConfig);
  });
});

describe('useRecalculateSuggestions', () => {
  it('useRecalculateSuggestions_Computed_RefreshesSuggestionsAndConfirms', async () => {
    vi.mocked(pricingAdapterApi.recalculate).mockResolvedValueOnce({ status: 'Computed', days: 90, computedAt: '2026-05-11T10:00:00Z' });
    const client = makeClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useRecalculateSuggestions(PROPERTY_ID), { wrapper: wrapperFor(client) });
    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['pricing-adapter', 'suggestions', PROPERTY_ID] });
    expect(toast.success).toHaveBeenCalled();
  });

  it('useRecalculateSuggestions_BasePriceMissing_Warns', async () => {
    vi.mocked(pricingAdapterApi.recalculate).mockResolvedValueOnce({ status: 'BasePriceMissing', days: 0, computedAt: null });

    const { result } = renderHook(() => useRecalculateSuggestions(PROPERTY_ID), { wrapper: wrapperFor(makeClient()) });
    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.warning).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
