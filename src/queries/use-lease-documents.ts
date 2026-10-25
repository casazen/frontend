import { useQuery } from '@tanstack/react-query';
import { leaseDocumentsApi } from '@/api/lease-documents.api';

/** The query of the documents of a lease (`GET /leases/:id/documents`): whoever adds one asks for this key to be read again. */
export const leaseDocumentsKey = (leaseId: string) => ['lease-documents', leaseId] as const;

/**
 * The documents uploaded to a lease. The attestation of the last step of «Crea contratto» and the benefits block of a registered
 * canone concordato read them here, under the key the Documents tab and the upload page already invalidate, so a file added anywhere is
 * seen by all of them. `enabled: false` for a screen that does not need the list.
 */
export function useLeaseDocuments(leaseId: string, enabled = true) {
  return useQuery({ queryKey: leaseDocumentsKey(leaseId), queryFn: () => leaseDocumentsApi.list(leaseId), enabled });
}

/**
 * The values of a receipt of the registration that was uploaded to the lease (CF-DOCS-REAL), read from the PDF when the declaration of the
 * registration shows it: its code, its day and what does not match the contract, for the person to check. Nothing is declared by reading
 * it. A code and a day of a registration are not kept once the window closes (`gcTime: 0`), and a failure is not retried: the person types
 * the number and the date, as they always could. Nothing is asked for an empty `documentId`.
 */
export function useReceiptReading(leaseId: string, documentId: string) {
  return useQuery({
    queryKey: [...leaseDocumentsKey(leaseId), documentId, 'reading'] as const,
    queryFn: () => leaseDocumentsApi.readReceipt(leaseId, documentId),
    enabled: documentId !== '',
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
