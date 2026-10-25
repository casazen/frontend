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
