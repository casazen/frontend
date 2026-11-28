import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DomainApi } from '@/api/domain.api';
import type { OrgDomainConfig, SetDomainSurfacesRequest, SetOrgDomainRequest } from '@/types/domain.types';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { resolveBookingSite, type BookingSite } from '@/lib/booking-link';
import { ORG_BILLING_ADMIN_PERMISSION } from '@/lib/org-billing-admin';
import { describeDomainIssue } from './domain-state';

export const ORG_DOMAIN_QUERY_KEY = 'org-domain';

export function useOrgDomain(orgId?: string, enabled = true, options: { fresh?: boolean } = {}) {
  return useQuery({
    queryKey: [ORG_DOMAIN_QUERY_KEY, orgId],
    queryFn: () => DomainApi.getDomain(orgId!),
    enabled: !!orgId && enabled,
    ...(options.fresh ? { refetchOnMount: 'always' as const, staleTime: 0 } : {}),
  });
}

export interface OrgBookingSite {
  site: BookingSite;
  /**
   * `ready`: the address is the one of the domain settings. `loading`: the settings are on their way, the links are on the address of CasaZen for now. `restricted`: the
   * settings are the account administrator's to read, so for this caller the links are on the address of CasaZen. `failed`: they could not be read, same address;
   * `retry` asks again.
   */
  status: 'ready' | 'loading' | 'restricted' | 'failed';
  retry: () => void;
  config?: OrgDomainConfig;
}

/**
 * The booking site of the org for the links the host copies (E27/F01/US02, NF-123): its own host when it has one that is served, the platform path otherwise
 * (`resolveBookingSite`). Only the administrator of the account may read the domain settings (`GET /orgs/{id}/domain`; a refused read would send the whole app to the
 * page of no access), so for anyone else nothing is asked and `status` says `restricted`. `null` while the org has no slug.
 */
export function useOrgBookingSite(orgId: string | undefined, orgSlug: string | null): OrgBookingSite | null {
  const { hasPermission } = useWorkspace();
  const canRead = hasPermission('short-rent', ORG_BILLING_ADMIN_PERMISSION);
  const { data, isError, refetch } = useOrgDomain(orgId, canRead, { fresh: true });

  // A read that failed leaves the settings of the last one that worked in the query: the links are not built on them, since the status says they could not be read.
  // An answer with no addresses in it is a read that failed too, not one that is still on its way.
  const publicUrls = canRead && !isError ? data?.publicUrls : undefined;
  const status = !canRead ? 'restricted' : isError || (data && !data.publicUrls) ? 'failed' : data ? 'ready' : 'loading';
  const config = status === 'ready' ? data : undefined;

  return useMemo(() => {
    if (!orgSlug) return null;
    const site = resolveBookingSite({ orgSlug, publicUrls, appOrigin: window.location.origin });
    return { site, status, retry: () => void refetch(), config };
  }, [orgSlug, publicUrls, status, refetch, config]);
}

export function useSetOrgDomain(orgId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SetOrgDomainRequest) => DomainApi.setDomain(orgId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ORG_DOMAIN_QUERY_KEY, orgId] });
      toast.success(i18n.t('domain.settings.saved'));
    },
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
        toast.warning(
          describeDomainIssue(result.detail, result.message, i18n.t) ?? i18n.t('domain.settings.verifyFailed'),
        );
      }
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('domain.settings.verifyFailed')),
  });
}

export function useSetDomainSurfaces(orgId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SetDomainSurfacesRequest) => DomainApi.setSurfaces(orgId!, payload),
    onSuccess: (config) => {
      queryClient.setQueryData<OrgDomainConfig>([ORG_DOMAIN_QUERY_KEY, orgId], config);
      toast.success(i18n.t('domain.settings.saved'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('domain.settings.saveFailed')),
  });
}

export function useRequestOwnerLogin(orgId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => DomainApi.requestOwnerLogin(orgId!),
    onSuccess: (config) => {
      queryClient.setQueryData<OrgDomainConfig>([ORG_DOMAIN_QUERY_KEY, orgId], config);
      const state = config.surfaces?.ownerLoginHostState;
      if (state === 'Failed') toast.warning(i18n.t('domain.surfaces.ownerLogin.retryStillFailed'));
      else if (state === 'Ready') toast.success(i18n.t('domain.surfaces.ownerLogin.retryReady'));
      else toast.success(i18n.t('domain.surfaces.ownerLogin.retryRequested'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('domain.surfaces.ownerLogin.retryFailed')),
  });
}
