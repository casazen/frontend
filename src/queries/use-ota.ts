import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { otaApi } from '@/api/ota.api';
import type {
  CreateOtaIntegrationDto,
  UpdateOtaIntegrationDto,
  OtaPlatform,
  OtaPricingUpdate,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

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
      toast.success(i18n.t('toast.otaIntegrationCreated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.otaIntegrationCreateFailed'));
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
      toast.success(i18n.t('toast.otaIntegrationUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.otaIntegrationUpdateFailed'));
    },
  });
}

export function useDeleteOtaIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => otaApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      toast.success(i18n.t('toast.otaIntegrationDeleted'));
    },
    onError: () => {
      toast.error(i18n.t('toast.otaIntegrationDeleteFailed'));
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
      toast.success(i18n.t('toast.otaSyncCompleted'));
    },
    onError: () => {
      toast.error(i18n.t('toast.otaSyncFailed'));
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
      toast.success(i18n.t('toast.otaPlatformSynced'));
    },
    onError: () => {
      toast.error(i18n.t('toast.otaPlatformSyncFailed'));
    },
  });
}

export function useUpdateOtaPricing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OtaPricingUpdate) => otaApi.updatePricing(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [OTA_KEY] });
      toast.success(i18n.t('toast.otaPricingUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.otaPricingUpdateFailed'));
    },
  });
}

export function useValidateOta() {
  return useMutation({
    mutationFn: (id: string) => otaApi.validate(id),
    onSuccess: (data) => {
      if (data.isValid) {
        toast.success(i18n.t('toast.otaCredentialsValidated'));
      } else {
        toast.error(i18n.t('toast.otaValidationFailed', { errors: data.errors?.join(', ') ?? '' }));
      }
    },
    onError: () => {
      toast.error(i18n.t('toast.otaCredentialsValidationFailed'));
    },
  });
}
