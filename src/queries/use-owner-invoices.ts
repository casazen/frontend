import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ownerInvoicesApi } from '@/api/owner-invoices.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { OwnerInvoiceCriteria } from '@/types';
import { OWNER_ACCOUNTING_KEY } from './use-owner-accounting';
import { saveDownload } from './save-download';

/** Root of the query keys of the invoices to the owners: a write that makes or issues one invalidates everything under it. */
export const OWNER_INVOICES_KEY = 'owner-invoices';

export const ownerInvoiceKeys = {
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

/**
 * One invoice with its lines, read by its id (`enabled` only while a screen asks to see it). It changes under the person's hands (another one issues or discards it, a version is made again),
 * so it is read again every time it is opened and soon after (`staleTime`), and a write of the invoices reads it again where it is open (it is under their root key). `null` when the server
 * refuses it to the caller; a 404 is an invoice that is no longer there (or the module off), whatever the cache still holds from an earlier read.
 */
export function useOwnerInvoice(invoiceId: string | null, enabled = true) {
  return useQuery({
    queryKey: ownerInvoiceKeys.detail(invoiceId ?? ''),
    queryFn: () => ownerInvoicesApi.get(invoiceId ?? ''),
    enabled: enabled && invoiceId !== null,
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/**
 * Makes the draft of the invoice of a version, or makes the draft the month already has again from it. The mutation is dropped as soon as nothing watches it (`gcTime: 0`) and keeps
 * of a failure the answer of the server without the request (`withoutRequest`).
 */
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

/** Issues the draft the person confirmed: the number is given by the server, once. */
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

/** Saves the PDF of an invoice under the name the server gave it, or under `fileName` when the page cannot read the header; the bytes are not kept. */
export function useDownloadOwnerInvoicePdf() {
  return useMutation({
    mutationFn: ({ invoiceId, fileName }: { invoiceId: string; fileName: string }) => saveDownload(ownerInvoicesApi.downloadPdf(invoiceId), fileName),
    gcTime: 0,
  });
}
