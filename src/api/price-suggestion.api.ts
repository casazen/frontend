import { ApiClient } from './client';
import type { PricePositioning, PriceSuggestion, PriceSuggestionAvailability } from '@/types';

const path = (propertyId: string) => `/properties/${propertyId}/price-suggestion`;

export const priceSuggestionApi = {
  getAvailability: (propertyId: string) => ApiClient.get<PriceSuggestionAvailability>(path(propertyId)),

  suggest: (propertyId: string, positioning: PricePositioning) =>
    ApiClient.post<PriceSuggestion>(path(propertyId), { positioning }, { timeout: 120_000 }),
};
