import { ApiClient } from './client';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import type { AssistantDraftOutcome } from '@/types/assistant-drafts.types';

/**
 * Drafts of the assistant (E05/F05/US02/T01, NF-66). Behind the backend flag `MessageAssistant`: every endpoint answers 404 while it is off. The answers carry ids and
 * codes only; the text of a draft waits in the approval queue, never in the answer.
 */
export const assistantDraftsApi = {
  /**
   * Asks for a draft of the last message of the guest of a conversation, now (`POST api/assistant/threads/{threadKey}/draft`, policy `booking.write` and the conversation
   * in the caller's reach): nothing is sent, and a draft of the conversation that waits in the queue is superseded by the new one. The key is the one the hub gave
   * (`ota:{id}` or `direct:{bookingId}`), escaped in the address. 404 `thread_not_found`, 409 `assistant_no_guest_message`, 429 `rate_limited`.
   */
  requestDraft: async (threadKey: string) => {
    const outcome = await ApiClient.post<AssistantDraftOutcome>(`/assistant/threads/${encodeURIComponent(threadKey)}/draft`);
    // A page served in place of the answer (a rewrite that does not reach the API) is a failure, never «the assistant did nothing».
    if (outcome === null || typeof outcome !== 'object' || typeof outcome.decision !== 'string') {
      throw new UnexpectedApiResponseError('/assistant/threads/draft');
    }
    return outcome;
  },
};
