import { ApiClient } from './client';
import type { CrmMergeCandidateList, MergeCrmProfilesRequest } from '@/types/crm-merge.types';
import type { CrmProfileListItem } from '@/types/crm.types';

/**
 * The merge proposals of the CRM (E07/F01/US03/T02, NF-88): the pairs of profiles the matching thinks are one guest, which a person
 * decides. Nothing merges by itself. A proposal of another org, or with a profile the caller does not reach in full, is a 404
 * `crm_merge_candidate_not_found`; one already decided is a 409 `crm_merge_not_proposed`.
 */
export const CrmMergeApi = {
  /** The proposals the caller can decide, the surest first, each with the two profiles side by side (`GET api/crm/merge-candidates`). */
  getCandidates: (page: number, pageSize: number) =>
    ApiClient.get<CrmMergeCandidateList>('/crm/merge-candidates', { page, pageSize }),

  /** The two profiles are two people: the pair is never proposed again (`POST api/crm/merge-candidates/{id}/dismiss`, 204). */
  dismiss: (candidateId: string) => ApiClient.post<void>(`/crm/merge-candidates/${candidateId}/dismiss`),

  /**
   * The two profiles are one person (`POST api/crm/merge-candidates/{id}/merge`): the guests and the contacts of the other profile move
   * to the survivor, which the server answers as the list shows it. 422 `crm_merge_survivor_invalid` when it is not one of the two.
   */
  merge: (candidateId: string, survivorProfileId: string) =>
    ApiClient.post<CrmProfileListItem>(`/crm/merge-candidates/${candidateId}/merge`, { survivorProfileId } satisfies MergeCrmProfilesRequest),
};
