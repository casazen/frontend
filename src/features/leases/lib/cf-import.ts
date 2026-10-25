import { useDraftReading } from '@/queries/use-lease-draft';
import type { LeaseDetail, LeaseReading } from '@/types';

type CfImportLease = Pick<LeaseDetail, 'id' | 'status' | 'origin' | 'isConcordatoFacileSource'>;

/**
 * The draft of a contract made with ConcordatoFacile (CF-IMPORT): a draft of origin `Imported` marked as the partner's. The partner writes
 * the contract and has it signed outside our models, so the draft waits for it and then imports it as a signed contract. Any other
 * lease (a draft made in CasaZen, one imported by the owner, a signed contract) is not it.
 */
export function isCfImportDraft(lease: Pick<CfImportLease, 'status' | 'origin' | 'isConcordatoFacileSource'>): boolean {
  return lease.status === 'Draft' && lease.origin === 'Imported' && lease.isConcordatoFacileSource === true;
}

/**
 * The contract ConcordatoFacile delivered to its draft, as the reading of it stands: `null` unless the lease is that draft and has a
 * contract document uploaded. It asks the server only for that draft (any other lease asks nothing) and asks again while the reading
 * goes on.
 */
export function useCfDeliveredContract(lease: CfImportLease): LeaseReading | null {
  const cfDraft = isCfImportDraft(lease);
  const reading = useDraftReading(lease.id, cfDraft);
  return cfDraft && reading.data !== undefined && reading.data.state !== 'None' ? reading.data : null;
}
