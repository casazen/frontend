import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  closeSelfBillingNotDue,
  createSelfBillingDrafts,
  discardSelfBilling,
  getSelfBilling,
  issueSelfBilling,
  listSelfBilling,
  startSelfBillingCorrection,
} from '@/api/self-billing.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { SelfBillingCloseRequest, SelfBillingIssueRequest } from '@/types';
import { FISCAL_DOCUMENTS_KEY } from './use-fiscal-documents';

export const SELF_BILLING_KEY = ['fiscal', 'self-billing'] as const;

const SELF_BILLING_MUTATION_KEY = [...SELF_BILLING_KEY, 'mutation'] as const;

/**
 * What the lists hold is money and the data of the holders of the portal accounts, and it changes from other screens (the drafts of the month, an invoice issued, the SDI answering): it is read again whenever
 * the page opens (`staleTime: 0`, `refetchOnMount: 'always'`), and it is not kept once nothing shows it (`gcTime: 0`).
 */
const FRESH = { staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const;

export function useSelfBilling(period: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...SELF_BILLING_KEY, 'list', period ?? null],
    queryFn: () => listSelfBilling(period),
    enabled,
    ...FRESH,
  });
}

export function useSelfBillingDetail(id: string | null) {
  return useQuery({
    queryKey: [...SELF_BILLING_KEY, 'detail', id],
    queryFn: () => getSelfBilling(id ?? ''),
    enabled: id !== null,
    ...FRESH,
  });
}

export function useSelfBillingBusy(ids?: readonly string[]): boolean {
  return (
    useIsMutating({
      mutationKey: SELF_BILLING_MUTATION_KEY,
      predicate: (mutation) => {
        const variables = mutation.state.variables as { documentId?: string } | undefined;
        return ids === undefined || variables?.documentId === undefined || ids.includes(variables.documentId);
      },
    }) > 0
  );
}

function afterWrite(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: SELF_BILLING_KEY });
  void queryClient.invalidateQueries({ queryKey: FISCAL_DOCUMENTS_KEY });
}

export function useCreateSelfBillingDrafts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SELF_BILLING_MUTATION_KEY,
    mutationFn: async ({ period }: { period: string }) => {
      try {
        return await createSelfBillingDrafts(period);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => afterWrite(queryClient),
  });
}

export function useIssueSelfBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SELF_BILLING_MUTATION_KEY,
    mutationFn: async ({ documentId, request }: { documentId: string; request: SelfBillingIssueRequest }) => {
      try {
        return await issueSelfBilling(documentId, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => afterWrite(queryClient),
  });
}

export function useDiscardSelfBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SELF_BILLING_MUTATION_KEY,
    mutationFn: async ({ documentId }: { documentId: string }): Promise<void> => {
      try {
        await discardSelfBilling(documentId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => afterWrite(queryClient),
  });
}

/**
 * «Correggi e rimanda»: the TD17 the SDI rejected is replaced by a draft that holds its number (the answer, `null` when its body could not be read: the correction was made all the same). It writes on the rejected
 * TD17, so the buttons of its card wait for it (`documentId` is in the variables). A failure is kept without its request (`withoutRequest`) and told by the dialog the correction was asked in, in the words of what
 * the server said (not found, not correctable, no access, or a call that failed); the lists and the documents are read again whatever the answer was, so a refusal of a state that changed is not left stale.
 */
export function useCorrectSelfBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SELF_BILLING_MUTATION_KEY,
    mutationFn: async ({ documentId }: { documentId: string }) => {
      try {
        return await startSelfBillingCorrection(documentId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => afterWrite(queryClient),
  });
}

/**
 * «Chiudi come non più dovuta»: the replacement draft of a rejected TD17 that the month no longer supports is closed with the reason and the optional note of the person; it keeps its number. It writes on that draft, so the
 * buttons of its card wait for it (`documentId` is in the variables). The note is free text that can name a person or a document: it lives in the variables of the call while the dialog that asked is open (`gcTime: 0` drops the
 * mutation once nothing watches it, and the dialog resets it as soon as it has read a failure, so the note is not kept while it waits for a retry), and a failure is kept without its request (`withoutRequest`, which carries
 * the body of the call) and reduced to what the screen turns into words (the status and the code of the answer). The lists and the documents are read again whatever the answer was, so a refusal of a state that changed
 * (already closed, not closable any more) is not left stale.
 */
export function useCloseSelfBilling() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: SELF_BILLING_MUTATION_KEY,
    mutationFn: async ({ documentId, request }: { documentId: string; request: SelfBillingCloseRequest }) => {
      try {
        return await closeSelfBillingNotDue(documentId, request);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => afterWrite(queryClient),
  });
}
