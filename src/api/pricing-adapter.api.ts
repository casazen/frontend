import { ApiClient } from './client';
import type {
  PricingAdapterConfig,
  RecalculateSuggestionsResponse,
  SavePricingAdapterConfigRequest,
  SeasonalSuggestionsResponse,
} from '@/types';

const BASE = '/pricing-adapter';

/** Seasonal price suggestions ("Suggerimenti stagionali") of a property. */
export const pricingAdapterApi = {
  saveConfig: (propertyId: string, data: SavePricingAdapterConfigRequest) =>
    ApiClient.post<PricingAdapterConfig>(`${BASE}/config/${propertyId}`, data),

  /** The backend answers the example rule (disabled) when the property has no configuration yet. */
  getConfig: (propertyId: string) =>
    ApiClient.get<PricingAdapterConfig>(`${BASE}/config/${propertyId}`),

  disableConfig: (propertyId: string) =>
    ApiClient.delete<void>(`${BASE}/config/${propertyId}`),

  getSuggestions: (propertyId: string) =>
    ApiClient.get<SeasonalSuggestionsResponse>(`${BASE}/suggestions/${propertyId}`),

  recalculate: (propertyId: string) =>
    ApiClient.post<RecalculateSuggestionsResponse>(`${BASE}/recalculate/${propertyId}`),
};
