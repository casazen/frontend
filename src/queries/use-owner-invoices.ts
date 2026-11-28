import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ownerInvoicesApi } from '@/api/owner-invoices.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { OwnerInvoiceCriteria } from '@/types';
import { OWNER_ACCOUNTING_KEY } from './use-owner-accounting';
import { saveDownload } from './save-download';

const OWNER_INVOICES_KEY = 'owner-invoices';

const ownerInvoiceKeys = {
  list: (criteria: OwnerInvoiceCriteria) => [OWNER_INVOICES_KEY, 'list', criteria.period ?? 'all', criteria.ownerId ?? 'all'] as const,
  detail: (invoiceId: string) => [OWNER_INVOICES_KEY, 'detail', invoiceId] as const,
};

/**
 * What a write changed: the invoices (a draft, a number) and the owner accounting (an issued invoice posts its VAT to the ledger and regenerates the draft statement of the month),
 * read again on their next view and now where they are open.
 */
function invalidateAfterWrite(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [OWNER_INVOICES_KEY] }),
    queryClient.invalidateQueries({ queryKey: [OWNER_ACCOUNTING_KEY] }),
  ]);
}

/**
 * The invoices of the org, narrowed to a month and an owner. Other people of the agency make and issue them too, and the statement posts a VAT when one is issued: read again every time
 * a page opens and soon after (`staleTime`). `null` when the server refuses the list to the caller; a 404 is the module being off.
 */
export function useOwnerInvoices(criteria: OwnerInvoiceCriteria, enabled = true) {
  return useQuery({
    queryKey: ownerInvoiceKeys.list(criteria),
    queryFn: () => ownerInvoicesApi.list(criteria),
    enabled,
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

export function useOwnerInvoice(invoiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: ownerInvoiceKeys.detail(invoiceId ?? ''),
    queryFn: () => ownerInvoicesApi.get(invoiceId ?? ''),
    enabled: enabled && invoiceId !== null,
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

export function useCreateOwnerInvoiceDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      try {
        return await ownerInvoicesApi.createDraft(versionId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => invalidateAfterWrite(queryClient),
  });
}

export function useIssueOwnerInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      try {
        return await ownerInvoicesApi.issue(invoiceId);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => invalidateAfterWrite(queryClient),
  });
}

export function useDownloadOwnerInvoicePdf() {
  return useMutation({
    mutationFn: ({ invoiceId, fileName }: { invoiceId: string; fileName: string }) => saveDownload(ownerInvoicesApi.downloadPdf(invoiceId), fileName),
    gcTime: 0,
  });
}
