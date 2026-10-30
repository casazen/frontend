import { useMemo } from 'react';
import { useWorkspace } from '@/hooks/use-workspace';
import type { HostPermissions } from './intervention-model';

/**
 * What the person may do about the interventions of Affitti brevi: `property.write` for the steps (remind, answer a time, confirm an
 * amount, pay, cancel) and `servicerequest.write` for asking one and for marking it paid. The server decides again (403); this keeps the
 * buttons a person cannot press off the page. A collaborator has the second and not the first (decision SR-D30).
 */
export function useHostPermissions(): HostPermissions {
  const { hasPermission } = useWorkspace();
  const canManage = hasPermission('short-rent', 'property.write');
  const canRequest = hasPermission('short-rent', 'servicerequest.write');
  return useMemo(() => ({ canManage, canRequest }), [canManage, canRequest]);
}
