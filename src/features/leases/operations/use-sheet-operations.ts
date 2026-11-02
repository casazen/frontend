import { useContext } from 'react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useLeaseOperations } from '@/queries/use-lease-operations';

/**
 * The operations of the lease the sheet shows (LR-OPS-1), for whoever on the sheet asks: the section of the operations and the guide (for the
 * advice that depends on them). It is one query with one key, so the server is asked once. Without a workspace (a page rendered on its own)
 * nothing is hidden and the server decides; a person who may not write the leases does not ask (the endpoint needs `lease.create`).
 */
export function useSheetOperations(leaseId: string) {
  const workspace = useContext(WorkspaceContext);
  const canManage = workspace ? workspace.hasPermission('long-rent', 'lease.create') : true;
  return useLeaseOperations(leaseId, canManage);
}
