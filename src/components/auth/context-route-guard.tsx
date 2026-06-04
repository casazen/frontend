import { Navigate } from 'react-router-dom';
import { LoadingScreen } from '@/components/shared/loading-screen';
import type { AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';

interface ContextRouteGuardProps {
  contextKey: AppContextKey;
  requiredPermissions?: string[];
  children: React.ReactNode;
}

export function ContextRouteGuard({ contextKey, requiredPermissions = [], children }: ContextRouteGuardProps) {
  const { contexts, isReady, getDefaultRoute } = useWorkspace();
  const current = contexts.find((ctx) => ctx.contextKey === contextKey);

  if (!isReady) {
    return <LoadingScreen message="Loading workspace..." />;
  }

  if (contexts.length === 0) {
    return <Navigate to="/app/no-access" replace />;
  }

  if (!current) {
    return <Navigate to={contexts[0].defaultRoute} replace />;
  }

  const hasAllPermissions = requiredPermissions.every((permission) => current.permissions.includes(permission));
  if (!hasAllPermissions) {
    return <Navigate to={getDefaultRoute(current.contextKey)} replace />;
  }

  return <>{children}</>;
}
