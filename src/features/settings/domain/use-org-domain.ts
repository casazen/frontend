import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DomainApi } from '@/api/domain.api';
import type { SetOrgDomainRequest } from '@/types/domain.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { describeDomainIssue } from './domain-state';

export const ORG_DOMAIN_QUERY_KEY = 'org-domain';

export function useOrgDomain(orgId?: string, enabled = true) {
  return useQuery({
    queryKey: [ORG_DOMAIN_QUERY_KEY, orgId],
    queryFn: () => DomainApi.getDomain(orgId!),
    enabled: !!orgId && enabled,
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
    // e.g. 422 subdomains_not_configured (no PublicHost__BaseDomain, SE-03): the reason, not a generic failure.
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('domain.settings.saveFailed')),
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
        // The reason in the user's language (stable code), the server text for a code this app does not know.
        toast.warning(
          describeDomainIssue(result.detail, result.message, i18n.t) ?? i18n.t('domain.settings.verifyFailed'),
        );
      }
    },
    // e.g. 403 plan_required (the plan lapsed): the reason, not a generic failure.
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('domain.settings.verifyFailed')),
  });
}
