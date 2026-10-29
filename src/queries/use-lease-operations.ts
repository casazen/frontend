import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { LeaseLetterKind, MarkLetterSentInput } from '@/types';
import { LEASES_KEY } from './use-leases';

/** The operations of a lease hang from the lease (`['leases', id, …]`): whatever refreshes the lease refreshes them too. */
export const leaseOperationsKey = (leaseId: string) => [LEASES_KEY, leaseId, 'operations'] as const;

/**
 * What the landlord can do about the end of a lease in force and the state of its letters (LR-OPS-1, `GET /leases/:id/operations`). Read
 * again every time the sheet opens, because a notice recorded or a withdrawal registered elsewhere changes it, and it does not retry: a sheet
 * without its operations is the sheet it was. `enabled: false` for who may not write the leases (the endpoint needs `lease.create`).
 */
export function useLeaseOperations(leaseId: string, enabled = true) {
  return useQuery({
    queryKey: leaseOperationsKey(leaseId),
    queryFn: () => leaseOperationsApi.get(leaseId),
    enabled,
    refetchOnMount: 'always',
    retry: false,
  });
}

/**
 * «Segna come inviata»: an event in the history of the lease and nothing else. The answer is the operations as they are now, put in the
 * cache at once, and the lease is read again (its history has the new event). A refusal is told by a toast.
 */
export function useMarkLetterSent(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, input }: { kind: LeaseLetterKind; input: MarkLetterSentInput }) => leaseOperationsApi.markSent(leaseId, kind, input),
    onSuccess: (operations) => {
      queryClient.setQueryData(leaseOperationsKey(leaseId), operations);
      void queryClient.invalidateQueries({ queryKey: [LEASES_KEY, leaseId], exact: true });
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('leaseOperations.sent.failed'));
    },
  });
}
