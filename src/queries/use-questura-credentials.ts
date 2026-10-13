import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { questuraCredentialsApi } from '@/api/questura-credentials.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { QuesturaCredentialsStatus, SetQuesturaCredentialsRequest } from '@/types/questura-credentials.types';

const questuraCredentialsKey = (propertyId: string) => ['questura-credentials', propertyId] as const;

/** Whether the property has Alloggiati Web credentials, and since when (never the values). */
export function useQuesturaCredentialsStatus(propertyId: string) {
  return useQuery({
    queryKey: questuraCredentialsKey(propertyId),
    queryFn: () => questuraCredentialsApi.getStatus(propertyId),
    enabled: !!propertyId,
  });
}

export function useSetQuesturaCredentials(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SetQuesturaCredentialsRequest) => questuraCredentialsApi.set(propertyId, data),
    onSuccess: (status: QuesturaCredentialsStatus) => {
      queryClient.setQueryData(questuraCredentialsKey(propertyId), status);
      toast.success(i18n.t('questuraCredentials.saved'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('questuraCredentials.saveFailed'));
    },
  });
}

export function useRemoveQuesturaCredentials(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => questuraCredentialsApi.remove(propertyId),
    onSuccess: () => {
      queryClient.setQueryData<QuesturaCredentialsStatus>(questuraCredentialsKey(propertyId), {
        configured: false,
        configuredAt: null,
      });
      toast.success(i18n.t('questuraCredentials.removed'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('questuraCredentials.removeFailed'));
    },
  });
}
