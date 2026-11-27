import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CrmMergeApi } from '@/api/crm-merge.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { CRM_GUEST_KEY, CRM_GUESTS_KEY, CRM_KEY, crmGuestKey } from '@/queries/crm';

const MERGE_PAGE_SIZE = 20;

export const MERGE_CANDIDATES_KEY = [CRM_KEY, 'merge-candidates'] as const;

export function useMergeCandidates(page: number) {
  return useQuery({
    queryKey: [...MERGE_CANDIDATES_KEY, page],
    queryFn: () => CrmMergeApi.getCandidates(page, MERGE_PAGE_SIZE),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

function readProposalsAgain(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: MERGE_CANDIDATES_KEY });
}

/**
 * Merges the two profiles of a proposal into the one the host keeps (`POST api/crm/merge-candidates/{id}/merge`). A merge changes the
 * list of the profiles (one is gone), the profiles themselves (the survivor has the other's stays and contacts) and the proposals, so all
 * three are read again, and what the app had read of the profile that went is dropped (its page is "not found" from now on, and must
 * not come back from the cache). 409 `crm_merge_not_proposed` (already decided), 404 `crm_merge_candidate_not_found` and 422
 * `crm_merge_survivor_invalid` are told in plain words, and nothing is claimed done.
 */
export function useMergeProfiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ candidateId, survivorProfileId }: { candidateId: string; survivorProfileId: string; discardedProfileId: string }) =>
      CrmMergeApi.merge(candidateId, survivorProfileId),
    onSuccess: (_result, { discardedProfileId }) => {
      queryClient.removeQueries({ queryKey: crmGuestKey(discardedProfileId), exact: true });
      void queryClient.invalidateQueries({ queryKey: CRM_GUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CRM_GUEST_KEY });
      toast.success(i18n.t('crm.merge.mergeDone'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('crm.merge.mergeError'));
    },
    onSettled: () => readProposalsAgain(queryClient),
  });
}

export function useDismissMergeCandidate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (candidateId: string) => CrmMergeApi.dismiss(candidateId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: CRM_GUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: CRM_GUEST_KEY });
      toast.success(i18n.t('crm.merge.dismissDone'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('crm.merge.dismissError'));
    },
    onSettled: () => readProposalsAgain(queryClient),
  });
}
