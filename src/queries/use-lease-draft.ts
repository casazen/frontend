import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leasesApi } from '@/api/leases.api';

const DRAFT_KEY = 'lease-draft';
const LEASES_KEY = 'leases';

/**
 * The guided draft of a lease, read once when the wizard opens. The wizard owns it from then on: it does not read it again when the
 * window gets the focus (the answers on the screen would change under the person's hands), only when the person asks to reload after
 * a conflict. It holds names, fiscal codes and residences in clear: it is not kept once the page is closed (`gcTime: 0`).
 */
export function useLeaseDraft(id: string) {
  return useQuery({
    queryKey: [DRAFT_KEY, id],
    queryFn: () => leasesApi.getDraft(id),
    enabled: !!id,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  });
}

/**
 * What the wizard saved changes what the sheet of the lease and the lists say, and the app does not read a query again on mount
 * (`refetchOnMount: false`): after a save the wizard drops what it knows of this lease (nobody is looking at it: the wizard is on the
 * screen) so that the next page that opens reads it from the server, and marks the lists stale.
 */
export function useForgetLeaseReads(leaseId: string) {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.removeQueries({ queryKey: [LEASES_KEY, leaseId] });
    void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
  }, [queryClient, leaseId]);
}
