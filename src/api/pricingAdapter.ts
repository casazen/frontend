import { ApiClient } from './client';
import type {
  PricingAdapterConfigDto,
  CreateOrUpdatePricingAdapterConfigRequest,
  PricingHistoryPageDto,
  PricingHistoryFilters,
  PricingPreviewDto,
} from '@/types/pricing';

const BASE = '/pricing-adapter';

export function createOrUpdatePricingAdapterConfig(
  propertyId: string,
  config: CreateOrUpdatePricingAdapterConfigRequest
): Promise<PricingAdapterConfigDto> {
  return ApiClient.post<PricingAdapterConfigDto>(`${BASE}/config/${propertyId}`, config);
}

export function getPricingAdapterConfig(
  propertyId: string
): Promise<PricingAdapterConfigDto> {
  return ApiClient.get<PricingAdapterConfigDto>(`${BASE}/config/${propertyId}`);
}

export function deletePricingAdapterConfig(
  propertyId: string
): Promise<void> {
  return ApiClient.delete<void>(`${BASE}/config/${propertyId}`);
}

export function getPricingHistory(
  propertyId: string,
  filters?: PricingHistoryFilters
): Promise<PricingHistoryPageDto> {
  return ApiClient.get<PricingHistoryPageDto>(`${BASE}/history/${propertyId}`, filters);
}

export function triggerPricingSync(
  propertyId: string
): Promise<{ jobId: string }> {
  return ApiClient.post<{ jobId: string }>(`${BASE}/sync/${propertyId}`);
}

export function getPricingPreview(
  propertyId: string
): Promise<PricingPreviewDto> {
  return ApiClient.get<PricingPreviewDto>(`${BASE}/preview/${propertyId}`);
}
