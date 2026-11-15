import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createSelfBillingDrafts, discardSelfBilling, getSelfBilling, issueSelfBilling, listSelfBilling } from '@/api/self-billing.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { SelfBillingIssueRequest } from '@/types';
import { FISCAL_DOCUMENTS_KEY } from './use-fiscal-documents';

/** Root of the query keys of the self-billed invoices (TD17): the list of a month and the detail of one live under it. */
export const SELF_BILLING_KEY = ['fiscal', 'self-billing'] as const;

/** The key of every write on a TD17 (the drafts of a month, the issue, the discard): `useSelfBillingBusy` asks the client whether one is running, so the buttons of a card wait for each other. */
const SELF_BILLING_MUTATION_KEY = [...SELF_BILLING_KEY, 'mutation'] as const;

/**
 * What the lists hold is money and the data of the holders of the portal accounts, and it changes from other screens (the drafts of the month, an invoice issued, the SDI answering): it is read again whenever
 * the page opens (`staleTime: 0`, `refetchOnMount: 'always'`), and it is not kept once nothing shows it (`gcTime: 0`).
 */
const FRESH = { staleTime: 0, gcTime: 0, refetchOnMount: 'always' } as const;

/** The TD17 of the organization, the newest month first; `period` (`yyyy-MM`) narrows them to a month and `undefined` is every month. `enabled: false` while the page is not allowed to ask. */
export function useSelfBilling(period: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...SELF_BILLING_KEY, 'list', period ?? null],
    queryFn: () => listSelfBilling(period),
    enabled,
    ...FRESH,
  });
}

/** One TD17 with its lines, for the review before the issue. Not read without an id. A 404 is «not found» whatever an earlier answer left (the screen asks `isError` first). */
export function useSelfBillingDetail(id: string | null) {
  return useQuery({
    queryKey: [...SELF_BILLING_KEY, 'detail', id],
    queryFn: () => getSelfBilling(id ?? ''),
    enabled: id !== null,
    ...FRESH,
  });
}

/** Whether any write is running on one of these TD17 (and the drafts of the month, which name no id and make every button of every card wait); with no ids, any write on any TD17. */
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

/** What every write leaves behind: the TD17 and the documents are read again (the issued one is a fiscal document with its number and its XML). It runs whatever the answer was: a refusal of a state that changed is told by the list, not left stale. */
function afterWrite(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: SELF_BILLING_KEY });
  void queryClient.invalidateQueries({ queryKey: FISCAL_DOCUMENTS_KEY });
}

/** The drafts of a month, made from the owner ledger: the answer says what was made and what could not be (the screen reads it, there is no «done» toast that could say it all went well). */
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

/** Issues a draft after the person confirmed it (and accepted the estimated part of its amount when it has one). A failure is told by the dialog the issue was asked in, with the words of its code. */
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

/** Discards a draft: it consumed no number, and its holder, portal and month are free for a new draft. */
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
