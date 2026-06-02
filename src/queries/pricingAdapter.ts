import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getPricingAdapterConfig,
  createOrUpdatePricingAdapterConfig,
  deletePricingAdapterConfig,
  getPricingHistory,
  triggerPricingSync,
  getPricingPreview,
} from '@/api/pricingAdapter';
import type {
  CreateOrUpdatePricingAdapterConfigRequest,
  PricingAdapterConfigDto,
  PricingHistoryFilters,
} from '@/types/pricing';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const pricingAdapterKeys = {
  all: ['pricing-adapter'] as const,
  config: (propertyId: string) =>
    [...pricingAdapterKeys.all, 'config', propertyId] as const,
  history: (propertyId: string, filters?: PricingHistoryFilters) =>
    [...pricingAdapterKeys.all, 'history', propertyId, filters] as const,
  preview: (propertyId: string) =>
    [...pricingAdapterKeys.all, 'preview', propertyId] as const,
};

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function usePricingAdapterConfig(propertyId: string) {
  return useQuery({
    queryKey: pricingAdapterKeys.config(propertyId),
    queryFn: () => getPricingAdapterConfig(propertyId),
    enabled: !!propertyId,
  });
}

export function usePricingHistory(
  propertyId: string,
  filters?: PricingHistoryFilters
) {
  return useQuery({
    queryKey: pricingAdapterKeys.history(propertyId, filters),
    queryFn: () => getPricingHistory(propertyId, filters),
    enabled: !!propertyId,
  });
}

export function usePricingPreview(propertyId: string) {
  return useQuery({
    queryKey: pricingAdapterKeys.preview(propertyId),
    queryFn: () => getPricingPreview(propertyId),
    enabled: !!propertyId,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useUpdatePricingAdapterConfig(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrUpdatePricingAdapterConfigRequest) =>
      createOrUpdatePricingAdapterConfig(propertyId, data),

    // Optimistic update — immediately reflect the new values (especially isEnabled toggle)
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: pricingAdapterKeys.config(propertyId) });

      const previous = queryClient.getQueryData<PricingAdapterConfigDto>(
        pricingAdapterKeys.config(propertyId)
      );

      queryClient.setQueryData<PricingAdapterConfigDto>(
        pricingAdapterKeys.config(propertyId),
        (old) => (old ? { ...old, ...data } : old)
      );

      return { previous };
    },

    onError: (_err, _data, context) => {
      // Roll back to the previous value on error
      if (context?.previous !== undefined) {
        queryClient.setQueryData(
          pricingAdapterKeys.config(propertyId),
          context.previous
        );
      }
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingAdapterKeys.config(propertyId) });
    },
  });
}

export function useDisablePricingAdapter(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => deletePricingAdapterConfig(propertyId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: pricingAdapterKeys.config(propertyId) });

      const previous = queryClient.getQueryData<PricingAdapterConfigDto>(
        pricingAdapterKeys.config(propertyId)
      );

      queryClient.setQueryData<PricingAdapterConfigDto>(
        pricingAdapterKeys.config(propertyId),
        (old) => (old ? { ...old, isEnabled: false } : old)
      );

      return { previous };
    },
    onError: (_err, _data, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(pricingAdapterKeys.config(propertyId), context.previous);
      }
      toast.error('Failed to disable AI pricing');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingAdapterKeys.config(propertyId) });
      toast.success('AI pricing disabled');
    },
  });
}

export function useTriggerPricingSync(propertyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => triggerPricingSync(propertyId),
    onError: () => {
      toast.error('Failed to trigger pricing sync');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricingAdapterKeys.history(propertyId) });
      toast.success('Pricing sync started — history will update shortly');
    },
  });
}
