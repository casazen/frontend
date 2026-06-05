import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { needsOnboarding } from '@/lib/onboarding';

export function OnboardingGuard() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  if (isAuthenticated && needsOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
