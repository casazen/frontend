import { useMemo } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import type { HostPermissions } from './intervention-model';

export function useHostPermissions(): HostPermissions {
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission('short-rent', 'property.write');
  const canRequest = hasPermission('short-rent', 'servicerequest.write');
  return useMemo(() => ({ canManage, canRequest }), [canManage, canRequest]);
}
