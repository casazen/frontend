import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { otaApi } from '@/api/ota.api';
import type {
  CreateOtaIntegrationDto,
  OtaPlatform,
} from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const OTA_KEY = 'ota';

export function useOtaIntegrations(params?: Record<string, unknown>, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [OTA_KEY, params],
    queryFn: () => otaApi.getAll(params),
    enabled: options?.enabled ?? true,
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
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.otaIntegrationCreateFailed'));
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
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.otaSyncFailed'));
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
      toast.success(i18n.t('toast.platformSynced'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.platformSyncFailed'));
    },
  });
}
