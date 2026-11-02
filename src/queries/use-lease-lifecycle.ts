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

/**
 * The stage of a lease on its path (draft, in review, in signature, active, in expiry, concluded): the server decides it and sends it
 * with every row of the list of leases (`stage`, LR-01b); the detail of a lease does not carry it yet. So the sheet reads the row of its
 * own lease in the list of the leases of the property, read again every time the sheet opens, and works nothing out from other fields.
 * `undefined` while it loads, when it fails and when the server does not say.
 */
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

/** A list of leases is `['leases', params]`; the detail and what hangs from it are `['leases', id, ...]`. */
function isLeaseListQuery(query: Query): boolean {
  return query.queryKey.length === 2 && typeof query.queryKey[1] !== 'string';
}

/** The lease is gone for good (the server deleted it): out of every list the app holds, and nothing is left of its sheet. */
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

/**
 * The notice of non-renewal (`POST /leases/:id/notice`). The answer is the lease as it is now: the sheet shows it at once and every
 * list and plan that depends on it is read again. A refusal is told by a toast and reads the lease again too: «already recorded» or
 * «not in force» mean the page showed an old state.
 */
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

/** The notice taken back from the menu (`DELETE /leases/:id/notice`): the lease renews by itself again. The answer is the lease as it is now. */
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

/** The early termination (`POST /leases/:id/terminate`). It cannot be taken back, and the answer is the lease as it is now. */
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

/**
 * The withdrawal the tenant sent, recorded (`POST /leases/:id/withdrawal`, LR-OPS-1): the lease ends on the day its notice runs out, like
 * the early termination and with its effects, and cannot be taken back. The answer is the lease as it is now.
 */
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

/**
 * The renewal of the lease recorded (`POST /leases/:id/renewal`, LR-OPS-1): the end of the period moves forward and the plan of the rent is
 * extended. The answer is the lease as it is now; the operations are read again with the rest (the window is closed until the next period's).
 */
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

/** The download for the signature on paper taken back (`DELETE /leases/:id/sent`): the lease is a draft in review again. */
export function useRevokeLeaseSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => leaseLifecycleApi.revokeSent(leaseId),
    onSettled: (_data, _error, leaseId) => refreshAfterChange(queryClient, leaseId),
    onError: (error) => reportFailure(error, 'leaseLifecycle.revokeSent.failed'),
  });
}

/** The erasure request of the data of the parties (`POST /leases/:id/erasure-request`). The caller tells the person what the answer means. */
export function useRequestLeaseErasure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (leaseId: string) => leaseLifecycleApi.requestErasure(leaseId),
    onSettled: (_data, _error, leaseId) => refreshAfterChange(queryClient, leaseId),
    onError: (error) => reportFailure(error, 'leaseLifecycle.erasure.failed'),
  });
}

/**
 * What runs behind a toast, as plain calls and not as mutations of the page: the deletion of a draft runs when the six seconds of «Annulla»
 * are over (`holdForUndo`), when the page that asked is gone, and the two that take an action back (`removeNotice`, `markSent`) run from
 * the button of the toast. Each reads again what it may have changed whether it worked or not, and a failure is for the toast to tell.
 */
export function useLeaseLifecycleActions() {
  const queryClient = useQueryClient();

  return useMemo(
    () => ({
      /** Deletes the draft on the server; the lease is out of every list, and of the cache, only once the server has done it. */
      deleteDraft: async (leaseId: string) => {
        try {
          await leaseLifecycleApi.deleteDraft(leaseId);
          dropLeaseFromCache(queryClient, leaseId);
        } finally {
          refreshAfterChange(queryClient, leaseId);
        }
      },

      /** The inverse of the notice: the lease renews by itself again. */
      removeNotice: async (leaseId: string) => {
        try {
          const detail = await leaseLifecycleApi.removeNotice(leaseId);
          queryClient.setQueryData([LEASES_KEY, leaseId], detail);
        } finally {
          refreshAfterChange(queryClient, leaseId);
        }
      },

      /** The inverse of taking the download back: the contract is marked as downloaded for the signature again. */
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

/**
 * Whether the contract can be marked as downloaded for the signature again, which is what makes «Annulla» after taking the download back
 * true: the server lets the download through only with an approved template (`contractAvailable` of the signers, the same gate as the
 * download itself). A server that cannot say is a «no»: better no «Annulla» than one that does nothing.
 */
export async function canMarkLeaseSentAgain(leaseId: string): Promise<boolean> {
  try {
    return (await leasesApi.getSigningState(leaseId)).contractAvailable === true;
  } catch {
    return false;
  }
}
