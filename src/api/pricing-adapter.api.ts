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

export const pricingAdapterApi = {
  saveConfig: (propertyId: string, data: SavePricingAdapterConfigRequest) =>
    ApiClient.post<PricingAdapterConfig>(`${BASE}/config/${propertyId}`, data),

  getConfig: (propertyId: string) =>
    ApiClient.get<PricingAdapterConfig>(`${BASE}/config/${propertyId}`),

  disableConfig: (propertyId: string) =>
    ApiClient.delete<void>(`${BASE}/config/${propertyId}`),

  getHistory: (propertyId: string, params?: PricingHistoryQueryParams) =>
    ApiClient.get<PricingHistoryPagedResponse>(`${BASE}/history/${propertyId}`, params),

  triggerSync: (propertyId: string) =>
    ApiClient.post<TriggerSyncResponse>(`${BASE}/sync/${propertyId}`),

  getPreview: (propertyId: string) =>
    ApiClient.get<PricingPreviewResponse>(`${BASE}/preview/${propertyId}`),
};
