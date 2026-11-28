import { ApiClient } from './client';
import type { CrmMergeCandidateList, MergeCrmProfilesRequest } from '@/types/crm-merge.types';
import type { CrmProfileListItem } from '@/types/crm.types';

export const CrmMergeApi = {
  getCandidates: (page: number, pageSize: number) =>
    ApiClient.get<CrmMergeCandidateList>('/crm/merge-candidates', { page, pageSize }),

  dismiss: (candidateId: string) => ApiClient.post<void>(`/crm/merge-candidates/${candidateId}/dismiss`),

  merge: (candidateId: string, survivorProfileId: string) =>
    ApiClient.post<CrmProfileListItem>(`/crm/merge-candidates/${candidateId}/merge`, { survivorProfileId } satisfies MergeCrmProfilesRequest),
};
