import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { OrgsApi } from '@/api/orgs.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type {
  OrgSiteDocumentKind,
  OrgSiteDocumentState,
  OrgSiteDocumentVersion,
  PublishOrgSiteDocumentRequest,
} from '@/types';

export const SITE_DOCUMENTS_QUERY_KEY = ['org-site-documents'] as const;

/** BK-14: state of the operator's privacy notice and booking terms. Org billing admin only (403 otherwise). */
export function useSiteDocuments(enabled = true) {
  return useQuery({
    queryKey: SITE_DOCUMENTS_QUERY_KEY,
    queryFn: () => OrgsApi.getSiteDocuments(),
    enabled,
    retry: false,
  });
}

/** After a change: the console copy of that kind, and the public pages cached in this tab. */
function useApplyState() {
  const queryClient = useQueryClient();
  return (state: OrgSiteDocumentState) => {
    queryClient.setQueryData<OrgSiteDocumentState[]>(SITE_DOCUMENTS_QUERY_KEY, (current) =>
      current?.map((entry) => (entry.kind === state.kind ? state : entry)) ?? [state],
    );
    void queryClient.invalidateQueries({ queryKey: ['public-org-document'] });
  };
}

export function usePublishSiteDocument(kind: OrgSiteDocumentKind) {
  const applyState = useApplyState();
  return useMutation({
    mutationFn: (payload: PublishOrgSiteDocumentRequest) => OrgsApi.publishSiteDocument(kind, payload),
    onSuccess: (state) => {
      applyState(state);
      toast.success(i18n.t('siteDocuments.toasts.published', { version: state.current?.version ?? 1 }));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('siteDocuments.toasts.publishFailed')),
  });
}

export function useWithdrawSiteDocument(kind: OrgSiteDocumentKind) {
  const applyState = useApplyState();
  return useMutation({
    mutationFn: () => OrgsApi.withdrawSiteDocument(kind),
    onSuccess: (state) => {
      applyState(state);
      toast.success(i18n.t('siteDocuments.toasts.withdrawn'));
    },
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('siteDocuments.toasts.withdrawFailed')),
  });
}

/** One earlier version with its text, fetched when the host asks to start from it. */
export function useLoadSiteDocumentVersion(kind: OrgSiteDocumentKind) {
  return useMutation<OrgSiteDocumentVersion, unknown, number>({
    mutationFn: (version) => OrgsApi.getSiteDocumentVersion(kind, version),
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('siteDocuments.toasts.versionLoadFailed')),
  });
}
