import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminApi } from '@/api/admin.api';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import type { PlanTier } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

const USERS_KEY = 'users';

export function useAdminUpdateOrgPlan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ orgId, planTier }: { orgId: string; planTier: PlanTier }) =>
      AdminApi.updateOrgPlan(orgId, planTier),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
      queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
      toast.success(i18n.t('toast.orgPlanUpdated'));
    },
    onError: () => {
      toast.error(i18n.t('toast.orgPlanUpdateFailed'));
    },
  });
}
