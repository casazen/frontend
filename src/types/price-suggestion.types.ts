/**
 * «Calcola con l'AI» of the step «Prezzi» of the wizard «Aggiungi immobile» (WIZ-AI-PRICE): the AI proposes the nightly rate of a
 * property and the prices that go with it. Nothing is written to the property: the host reads it and decides.
 */

/** Where the host wants the price against the comparable homes of the area: the one question of the card. */
export type PricePositioning = 'Lower' | 'Market' | 'Higher';

/** Why the AI is not behind the price: no provider, the monthly budget is used up, it did not answer, its answer was not a price. */
export type PriceSuggestionReason = 'ai_not_configured' | 'ai_budget_exhausted' | 'ai_unavailable' | 'ai_invalid_answer';

/** The facts of the property the AI was told about; what the host did not say is not listed. */
export type PriceSuggestionField = 'type' | 'guests' | 'bedrooms' | 'beds' | 'bathrooms' | 'area' | 'amenities' | 'setting';

/** What a suggestion was written from, for the line «Basato su: …». */
export interface PriceSuggestionBasis {
  /** The comune as the official list names it; `null` when the property has none. */
  comune: string | null;
  province: string | null;
  region: string | null;
  /** Homes published on CasaZen in the same comune whose prices were compared (summed up, never listed); 0 = none. */
  similarListings: number;
  /** Amenities the AI was told about. */
  amenities: number;
  usedFields: PriceSuggestionField[];
}

/**
 * The answer of `POST /api/properties/{id}/price-suggestion`. It is a `200` also when the AI cannot be used: `aiUsed` is then false
 * with the `reason`, and `nightlyRate` is the price of the similar homes alone when there are enough of them, `null` otherwise.
 */
export interface PriceSuggestion {
  aiUsed: boolean;
  reason: PriceSuggestionReason | null;
  /** Euros for a night, a multiple of 5. */
  nightlyRate: number | null;
  /** Low and high end of what homes like this ask in the area. */
  rangeMin: number | null;
  rangeMax: number | null;
  /** Once for each stay; `null` = not suggested. */
  cleaningFee: number | null;
  /** On the nights of Friday and Saturday, in percent; `null` = not suggested. */
  weekendSurchargePercent: number | null;
  /** 2 to 7 nights; `null` = no minimum suggested. */
  minNights: number | null;
  /** Why this price, a few words in the language of the host; only when the AI wrote it. */
  rationale: string | null;
  basedOn: PriceSuggestionBasis;
}

/** The answer of `GET /api/properties/{id}/price-suggestion`: whether an AI is in effect, so the question is offered only where it can work. */
export interface PriceSuggestionAvailability {
  available: boolean;
}
