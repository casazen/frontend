import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DomainApi } from '@/api/domain.api';
import type { SetOrgDomainRequest } from '@/types/domain.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';

export const ORG_DOMAIN_QUERY_KEY = 'org-domain';

export function useOrgDomain(orgId?: string) {
  return useQuery({
    queryKey: [ORG_DOMAIN_QUERY_KEY, orgId],
    queryFn: () => DomainApi.getDomain(orgId!),
    enabled: !!orgId,
  });
}

export function useSetOrgDomain(orgId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SetOrgDomainRequest) => DomainApi.setDomain(orgId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORG_DOMAIN_QUERY_KEY, orgId] });
      toast.success(i18n.t('domain.settings.saved'));
    },
    onError: () => toast.error(i18n.t('domain.settings.saveFailed')),
  });
}

export function useVerifyOrgDomain(orgId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => DomainApi.verifyDomain(orgId!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [ORG_DOMAIN_QUERY_KEY, orgId] });
      if (result.domainVerificationStatus === 'Verified') {
        toast.success(i18n.t('domain.settings.verifySuccess'));
      } else {
        toast.warning(result.message ?? i18n.t('domain.settings.verifyFailed'));
      }
    },
    onError: () => toast.error(i18n.t('domain.settings.verifyFailed')),
  });
}
