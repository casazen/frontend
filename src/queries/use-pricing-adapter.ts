import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricingAdapterApi } from '@/api/pricing-adapter.api';
import type {
  SavePricingAdapterConfigRequest,
  PricingHistoryQueryParams,
  PricingAdapterConfig,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const PRICING_KEY = 'pricing-adapter';

export function defaultPricingConfig(propertyId: string): PricingAdapterConfig {
  return {
    propertyId,
    isEnabled: false,
    adaptationFrequency: 'daily',
    includeSeasonality: true,
    includePublicHolidays: true,
    lastAdaptedAt: null,
    nextScheduledRunAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function usePricingAdapterConfig(propertyId: string) {
  return useQuery({
    queryKey: [PRICING_KEY, 'config', propertyId],
    queryFn: async () => {
      const config = await pricingAdapterApi.getConfig(propertyId);
      return config ?? defaultPricingConfig(propertyId);
    },
    enabled: !!propertyId,
  });
}

export function useSavePricingAdapterConfig(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SavePricingAdapterConfigRequest) =>
      pricingAdapterApi.saveConfig(propertyId, data),
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: [PRICING_KEY, 'config', propertyId] });
      const previous = queryClient.getQueryData([PRICING_KEY, 'config', propertyId]);
      queryClient.setQueryData([PRICING_KEY, 'config', propertyId], (old: any) =>
        old ? { ...old, ...data } : old
      );
      return { previous };
    },
    onError: (_err, _data, context) => {
      queryClient.setQueryData([PRICING_KEY, 'config', propertyId], context?.previous);
      toast.error(i18n.t('toast.pricingConfigSaveFailed'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRICING_KEY, 'config', propertyId] });
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
      queryClient.setQueryData([PRICING_KEY, 'config', propertyId], (old: any) =>
        old ? { ...old, isEnabled: false } : old
      );
      return { previous };
    },
    onError: (_err, _data, context) => {
      queryClient.setQueryData([PRICING_KEY, 'config', propertyId], context?.previous);
      toast.error(i18n.t('toast.pricingDisableFailed'));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRICING_KEY, 'config', propertyId] });
      toast.success(i18n.t('toast.pricingDisabled'));
    },
  });
}

export function usePricingHistory(propertyId: string, params?: PricingHistoryQueryParams) {
  return useQuery({
    queryKey: [PRICING_KEY, 'history', propertyId, params],
    queryFn: async () => {
      const history = await pricingAdapterApi.getHistory(propertyId, params);
      return history ?? { items: [], total: 0, page: params?.page ?? 1 };
    },
    enabled: !!propertyId,
  });
}

export function useTriggerPricingSync(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => pricingAdapterApi.triggerSync(propertyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRICING_KEY, 'history', propertyId] });
      toast.success(i18n.t('toast.pricingSyncStarted'));
    },
    onError: () => {
      toast.error(i18n.t('toast.pricingSyncFailed'));
    },
  });
}

export function usePricingPreview(propertyId: string) {
  return useQuery({
    queryKey: [PRICING_KEY, 'preview', propertyId],
    queryFn: async () => {
      const preview = await pricingAdapterApi.getPreview(propertyId);
      return preview ?? { prices: [] };
    },
    enabled: !!propertyId,
  });
}
