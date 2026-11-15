import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { biometricSettingsApi } from '@/api/biometric-settings.api';
import i18n from '@/i18n/config';
import { retryTransientErrors } from '@/lib/query-client';
import type { UpdateBiometricSettingsRequest } from '@/types/biometric-settings.types';

export const BIOMETRIC_SETTINGS_QUERY_KEY = ['org-settings', 'biometrics'] as const;
const BIOMETRIC_MODELS_QUERY_KEY = ['admin', 'biometrics', 'status'] as const;

/**
 * The identity verification settings of the caller's org (E22/F02/US01/T02). Only the org billing administrator reads them (403 otherwise) and only while the flag is on (404), hence
 * `enabled`. Read again whenever the page opens: another administrator may have changed them, and the card shows what the server holds.
 */
export function useBiometricSettings(enabled: boolean) {
  return useQuery({
    queryKey: BIOMETRIC_SETTINGS_QUERY_KEY,
    queryFn: () => biometricSettingsApi.get(),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/**
 * Saves the settings. What the server refused (422 with the code of the bound that failed) is not said here: the card tells it next to the boxes, from the error of the mutation, and nothing
 * was saved. The answer is the settings in force, and replaces what the card shows.
 */
export function useUpdateBiometricSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: UpdateBiometricSettingsRequest) => biometricSettingsApi.update(request),
    onSuccess: (settings) => {
      queryClient.setQueryData(BIOMETRIC_SETTINGS_QUERY_KEY, settings);
      toast.success(i18n.t('biometricSettings.saved'));
    },
  });
}

/** The models of the verification as platform administrators see them: asked only for them (`enabled`), read again every time the card opens, never kept once it is closed. */
export function useBiometricModelsStatus(enabled: boolean) {
  return useQuery({
    queryKey: BIOMETRIC_MODELS_QUERY_KEY,
    queryFn: () => biometricSettingsApi.getModelsStatus(),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}
