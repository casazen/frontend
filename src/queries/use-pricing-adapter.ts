import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricingAdapterApi } from '@/api/pricing-adapter.api';
import type { SavePricingAdapterConfigRequest, PricingAdapterConfig } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const PRICING_KEY = 'pricing-adapter';

export function usePricingAdapterConfig(propertyId: string) {
  return useQuery({
    queryKey: [PRICING_KEY, 'config', propertyId],
    queryFn: () => pricingAdapterApi.getConfig(propertyId),
    enabled: !!propertyId,
  });
}

export function useSeasonalSuggestions(propertyId: string) {
  return useQuery({
    queryKey: [PRICING_KEY, 'suggestions', propertyId],
    queryFn: () => pricingAdapterApi.getSuggestions(propertyId),
    enabled: !!propertyId,
  });
}

function invalidatePricing(queryClient: ReturnType<typeof useQueryClient>, propertyId: string) {
  queryClient.invalidateQueries({ queryKey: [PRICING_KEY, 'config', propertyId] });
  queryClient.invalidateQueries({ queryKey: [PRICING_KEY, 'suggestions', propertyId] });
}

export function useSavePricingAdapterConfig(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SavePricingAdapterConfigRequest) =>
      pricingAdapterApi.saveConfig(propertyId, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: [PRICING_KEY, 'config', propertyId] });
      const previous = queryClient.getQueryData([PRICING_KEY, 'config', propertyId]);
      queryClient.setQueryData<PricingAdapterConfig>([PRICING_KEY, 'config', propertyId], (old) =>
        old ? { ...old, ...data } : old
      );
      return { previous };
    },
    onError: (error, _data, context) => {
      queryClient.setQueryData([PRICING_KEY, 'config', propertyId], context?.previous);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.pricingConfigSaveFailed'));
    },
    onSuccess: () => {
      invalidatePricing(queryClient, propertyId);
      toast.success(i18n.t('toast.pricingConfigSaved'));
    },
  });
}

export function useDisablePricingAdapter(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pricingAdapterApi.disableConfig(propertyId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [PRICING_KEY, 'config', propertyId] });
      const previous = queryClient.getQueryData([PRICING_KEY, 'config', propertyId]);
      queryClient.setQueryData<PricingAdapterConfig>([PRICING_KEY, 'config', propertyId], (old) =>
        old ? { ...old, isEnabled: false } : old
      );
      return { previous };
    },
    onError: (error, _data, context) => {
      queryClient.setQueryData([PRICING_KEY, 'config', propertyId], context?.previous);
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.pricingDisableFailed'));
    },
    onSuccess: () => {
      invalidatePricing(queryClient, propertyId);
      toast.success(i18n.t('toast.pricingDisabled'));
    },
  });
}

/** Recomputes the suggestions now, with the same logic as the nightly job. */
export function useRecalculateSuggestions(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pricingAdapterApi.recalculate(propertyId),
    onSuccess: (result) => {
      invalidatePricing(queryClient, propertyId);
      if (result.status === 'BasePriceMissing') {
        toast.warning(i18n.t('toast.pricingBasePriceMissing'));
      } else {
        toast.success(i18n.t('toast.pricingRecalculated'));
      }
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.pricingRecalculateFailed'));
    },
  });
}
