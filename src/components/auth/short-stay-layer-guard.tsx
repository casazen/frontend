import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { isDualRole, isLongTermOnly } from '@/lib/auth-roles';
import { useAppLayerContext } from '@/hooks/use-app-layer-context';

export function ShortStayLayerGuard() {
  const { user } = useAuth();
  const { activeLayer } = useAppLayerContext();

  if (isLongTermOnly(user)) {
    return <Navigate to="/leases" replace />;
  }

  if (isDualRole(user) && activeLayer === 'long-term') {
    return <Navigate to="/leases" replace />;
  }

  return <Outlet />;
}
