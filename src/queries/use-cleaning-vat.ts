import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cleaningVatApi } from '@/api/cleaning-vat.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { getHttpStatus } from '@/lib/api-errors';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import type { CleaningVatAnswerCommand } from '@/types';

/** Root of the query keys of the question of the VAT of a cleaning (FIX/BE-CLEANING-VAT): one question for each cleaning request. */
export const CLEANING_VAT_KEY = 'cleaning-vat';

export const cleaningVatKeys = {
  question: (requestId: string) => [CLEANING_VAT_KEY, requestId] as const,
};

/**
 * The question of a completed cleaning request: the rate of «Sì», the answer given, what the invoice uses and whether the caller may remember. It changes on other screens (another person answered, the request changed) and the
 * client does not read again on mount by default, so every time the dialog opens it reads again and nothing is fresh for long. `null` when the server refuses it to the caller (403); a 404 is an error, which the dialog
 * tells as «not found» whatever an earlier answer left in the cache.
 */
export function useCleaningVatQuestion(requestId: string) {
  return useQuery({
    queryKey: cleaningVatKeys.question(requestId),
    queryFn: () => cleaningVatApi.get(requestId),
    enabled: requestId !== '',
    refetchOnMount: 'always' as const,
    staleTime: 10_000,
  });
}

/**
 * The answer to the question: `{ answer, remember }`. It stores the answer, keeps it for the company with `remember` and closes the «Da fare» of the request, so the list and the number on the nav are read again; the question
 * on screen becomes the one the server answers. The command is not personal data, but the mutation is dropped as soon as nothing watches it (`gcTime: 0`) and keeps of a failure only the answer of the server
 * (`withoutRequest`), as every write of the owner accounting. A 409 (another operation changed the request meanwhile) reads the question again, so the person answers the one that is there now; the other refusals say
 * that the question on screen is what the server has, or that the call has to be tried again, and read nothing.
 */
export function useAnswerCleaningVat(requestId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    gcTime: 0,
    mutationFn: async (command: CleaningVatAnswerCommand) => {
      try {
        return await cleaningVatApi.answer(requestId, command);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    onSuccess: (question) => {
      queryClient.setQueryData(cleaningVatKeys.question(requestId), question);
      void queryClient.invalidateQueries({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
    },
    onError: (error) => {
      if (getHttpStatus(error) === 409) void queryClient.invalidateQueries({ queryKey: cleaningVatKeys.question(requestId) });
    },
  });
}
