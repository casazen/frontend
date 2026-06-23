import { useAuth } from '@/hooks/use-auth';
import { useUserRoles } from '@/hooks/use-user-roles';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Navigate } from 'react-router-dom';
import { isDemoMode } from '@/config/demo.config';
import { hasRole } from '@/lib/auth-roles';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: string;
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const roles = useUserRoles();
  const hasShownRoleToast = useRef(false);

  const isAuthorized = !role || (isDemoMode ? hasRole(user, role) : roles.includes(role));

  useEffect(() => {
    if (!isDemoMode && !isLoading && isAuthenticated && role && !isAuthorized && !hasShownRoleToast.current) {
      hasShownRoleToast.current = true;
      toast.error('You do not have access to this section');
    }
  }, [isLoading, isAuthenticated, role, isAuthorized]);

  if (isDemoMode) {
    if (role && !hasRole(user, role)) {
      return <Navigate to="/" replace />;
    }
    return <>{children}</>;
  }

  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && !isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
