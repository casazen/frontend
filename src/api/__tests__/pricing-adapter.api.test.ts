import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pricingAdapterApi } from '../pricing-adapter.api';
import { ApiClient } from '../client';
import type { PricingAdapterConfig, PricingHistoryPagedResponse, PricingPreviewResponse } from '@/types';

vi.mock('../client');

const PROPERTY_ID = 'prop-123';

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
  items: [
    {
      id: 'hist-1',
      propertyId: PROPERTY_ID,
      adaptationDate: '2026-05-10T02:00:00Z',
      previousPrice: 100,
      newPrice: 120,
      changeReason: 'Seasonal peak detected',
      aiConfidence: 0.87,
      otasSynced: 'Airbnb,Booking.com',
      syncStatus: 'synced',
      createdAt: '2026-05-10T02:05:00Z',
    },
  ],
  total: 1,
  page: 1,
};

const mockPreview: PricingPreviewResponse = {
  prices: [
    { date: '2026-05-12', suggestedPrice: 115, basePrice: 100, reason: 'Weekend uplift' },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('pricingAdapterApi', () => {
  describe('saveConfig', () => {
    it('calls POST /pricing-adapter/config/:propertyId with request body', async () => {
      vi.mocked(ApiClient.post).mockResolvedValueOnce(mockConfig);
      const req = { isEnabled: true, adaptationFrequency: 'daily' as const, includeSeasonality: true, includePublicHolidays: false };

      const result = await pricingAdapterApi.saveConfig(PROPERTY_ID, req);

      expect(ApiClient.post).toHaveBeenCalledWith(`/pricing-adapter/config/${PROPERTY_ID}`, req);
      expect(result).toEqual(mockConfig);
    });
  });

  describe('getConfig', () => {
    it('calls GET /pricing-adapter/config/:propertyId', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockConfig);

      const result = await pricingAdapterApi.getConfig(PROPERTY_ID);

      expect(ApiClient.get).toHaveBeenCalledWith(`/pricing-adapter/config/${PROPERTY_ID}`);
      expect(result).toEqual(mockConfig);
    });
  });

  describe('disableConfig', () => {
    it('calls DELETE /pricing-adapter/config/:propertyId', async () => {
      vi.mocked(ApiClient.delete).mockResolvedValueOnce(undefined);

      await pricingAdapterApi.disableConfig(PROPERTY_ID);

      expect(ApiClient.delete).toHaveBeenCalledWith(`/pricing-adapter/config/${PROPERTY_ID}`);
    });
  });

  describe('getHistory', () => {
    it('calls GET /pricing-adapter/history/:propertyId without params', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockHistory);

      const result = await pricingAdapterApi.getHistory(PROPERTY_ID);

      expect(ApiClient.get).toHaveBeenCalledWith(`/pricing-adapter/history/${PROPERTY_ID}`, undefined);
      expect(result).not.toBeNull();
      expect(result!.items).toHaveLength(1);
      expect(result!.total).toBe(1);
    });

    it('forwards pagination params to GET /pricing-adapter/history/:propertyId', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockHistory);
      const params = { page: 2, pageSize: 20, from: '2026-01-01' };

      await pricingAdapterApi.getHistory(PROPERTY_ID, params);

      expect(ApiClient.get).toHaveBeenCalledWith(`/pricing-adapter/history/${PROPERTY_ID}`, params);
    });
  });

  describe('triggerSync', () => {
    it('calls POST /pricing-adapter/sync/:propertyId and returns jobId', async () => {
      vi.mocked(ApiClient.post).mockResolvedValueOnce({ jobId: 'job-abc' });

      const result = await pricingAdapterApi.triggerSync(PROPERTY_ID);

      expect(ApiClient.post).toHaveBeenCalledWith(`/pricing-adapter/sync/${PROPERTY_ID}`);
      expect(result.jobId).toBe('job-abc');
    });
  });

  describe('getPreview', () => {
    it('calls GET /pricing-adapter/preview/:propertyId', async () => {
      vi.mocked(ApiClient.get).mockResolvedValueOnce(mockPreview);

      const result = await pricingAdapterApi.getPreview(PROPERTY_ID);

      expect(ApiClient.get).toHaveBeenCalledWith(`/pricing-adapter/preview/${PROPERTY_ID}`);
      expect(result).not.toBeNull();
      expect(result!.prices).toHaveLength(1);
      expect(result!.prices[0].date).toBe('2026-05-12');
    });
  });
});
