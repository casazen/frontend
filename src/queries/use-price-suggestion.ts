import { useMutation, useQuery } from '@tanstack/react-query';
import { priceSuggestionApi } from '@/api/price-suggestion.api';
import type { PricePositioning } from '@/types';

const PRICE_SUGGESTION_KEY = 'price-suggestion';

/**
 * Whether an AI is in effect on the platform (WIZ-AI-PRICE): the question «Vuoi che calcoli io il prezzo con l'AI?» is offered only
 * where it can work. A failed read is no answer: the card stays out of the way and the step is the one it always was.
 */
export function usePriceSuggestionAvailability(propertyId: string | undefined) {
  return useQuery({
    queryKey: [PRICE_SUGGESTION_KEY, 'availability', propertyId],
    queryFn: () => priceSuggestionApi.getAvailability(propertyId!),
    enabled: Boolean(propertyId),
  });
}

/**
 * Asks the AI for the price of the saved property. No toast: the card shows the answer, or the reason there is none, where the host
 * is looking.
 */
export function useSuggestPrice(propertyId: string) {
  return useMutation({
    mutationFn: (positioning: PricePositioning) => priceSuggestionApi.suggest(propertyId, positioning),
  });
}
