import { useMutation, useQuery } from '@tanstack/react-query';
import { priceSuggestionApi } from '@/api/price-suggestion.api';
import type { PricePositioning } from '@/types';

const PRICE_SUGGESTION_KEY = 'price-suggestion';

export function usePriceSuggestionAvailability(propertyId: string | undefined) {
  return useQuery({
    queryKey: [PRICE_SUGGESTION_KEY, 'availability', propertyId],
    queryFn: () => priceSuggestionApi.getAvailability(propertyId!),
    enabled: Boolean(propertyId),
  });
}

export function useSuggestPrice(propertyId: string) {
  return useMutation({
    mutationFn: (positioning: PricePositioning) => priceSuggestionApi.suggest(propertyId, positioning),
  });
}
