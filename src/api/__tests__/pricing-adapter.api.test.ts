import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pricingAdapterApi } from '../pricing-adapter.api';
import { ApiClient } from '../client';
import type { PricingAdapterConfig, SavePricingAdapterConfigRequest, SeasonalSuggestionsResponse } from '@/types';

vi.mock('../client');

const PROPERTY_ID = 'prop-123';

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
  lastAdaptedAt: '2026-05-11T02:00:00Z',
  nextRunOn: '2026-05-12',
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pricingAdapterApi', () => {
  it('saveConfig_Request_PostsRulesToConfigEndpoint', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce(mockConfig);

    const result = await pricingAdapterApi.saveConfig(PROPERTY_ID, request);

    expect(ApiClient.post).toHaveBeenCalledWith(`/pricing-adapter/config/${PROPERTY_ID}`, request);
    expect(result).toEqual(mockConfig);
  });

  it('getConfig_PropertyId_GetsConfigEndpoint', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(mockConfig);

    const result = await pricingAdapterApi.getConfig(PROPERTY_ID);

    expect(ApiClient.get).toHaveBeenCalledWith(`/pricing-adapter/config/${PROPERTY_ID}`);
    expect(result).toEqual(mockConfig);
  });

  it('getConfig_RequestFails_PropagatesTheError', async () => {
    vi.mocked(ApiClient.get).mockRejectedValueOnce(new Error('404'));

    await expect(pricingAdapterApi.getConfig(PROPERTY_ID)).rejects.toThrow('404');
  });

  it('disableConfig_PropertyId_DeletesConfig', async () => {
    vi.mocked(ApiClient.delete).mockResolvedValueOnce(undefined);

    await pricingAdapterApi.disableConfig(PROPERTY_ID);

    expect(ApiClient.delete).toHaveBeenCalledWith(`/pricing-adapter/config/${PROPERTY_ID}`);
  });

  it('getSuggestions_PropertyId_GetsSuggestionsEndpoint', async () => {
    vi.mocked(ApiClient.get).mockResolvedValueOnce(mockSuggestions);

    const result = await pricingAdapterApi.getSuggestions(PROPERTY_ID);

    expect(ApiClient.get).toHaveBeenCalledWith(`/pricing-adapter/suggestions/${PROPERTY_ID}`);
    expect(result.items[0].suggestedPrice).toBe(234);
  });

  it('recalculate_PropertyId_PostsRecalculateEndpoint', async () => {
    vi.mocked(ApiClient.post).mockResolvedValueOnce({ status: 'Computed', days: 90, computedAt: '2026-05-11T10:00:00Z' });

    const result = await pricingAdapterApi.recalculate(PROPERTY_ID);

    expect(ApiClient.post).toHaveBeenCalledWith(`/pricing-adapter/recalculate/${PROPERTY_ID}`);
    expect(result.days).toBe(90);
  });
});
