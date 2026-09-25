import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { OrgsApi } from '@/api/orgs.api';
import type { UpdateOrgSettingsRequest } from '@/types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';

export const ORG_SETTINGS_QUERY_KEY = ['org-settings'] as const;

/** A1-22, A1-23: name, public slug and contact email opt-in of the caller's org. Org billing admin only (403 otherwise). */
export function useOrgSettings(enabled = true) {
  return useQuery({
    queryKey: ORG_SETTINGS_QUERY_KEY,
    queryFn: () => OrgsApi.getSettings(),
    enabled,
    retry: false,
  });
}

export function useUpdateOrgSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateOrgSettingsRequest) => OrgsApi.updateSettings(payload),
    onSuccess: (settings) => {
      queryClient.setQueryData(ORG_SETTINGS_QUERY_KEY, settings);
      // The name/slug also back the nav org badge and vetrina links (OrgSummaryDto, GET /users/me).
      void queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
      toast.success(i18n.t('orgSettings.saved'));
    },
    // e.g. 409 org_slug_taken or 422 org_slug_invalid/org_slug_reserved: the reason, not a generic failure.
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('orgSettings.saveFailed')),
  });
}
