import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { otaApi } from '@/api/ota.api';
import type {
  CreateOtaIntegrationDto,
  UpdateOtaIntegrationDto,
  OtaPlatform,
  OtaPricingUpdate,
} from '@/types';
import { toast } from 'sonner';

const OTA_KEY = 'ota';

export function useOtaIntegrations(params?: Record<string, any>) {
  return useQuery({
    queryKey: [OTA_KEY, params],
    queryFn: () => otaApi.getAll(params),
  });
}

export function useOtaIntegration(id: string) {
  return useQuery({
    queryKey: [OTA_KEY, id],
    queryFn: () => otaApi.getById(id),
    enabled: !!id,
  });
}

export function useOtaStatus() {
  return useQuery({
    queryKey: [OTA_KEY, 'status'],
    queryFn: () => otaApi.getStatus(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useCreateOtaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOtaIntegrationDto) => otaApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      toast.success('OTA integration created successfully');
    },
    onError: () => {
      toast.error('Failed to create OTA integration');
    },
  });
}

export function useUpdateOtaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateOtaIntegrationDto }) =>
      otaApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      queryClient.invalidateQueries({ queryKey: [OTA_KEY, variables.id] });
      toast.success('OTA integration updated successfully');
    },
    onError: () => {
      toast.error('Failed to update OTA integration');
    },
  });
}

export function useDeleteOtaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => otaApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      toast.success('OTA integration deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete OTA integration');
    },
  });
}

export function useSyncAllOta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => otaApi.syncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('OTA sync completed successfully');
    },
    onError: () => {
      toast.error('Failed to sync OTA platforms');
    },
  });
}

export function useSyncOtaPlatform() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (platform: OtaPlatform) => otaApi.syncPlatform(platform),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Platform synced successfully');
    },
    onError: () => {
      toast.error('Failed to sync platform');
    },
  });
}

export function useUpdateOtaPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OtaPricingUpdate) => otaApi.updatePricing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      toast.success('Pricing updated on OTA platforms');
    },
    onError: () => {
      toast.error('Failed to update pricing');
    },
  });
}

export function useValidateOta() {
  return useMutation({
    mutationFn: (id: string) => otaApi.validate(id),
    onSuccess: (data) => {
      if (data.isValid) {
        toast.success('OTA credentials validated successfully');
      } else {
        toast.error(`Validation failed: ${data.errors?.join(', ')}`);
      }
    },
    onError: () => {
      toast.error('Failed to validate OTA credentials');
    },
  });
}
