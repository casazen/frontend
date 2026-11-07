import { useParams } from 'react-router-dom';
import { useTenantContract } from '@/queries/use-tenant-area';
import type { TenantContractArea } from '@/types';

export function useLeaseId(): string {
  return useParams<{ leaseId: string }>().leaseId ?? '';
}

/** The contract named in the address, still loading, or failed. */
export function useTenantContractPage():
  | { status: 'loading'; leaseId: string; area: null; error: null; refetch: () => void }
  | { status: 'error'; leaseId: string; area: null; error: unknown; refetch: () => void }
  | { status: 'ready'; leaseId: string; area: TenantContractArea; error: null; refetch: () => void } {
  const leaseId = useLeaseId();
  const query = useTenantContract(leaseId);
  const refetch = () => void query.refetch();
  if (query.isLoading) return { status: 'loading', leaseId, area: null, error: null, refetch };
  if (query.isError || !query.data) return { status: 'error', leaseId, area: null, error: query.error, refetch };
  return { status: 'ready', leaseId, area: query.data, error: null, refetch };
}
