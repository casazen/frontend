import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { internalActivitiesApi } from '@/api/internal-activities.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';

const INTERNAL_ACTIVITIES_KEY = 'internal-activities';

export function useMyActivities() {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, 'my-activities'],
    queryFn: () => internalActivitiesApi.getMyActivities(),
  });
}

export function useActivityDetail(id: string) {
  return useQuery({
    queryKey: [INTERNAL_ACTIVITIES_KEY, id],
    queryFn: () => internalActivitiesApi.getActivity(id),
    enabled: !!id,
  });
}

export function useUpdateActivityStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: string; notes?: string }) =>
      internalActivitiesApi.updateStatus(id, { status, notes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
      toast.success(i18n.t('activity.statusUpdateSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('activity.statusUpdateError'));
    },
  });
}
