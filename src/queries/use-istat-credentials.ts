import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { getProblemMessage } from '@/lib/api-errors';
import type { IstatCredentialsStatus, SetIstatCredentialsRequest } from '@/types/onboarding.types';

const istatCredentialsKey = (propertyId: string) => ['istat-credentials', propertyId] as const;

/**
 * Whether the property has regional ISTAT credentials, and since when (never the values). The endpoint answers 404 while the backend flag `OctorateOnboarding` is off, so a
 * screen that may show up with the flag off passes `enabled: false` and asks nothing.
 */
export function useIstatCredentialsStatus(propertyId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: istatCredentialsKey(propertyId),
    queryFn: () => onboardingAssistApi.getIstatCredentialsStatus(propertyId),
    enabled: !!propertyId && (options?.enabled ?? true),
  });
}

/**
 * Sets or replaces the ISTAT credentials of the property. Write-only, like the police ones: the body is the user name and the password of the portal, so the mutation is
 * dropped as soon as nothing observes it (`gcTime: 0`, not five minutes in the cache of the mutations) and a refusal is kept without the request that was sent
 * (`withoutRequest`: the status and the body of the answer stay, which is what the toast says). The screen empties its fields once the server has them.
 */
export function useSetIstatCredentials(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (data: SetIstatCredentialsRequest) => {
      try {
        return await onboardingAssistApi.setIstatCredentials(propertyId, data);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (status: IstatCredentialsStatus) => {
      queryClient.setQueryData(istatCredentialsKey(propertyId), status);
      toast.success(i18n.t('istatCredentials.saved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('istatCredentials.saveFailed'));
    },
  });
}

/** Removes the ISTAT credentials of the property (the same 204 whether or not there were any). */
export function useRemoveIstatCredentials(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => onboardingAssistApi.removeIstatCredentials(propertyId),
    onSuccess: () => {
      queryClient.setQueryData<IstatCredentialsStatus>(istatCredentialsKey(propertyId), { configured: false, configuredAt: null });
      toast.success(i18n.t('istatCredentials.removed'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('istatCredentials.removeFailed'));
    },
  });
}
