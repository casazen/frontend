import { useContext } from 'react';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { useLeaseOperations } from '@/queries/use-lease-operations';

export function useSheetOperations(leaseId: string) {
  const workspace = useContext(WorkspaceContext);
  const canManage = workspace ? workspace.hasPermission('long-rent', 'lease.create') : true;
  return useLeaseOperations(leaseId, canManage);
}
