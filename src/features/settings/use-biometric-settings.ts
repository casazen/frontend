import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { biometricSettingsApi } from '@/api/biometric-settings.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import i18n from '@/i18n/config';
import { retryTransientErrors } from '@/lib/query-client';
import type {
  CreateIdentitySegmentRequest,
  IdentitySegment,
  IdentitySegments,
  UpdateBiometricSettingsRequest,
  UpdateIdentitySegmentRequest,
} from '@/types/biometric-settings.types';
import { withSegment } from './lib/biometric-settings-model';

export const BIOMETRIC_SETTINGS_QUERY_KEY = ['org-settings', 'biometrics'] as const;
const BIOMETRIC_MODELS_QUERY_KEY = ['admin', 'biometrics', 'status'] as const;
/** The segments of the self-hosted verification: a key of their own, so that a read of the settings never touches them (nor the other way round). */
export const IDENTITY_SEGMENTS_QUERY_KEY = ['org-settings', 'biometrics-segments'] as const;
/** Every write of the card carries this key, so that the card knows when ANY of them is in flight (`useBiometricCardBusy`). */
const BIOMETRIC_MUTATION_KEY = ['org-settings', 'biometrics', 'write'] as const;

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
    mutationKey: BIOMETRIC_MUTATION_KEY,
    mutationFn: (request: UpdateBiometricSettingsRequest) => biometricSettingsApi.update(request),
    onSuccess: (settings) => {
      queryClient.setQueryData(BIOMETRIC_SETTINGS_QUERY_KEY, settings);
      toast.success(i18n.t('biometricSettings.saved'));
    },
  });
}

/** Any write of the card is in flight (the settings, a new segment, the mode of a segment): every button of the card stays disabled until it ends, so that two writes never cross. */
export function useBiometricCardBusy(): boolean {
  return useIsMutating({ mutationKey: BIOMETRIC_MUTATION_KEY }) > 0;
}

/**
 * The segments of the self-hosted verification of the caller's org (E70/F03/US01/T02, NF-194). Only the org billing administrator reads them (403 otherwise) and only while both flags are on (404), hence `enabled`.
 * Read again whenever the card opens: another administrator may have changed a segment, and a platform administrator may have qualified one.
 */
export function useIdentitySegments(enabled: boolean) {
  return useQuery({
    queryKey: IDENTITY_SEGMENTS_QUERY_KEY,
    queryFn: () => biometricSettingsApi.getSegments(),
    enabled,
    staleTime: 0,
    refetchOnMount: 'always',
    retry: retryTransientErrors(1),
  });
}

/** The list the answer of a write goes into: the segment replaces the one it changed, or is added. A list that was never read is left alone. */
function writeSegment(queryClient: QueryClient, segment: IdentitySegment) {
  queryClient.setQueryData<IdentitySegments>(IDENTITY_SEGMENTS_QUERY_KEY, (current) =>
    current ? { ...current, segments: withSegment(current.segments, segment) } : current,
  );
}

/**
 * A new segment, in observation (one that exists already is answered as it is: the page says so and changes nothing). What the server refused (422 with the code of what is wrong) is told by the card from the error of the
 * mutation. The request holds ids and codes only; the mutation does not outlive the card (`gcTime: 0`) and what it keeps of a failure is the answer without the request.
 */
export function useCreateIdentitySegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: BIOMETRIC_MUTATION_KEY,
    gcTime: 0,
    mutationFn: async (request: CreateIdentitySegmentRequest) => {
      try {
        return await biometricSettingsApi.createSegment(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (segment) => {
      const existed = queryClient.getQueryData<IdentitySegments>(IDENTITY_SEGMENTS_QUERY_KEY)?.segments.some((entry) => entry.id === segment.id) === true;
      writeSegment(queryClient, segment);
      toast.success(existed ? i18n.t('biometricSettings.segments.alreadyThere') : i18n.t('biometricSettings.segments.added'));
    },
  });
}

/**
 * The mode of a segment. The reason of a suspension is the staff's own text: it leaves no trace in the cache of the mutations (`gcTime: 0`, and a failure keeps the answer without the request). What the server refused (422)
 * is told by the card from the error; the segment the answer carries replaces the one that was shown.
 */
export function useSetIdentitySegmentMode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: BIOMETRIC_MUTATION_KEY,
    gcTime: 0,
    mutationFn: async ({ id, request }: { id: string; request: UpdateIdentitySegmentRequest }) => {
      try {
        return await biometricSettingsApi.updateSegment(id, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (segment) => {
      writeSegment(queryClient, segment);
      toast.success(i18n.t('biometricSettings.segments.saved'));
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
