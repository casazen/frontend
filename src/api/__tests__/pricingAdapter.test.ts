import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createOrUpdatePricingAdapterConfig,
  getPricingAdapterConfig,
  deletePricingAdapterConfig,
  getPricingHistory,
  triggerPricingSync,
  getPricingPreview,
} from '../pricingAdapter';
import { ApiClient } from '../client';
import type {
  PricingAdapterConfigDto,
  PricingHistoryPageDto,
  PricingPreviewDto,
} from '@/types/pricing';

vi.mock('../client');

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pricingAdapter API client', () => {
  describe('createOrUpdatePricingAdapterConfig', () => {
    it('calls POST /pricing-adapter/config/:propertyId with request body', async () => {
      vi.mocked(ApiClient.post).mockResolvedValueOnce(mockConfig);
      const req = {
        isEnabled: true,
        adaptationFrequency: 'daily' as const,
        includeSeasonality: true,
        includePublicHolidays: false,
      };

      const result = await createOrUpdatePricingAdapterConfig(PROPERTY_ID, req);

      expect(ApiClient.post).toHaveBeenCalledWith(
        `/pricing-adapter/config/${PROPERTY_ID}`,
        req
      );
      expect(result).toEqual(mockConfig);
    });
  });

  describe('getPricingAdapterConfig', () => {
    it('calls GET /pricing-adapter/config/:propertyId', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockConfig);

      const result = await getPricingAdapterConfig(PROPERTY_ID);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/pricing-adapter/config/${PROPERTY_ID}`
      );
      expect(result).toEqual(mockConfig);
    });
  });

  describe('deletePricingAdapterConfig', () => {
    it('calls DELETE /pricing-adapter/config/:propertyId and returns void', async () => {
      vi.mocked(ApiClient.delete).mockResolvedValueOnce(undefined);

      await deletePricingAdapterConfig(PROPERTY_ID);

      expect(ApiClient.delete).toHaveBeenCalledWith(
        `/pricing-adapter/config/${PROPERTY_ID}`
      );
    });
  });

  describe('getPricingHistory', () => {
    it('calls GET /pricing-adapter/history/:propertyId without filters', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockHistory);

      const result = await getPricingHistory(PROPERTY_ID);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/pricing-adapter/history/${PROPERTY_ID}`,
        undefined
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('forwards filter params to GET /pricing-adapter/history/:propertyId', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockHistory);
      const filters = { page: 2, pageSize: 20, from: '2026-01-01', to: '2026-05-01' };

      await getPricingHistory(PROPERTY_ID, filters);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/pricing-adapter/history/${PROPERTY_ID}`,
        filters
      );
    });
  });

  describe('triggerPricingSync', () => {
    it('calls POST /pricing-adapter/sync/:propertyId and returns jobId', async () => {
      vi.mocked(ApiClient.post).mockResolvedValueOnce({ jobId: 'job-abc' });

      const result = await triggerPricingSync(PROPERTY_ID);

      expect(ApiClient.post).toHaveBeenCalledWith(
        `/pricing-adapter/sync/${PROPERTY_ID}`
      );
      expect(result.jobId).toBe('job-abc');
    });
  });

  describe('getPricingPreview', () => {
    it('calls GET /pricing-adapter/preview/:propertyId', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockPreview);

      const result = await getPricingPreview(PROPERTY_ID);

      expect(ApiClient.get).toHaveBeenCalledWith(
        `/pricing-adapter/preview/${PROPERTY_ID}`
      );
      expect(result.prices).toHaveLength(1);
      expect(result.prices[0].date).toBe('2026-05-12');
    });
  });
});
