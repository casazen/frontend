export type PricePositioning = 'Lower' | 'Market' | 'Higher';

export type PriceSuggestionReason = 'ai_not_configured' | 'ai_budget_exhausted' | 'ai_unavailable' | 'ai_invalid_answer';

type PriceSuggestionField = 'type' | 'guests' | 'bedrooms' | 'beds' | 'bathrooms' | 'area' | 'amenities' | 'setting';

interface PriceSuggestionBasis {
  comune: string | null;
  province: string | null;
  region: string | null;
  similarListings: number;
  amenities: number;
  usedFields: PriceSuggestionField[];
}

/**
 * The answer of `POST /api/properties/{id}/price-suggestion`. It is a `200` also when the AI cannot be used: `aiUsed` is then false
 * with the `reason`, and `nightlyRate` is the price of the similar homes alone when there are enough of them, `null` otherwise.
 */
export interface PriceSuggestion {
  aiUsed: boolean;
  currency?: string;
  reason: PriceSuggestionReason | null;
  nightlyRate: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
  cleaningFee: number | null;
  weekendSurchargePercent: number | null;
  minNights: number | null;
  rationale: string | null;
  basedOn: PriceSuggestionBasis;
}

export interface PriceSuggestionAvailability {
  available: boolean;
}
