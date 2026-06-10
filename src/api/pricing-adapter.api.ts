import { isAxiosError } from 'axios';
import { ApiClient } from './client';
import type {
  PricingAdapterConfig,
  SavePricingAdapterConfigRequest,
  PricingHistoryPagedResponse,
  PricingHistoryQueryParams,
  PricingPreviewResponse,
  TriggerSyncResponse,
} from '@/types';

const BASE = '/pricing-adapter';

async function nullOn404<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

export const pricingAdapterApi = {
  saveConfig: (propertyId: string, data: SavePricingAdapterConfigRequest) =>
    ApiClient.post<PricingAdapterConfig>(`${BASE}/config/${propertyId}`, data),

  getConfig: (propertyId: string) =>
    nullOn404(() => ApiClient.get<PricingAdapterConfig>(`${BASE}/config/${propertyId}`)),

  disableConfig: (propertyId: string) =>
    ApiClient.delete<void>(`${BASE}/config/${propertyId}`),

  getHistory: (propertyId: string, params?: PricingHistoryQueryParams) =>
    nullOn404(() =>
      ApiClient.get<PricingHistoryPagedResponse>(`${BASE}/history/${propertyId}`, params)
    ),

  triggerSync: (propertyId: string) =>
    ApiClient.post<TriggerSyncResponse>(`${BASE}/sync/${propertyId}`),

  getPreview: (propertyId: string) =>
    nullOn404(() => ApiClient.get<PricingPreviewResponse>(`${BASE}/preview/${propertyId}`)),
};
