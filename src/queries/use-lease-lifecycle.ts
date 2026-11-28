import { useMemo } from 'react';
import { useMutation, useQueryClient, type QueryClient, type Query } from '@tanstack/react-query';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { leaseLifecycleApi } from '@/api/lease-lifecycle.api';
import { leasesApi } from '@/api/leases.api';
import { getProblemMessage } from '@/lib/api-errors';
import type {
  LeaseDetail,
  LeaseStage,
  LeaseSummary,
  RecordLeaseNoticeInput,
  RecordLeaseRenewalInput,
  TenantWithdrawalInput,
  TerminateLeaseInput,
} from '@/types';
import { LEASES_KEY, useLeases } from './use-leases';
import { RENT_KEY, RENT_REGISTER_KEY } from './use-rent';

const PROPERTIES_KEY = 'properties';

export function useLeaseStage(lease: Pick<LeaseDetail, 'id' | 'propertyId'>): LeaseStage | undefined {
  const { data } = useLeases({ propertyId: lease.propertyId }, { refetchOnMount: 'always' });
  return data?.find((row) => row.id === lease.id)?.stage;
}

/**
 * A change of the life of a lease changes what its sheet says, the lists (stage, rent that is late), the plan of the rent (a termination
 * cancels the installments after the last day), the rent register and the properties (a lease occupies one or not). What is on the screen
 * is read again now; the rest is only marked stale, and a page that must be fresh asks again when it opens (`refetchOnMount`).
 */
function refreshAfterChange(queryClient: QueryClient, leaseId: string) {
  void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
  void queryClient.invalidateQueries({ queryKey: [RENT_KEY, leaseId] });
  void queryClient.invalidateQueries({ queryKey: [RENT_REGISTER_KEY] });
  void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
}

function isLeaseListQuery(query: Query): boolean {
  return query.queryKey.length === 2 && typeof query.queryKey[1] !== 'string';
}

function dropLeaseFromCache(queryClient: QueryClient, leaseId: string) {
  queryClient.setQueriesData<LeaseSummary[]>({ queryKey: [LEASES_KEY], predicate: isLeaseListQuery }, (rows) =>
    Array.isArray(rows) ? rows.filter((row) => row.id !== leaseId) : rows,
  );
  queryClient.removeQueries({ queryKey: [LEASES_KEY, leaseId] });
}

/** The server says why in a sentence of ours when it sends a code (`apiErrors.codes`); otherwise `fallbackKey` says it in general. */
function reportFailure(error: unknown, fallbackKey: string) {
  toast.error(getProblemMessage(error, i18n.t) ?? i18n.t(fallbackKey));
}

export function useRecordLeaseNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, input }: { leaseId: string; input: RecordLeaseNoticeInput }) =>
      leaseLifecycleApi.recordNotice(leaseId, input),
    onSuccess: (detail, { leaseId }) => {
      queryClient.setQueryData([LEASES_KEY, leaseId], detail);
      refreshAfterChange(queryClient, leaseId);
    },
    onError: (error, { leaseId }) => {
      refreshAfterChange(queryClient, leaseId);
      reportFailure(error, 'leaseLifecycle.notice.failed');
    },
  });
}

export function useRemoveLeaseNotice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => leaseLifecycleApi.removeNotice(leaseId),
    onSuccess: (detail, leaseId) => {
      queryClient.setQueryData([LEASES_KEY, leaseId], detail);
      refreshAfterChange(queryClient, leaseId);
    },
    onError: (error, leaseId) => {
      refreshAfterChange(queryClient, leaseId);
      reportFailure(error, 'leaseLifecycle.takeNoticeBack.failed');
    },
  });
}

export function useTerminateLease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, input }: { leaseId: string; input: TerminateLeaseInput }) =>
      leaseLifecycleApi.terminate(leaseId, input),
    onSuccess: (detail, { leaseId }) => {
      queryClient.setQueryData([LEASES_KEY, leaseId], detail);
      refreshAfterChange(queryClient, leaseId);
    },
    onError: (error, { leaseId }) => {
      refreshAfterChange(queryClient, leaseId);
      reportFailure(error, 'leaseLifecycle.terminate.failed');
    },
  });
}

export function useRecordTenantWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, input }: { leaseId: string; input: TenantWithdrawalInput }) =>
      leaseLifecycleApi.recordWithdrawal(leaseId, input),
    onSuccess: (detail, { leaseId }) => {
      queryClient.setQueryData([LEASES_KEY, leaseId], detail);
      refreshAfterChange(queryClient, leaseId);
    },
    onError: (error, { leaseId }) => {
      refreshAfterChange(queryClient, leaseId);
      reportFailure(error, 'leaseOperations.withdrawal.failed');
    },
  });
}

export function useRecordLeaseRenewal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leaseId, input }: { leaseId: string; input: RecordLeaseRenewalInput }) => leaseLifecycleApi.recordRenewal(leaseId, input),
    onSuccess: (detail, { leaseId }) => {
      queryClient.setQueryData([LEASES_KEY, leaseId], detail);
      refreshAfterChange(queryClient, leaseId);
    },
    onError: (error, { leaseId }) => {
      refreshAfterChange(queryClient, leaseId);
      reportFailure(error, 'leaseOperations.renewal.failed');
    },
  });
}

export function useRevokeLeaseSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => leaseLifecycleApi.revokeSent(leaseId),
    onSettled: (_data, _error, leaseId) => refreshAfterChange(queryClient, leaseId),
    onError: (error) => reportFailure(error, 'leaseLifecycle.revokeSent.failed'),
  });
}

export function useRequestLeaseErasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => leaseLifecycleApi.requestErasure(leaseId),
    onSettled: (_data, _error, leaseId) => refreshAfterChange(queryClient, leaseId),
    onError: (error) => reportFailure(error, 'leaseLifecycle.erasure.failed'),
  });
}

export function useLeaseLifecycleActions() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      deleteDraft: async (leaseId: string) => {
        try {
          await leaseLifecycleApi.deleteDraft(leaseId);
          dropLeaseFromCache(queryClient, leaseId);
        } finally {
          refreshAfterChange(queryClient, leaseId);
        }
      },

      removeNotice: async (leaseId: string) => {
        try {
          const detail = await leaseLifecycleApi.removeNotice(leaseId);
          queryClient.setQueryData([LEASES_KEY, leaseId], detail);
        } finally {
          refreshAfterChange(queryClient, leaseId);
        }
      },

      markSent: async (leaseId: string) => {
        try {
          await leaseLifecycleApi.markSent(leaseId);
        } finally {
          refreshAfterChange(queryClient, leaseId);
        }
      },
    }),
    [queryClient],
  );
}

export async function canMarkLeaseSentAgain(leaseId: string): Promise<boolean> {
  try {
    return (await leasesApi.getSigningState(leaseId)).contractAvailable === true;
  } catch {
    return false;
  }
}
