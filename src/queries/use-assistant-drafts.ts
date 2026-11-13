import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assistantDraftsApi } from '@/api/assistant-drafts.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { invalidateQueue } from '@/queries/approvalQueue';
import { MESSAGE_HUB_QUERY } from '@/queries/use-message-hub';

/**
 * Asks the assistant for a draft of the last message of the guest of a conversation, now (`POST api/assistant/threads/{threadKey}/draft`, NF-66, NF-67). The answer says
 * what the assistant did (`Drafted`, `Escalated`, `NotHandled` with its reason), never what the draft says: the draft waits in the approval queue, where the host reads it
 * and decides, and nothing is sent. So the approval queue and the conversation are read again, and the mutation settles when they have been: the button of the panel
 * stays busy until the draft is on the screen.
 *
 * The answer holds ids and codes only, and the mutation is dropped as soon as nothing observes it (`gcTime: 0`); a refusal is kept without the request that was sent
 * (`withoutRequest`: the status and the body of the answer stay, which is what the screen turns into words). No toast: the panel says what happened.
 */
export function useRequestDraft(threadKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: async () => {
      try {
        return await assistantDraftsApi.requestDraft(threadKey);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: async () => {
      await Promise.all([invalidateQueue(queryClient), queryClient.invalidateQueries({ queryKey: [MESSAGE_HUB_QUERY, 'thread', threadKey] })]);
    },
  });
}
