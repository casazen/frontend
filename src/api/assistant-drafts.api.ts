import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { AssistantDraftOutcome } from '@/types/assistant-drafts.types';

export const assistantDraftsApi = {
  requestDraft: async (threadKey: string) => {
    const outcome = await ApiClient.post<AssistantDraftOutcome>(`/assistant/threads/${encodeURIComponent(threadKey)}/draft`);
    if (outcome === null || typeof outcome !== 'object' || typeof outcome.decision !== 'string') {
      throw new UnexpectedApiResponseError('/assistant/threads/draft');
    }
    return outcome;
  },
};
