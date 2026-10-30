import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { getProblemMessage } from '@/lib/api-errors';
import type { DepositReturnInput, IstatCalculationInput, LeaseLetterKind, MarkLetterSentInput } from '@/types';
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
 * The ISTAT update worked out by the server (`POST /leases/:id/istat/calculate`, LR-OPS-1c) for the percentages typed: a read that writes
 * nothing, asked only when `input` is there (the percentages are valid numbers) and not retried (a refusal is told, not repeated). The
 * answer carries the percentages it was worked out for, so a screen shows a figure only while it is the one of the percentages typed.
 */
export function useIstatCalculation(leaseId: string, input: IstatCalculationInput | null) {
  return useQuery({
    queryKey: [LEASES_KEY, leaseId, 'istat-calculation', input?.foiPercent ?? null, input?.sharePercent ?? null] as const,
    queryFn: () => leaseOperationsApi.calculateIstat(leaseId, input as IstatCalculationInput),
    enabled: input !== null,
    retry: false,
  });
}

/**
 * The statement of the return of the deposit worked out by the server (`POST /leases/:id/deposit/calculate`, LR-OPS-1c) for the input given: a
 * read that writes nothing, asked only when `input` is there (every year has its rate, the dates and the sums are valid) and not retried (a refusal
 * is told, not repeated).
 */
export function useDepositCalculation(leaseId: string, input: DepositReturnInput | null) {
  return useQuery({
    queryKey: [LEASES_KEY, leaseId, 'deposit-calculation', input] as const,
    queryFn: () => leaseOperationsApi.calculateDepositReturn(leaseId, input as DepositReturnInput),
    enabled: input !== null,
    retry: false,
  });
}

/**
 * «Registra la restituzione»: an event in the history of the lease with the sums of the statement and nothing else (no money moves, the deposit of
 * the lease does not change). The answer is the operations as they are now, put in the cache at once; the lease is read again. A refusal is told by
 * a toast.
 */
export function useRecordDepositReturn(leaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: DepositReturnInput) => leaseOperationsApi.recordDepositReturn(leaseId, input),
    onSuccess: (operations) => {
      queryClient.setQueryData(leaseOperationsKey(leaseId), operations);
      void queryClient.invalidateQueries({ queryKey: [LEASES_KEY, leaseId], exact: true });
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('leaseOperations.deposit.failed'));
    },
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
