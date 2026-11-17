import { ApiClient } from './client';
import type { PricePositioning, PriceSuggestion, PriceSuggestionAvailability } from '@/types';

const path = (propertyId: string) => `/properties/${propertyId}/price-suggestion`;

/** «Calcola con l'AI» of the step «Prezzi» of the property wizard (WIZ-AI-PRICE). */
export const priceSuggestionApi = {
  /** Whether an AI is in effect on the platform: the card is offered only when it is. A cheap read. */
  getAvailability: (propertyId: string) => ApiClient.get<PriceSuggestionAvailability>(path(propertyId)),

  /** The AI proposes the price of the saved property; it is a `200` also when the AI cannot be used (`aiUsed` false and the reason). */
  suggest: (propertyId: string, positioning: PricePositioning) =>
    // The provider's bounded long-call may take 90s; leave time to return its explicit fallback.
    ApiClient.post<PriceSuggestion>(path(propertyId), { positioning }, { timeout: 120_000 }),
};
