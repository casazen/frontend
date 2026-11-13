import { useMutation } from '@tanstack/react-query';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import type { ComplianceHandoffRequest } from '@/types/compliance-handoff.types';

/**
 * Whether the host is offered «Verifica nel tuo Cassetto Compliance»: the same two conditions as the server (the endpoint answers 404 while
 * `Features:OctorateConnector` is off, and asks `booking.read`). The flags fail closed: while they load, or cannot be read, nothing is offered.
 * Without both, the button is not on the page, so nothing is asked and nothing changes.
 */
export function useComplianceDrawerAvailable(): boolean {
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  return flags.octorateConnector && hasPermission('short-rent', 'booking.read');
}

/**
 * Prepares the handoff (one request per click: the server writes one line in the activity log). The request holds the property, the stay and
 * the route the host comes from, and the answer holds the address to open: neither stays once nobody watches the mutation (`gcTime: 0`), and
 * what it keeps of a failure is the failure without its request (`withoutRequest`): the status and the body of the answer, not the route. It
 * is not a query, so nothing reads it again by itself, and it changes no list: starting a handoff creates no proof and changes no light.
 */
export function useStartComplianceHandoff() {
  return useMutation({
    mutationKey: ['compliance', 'octorate-handoff'],
    mutationFn: async (request: ComplianceHandoffRequest) => {
      try {
        return await octorateComplianceHandoffApi.start(request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    retry: false,
  });
}
