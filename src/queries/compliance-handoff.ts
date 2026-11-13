import { useMutation } from '@tanstack/react-query';
import { complianceHandoffApi } from '@/api/compliance-handoff.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { CassettoHandoffRequest } from '@/types';

/**
 * Prepares the passage to the area of the channel manager that holds an outcome (CHK-15). The answer holds the address the host will open: it is
 * kept only while the dialog that asked for it is open (`gcTime: 0`), and a failure is kept without its request, which carries the access token of
 * the caller (`withoutRequest`). Nothing is told here: the dialog that asks tells the refusals next to its button.
 */
export function useStartCassettoHandoff() {
  return useMutation({
    mutationFn: async (request: CassettoHandoffRequest) => {
      try {
        return await complianceHandoffApi.start(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
  });
}
