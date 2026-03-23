import { useAuth } from '@/hooks/use-auth';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Navigate } from 'react-router-dom';
import { isDemoMode } from '@/config/demo.config';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();

  // In demo mode, skip authentication
  if (isDemoMode) {
    return <>{children}</>;
  }

  if (isLoading) {
    return <LoadingScreen message="Authenticating..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
